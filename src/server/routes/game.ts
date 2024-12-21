import express, { Request, Response, Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { pool } from '../db/config';
import { getGame, getGamePlayers, getGameProperties, buyProperty, getPropertyByPosition, payRent } from '../db/services/dbService';
import { Game, GameState } from '../db/models/types';
import { BOARD_SPACES } from '../../shared/boardData';
import { BotService } from '../services/botService';

const router: Router = express.Router();

// GET /game/:id - Show game page
router.get('/game/:id', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const gameId = parseInt(req.params.id);
    const userId = req.session.userId;

    if (!userId) {
      res.redirect('/login');
      return;
    }

    const game = await getGame(gameId);
    if (!game) {
      res.redirect('/lobby?error=game-not-found');
      return;
    }

    const [players, properties] = await Promise.all([
      getGamePlayers(gameId),
      getGameProperties(gameId)
    ]);

    const currentPlayer = players.find(p => p.user_id === userId);
    if (!currentPlayer) {
      res.redirect('/lobby?error=not-in-game');
      return;
    }

    // Initialize game state if it doesn't exist
    const gameState = game.game_state || {
      phase: 'waiting',
      current_player_index: 0,
      dice_rolls: [],
      turn_order: []
    };

    // Sort players by turn order if it exists
    const sortedPlayers = gameState.turn_order.length > 0
      ? gameState.turn_order.map(playerId => players.find(p => p.id === playerId)).filter(Boolean)
      : players;

    res.render('game', {
      game,
      players: sortedPlayers,
      properties,
      currentUserId: userId,
      currentPlayerId: currentPlayer.id,
      gameState
    });
  } catch (error) {
    console.error('Game view error:', error);
    res.redirect('/lobby?error=game-error');
  }
});

// POST /game/:gameId/roll - Handle dice roll
router.post('/game/:gameId/roll', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const gameId = parseInt(req.params.gameId);
  const userId = req.session.userId;
  const { botId } = req.body;

  if (!userId) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Get current game state
    const gameResult = await client.query<Game>(
      'SELECT game_state FROM games WHERE id = $1',
      [gameId]
    );

    if (!gameResult.rows[0]) {
      res.status(404).json({ error: 'Game not found' });
      return;
    }

    const gameState = gameResult.rows[0].game_state as GameState;
    const roll = Math.floor(Math.random() * 6) + 1 + Math.floor(Math.random() * 6) + 1;

    // Get current player (either human or bot)
    const playerResult = await client.query(
      'SELECT * FROM players WHERE game_id = $1 AND (user_id = $2 OR id = $3)',
      [gameId, userId, botId]
    );

    if (!playerResult.rows[0]) {
      res.status(404).json({ error: 'Player not found in game' });
      return;
    }

    const player = playerResult.rows[0];

    if (gameState.phase === 'waiting') {
      // Initial roll phase
      if (gameState.dice_rolls.find(r => r.playerId === player.id)) {
        res.status(400).json({ error: 'You have already rolled' });
        return;
      }

      gameState.dice_rolls.push({ playerId: player.id, roll });

      // If all players have rolled, determine turn order
      const playersResult = await client.query(
        'SELECT id FROM players WHERE game_id = $1',
        [gameId]
      );

      if (gameState.dice_rolls.length === playersResult.rows.length) {
        // Sort players by roll value
        const sortedRolls = [...gameState.dice_rolls].sort((a, b) => b.roll - a.roll);
        gameState.turn_order = sortedRolls.map(r => r.playerId);
        gameState.phase = 'playing';
        gameState.current_player_index = 0;

        // Update game status
        await client.query(
          'UPDATE games SET status = $1 WHERE id = $2',
          ['in-progress', gameId]
        );
      }

      await client.query(
        'UPDATE games SET game_state = $1 WHERE id = $2',
        [gameState, gameId]
      );

      await client.query('COMMIT');
      res.json({ roll, gameState });
      return;
    } else {
      // Regular gameplay phase
      if (gameState.turn_order[gameState.current_player_index] !== player.id) {
        res.status(400).json({ error: 'Not your turn' });
        return;
      }

      // Calculate new position
      const newPosition = (player.position + roll) % 40;
      await client.query(
        'UPDATE players SET position = $1 WHERE id = $2',
        [newPosition, player.id]
      );

      // Move to next player
      gameState.current_player_index = (gameState.current_player_index + 1) % gameState.turn_order.length;
      await client.query(
        'UPDATE games SET game_state = $1 WHERE id = $2',
        [gameState, gameId]
      );

      await client.query('COMMIT');
      res.json({ roll, newPosition, gameState });
      return;
    }
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Roll error:', error);
    res.status(400).json({ error: error instanceof Error ? error.message : 'Failed to roll dice' });
  } finally {
    client.release();
  }
});

// POST /game/:id/bot/:botId/action - Handle bot actions
router.post('/game/:id/bot/:botId/action', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const gameId = parseInt(req.params.id);
    const botId = parseInt(req.params.botId);

    // Get current game state
    const [game, players, properties] = await Promise.all([
      getGame(gameId),
      getGamePlayers(gameId),
      getGameProperties(gameId)
    ]);

    if (!game) {
      res.status(404).json({ error: 'Game not found' });
      return;
    }

    // Get bot player
    const bot = players.find(p => p.id === botId);
    if (!bot || !bot.is_bot) {
      res.status(400).json({ error: 'Invalid bot player' });
      return;
    }

    // Get current property
    const currentProperty = properties.find(p => p.position === bot.position) || null;

    // Get bot decision
    const decision = await BotService.makeDecision(bot, game.game_state, currentProperty, properties);

    let message = '';
    let success = true;

    // Execute bot decision
    switch (decision.action) {
      case 'buy':
        if (decision.property) {
          try {
            await buyProperty(gameId, botId, decision.property.position);
            message = `decided to buy ${decision.property.name}`;
          } catch (error) {
            success = false;
            message = `couldn't buy ${decision.property.name}`;
          }
        }
        break;

      case 'pay_rent':
        if (decision.property) {
          try {
            await payRent(gameId, botId, decision.property.position, 1); // FIXME: get bot dice roll
            message = `paid rent for ${decision.property.name}`;
          } catch (error) {
            success = false;
            message = `couldn't pay rent for ${decision.property.name}`;
          }
        }
        break;

      case 'pass':
        message = 'decided to pass';
        break;

      case 'end_turn':
        message = 'ended their turn';
        break;
    }

    await client.query('COMMIT');
    res.json({ success, message });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Bot action error:', error);
    res.status(400).json({ error: error instanceof Error ? error.message : 'Failed to execute bot action' });
  } finally {
    client.release();
  }
});

// POST /game/:id/properties/:position/buy - Buy a property
router.post('/game/:id/properties/:position/buy', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const gameId = parseInt(req.params.id);
    const position = parseInt(req.params.position);

    if (isNaN(gameId) || isNaN(position)) {
      res.status(400).json({ error: 'Invalid parameters' });
      return;
    }

    const [game, players] = await Promise.all([
      getGame(gameId),
      getGamePlayers(gameId)
    ]);

    if (!game) {
      res.status(404).json({ error: 'Game not found' });
      return;
    }

    // Find the current player
    const currentPlayer = players.find(p => p.user_id === req.session.userId);
    if (!currentPlayer) {
      res.status(403).json({ error: 'Not a player in this game' });
      return;
    }

    // Check if property is already owned
    const existingProperty = await getPropertyByPosition(gameId, position);
    if (existingProperty?.owner_id != null) {
      res.status(400).json({ error: 'Property already owned' });
      return;
    }

    // Buy the property
    const property = await buyProperty(gameId, position, currentPlayer.id);
    
    // Return the updated property and player data
    res.json({
      success: true,
      property,
      playerBalance: currentPlayer.balance
    });
  } catch (error) {
    console.error('Property purchase error:', error);
    res.status(500).json({ error: 'Failed to purchase property' });
  }
});

// PUT /game/:gameId/properties/:propertyId/rent - Pay rent for a property
router.put('/game/:gameId/properties/:propertyId/rent', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const gameId = parseInt(req.params.gameId);
    const propertyId = parseInt(req.params.propertyId);
    const userId = req.session.userId!;
    const body = req.body;

    // Get current player
    const players = await getGamePlayers(gameId);
    const currentPlayer = players.find(p => p.user_id === userId);
    if (!currentPlayer) {
      res.status(400).json({ error: 'Player not found in game' });
      return;
    }

    // Pay rent and get updated balances
    const { tenantBalance, ownerBalance, rentAmount } = await payRent(gameId, currentPlayer.id, propertyId, body.dice_roll);

    res.json({
      success: true,
      tenantBalance,
      ownerBalance,
      rentAmount
    });
  } catch (error) {
    console.error('Rent payment error:', error);
    res.status(400).json({ error: error instanceof Error ? error.message : 'Failed to pay rent' });
  }
});

// POST /game/:id/end-turn - Reload page after ending a turn
router.post('/game/:id/end-turn', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const roomId = req.body.roomId;
    const playerId = req.body.playerId;
    const gameState = req.body.gameState;

    console.log("Attempting to end turn-RELOAD page " + roomId + " called by playerId: " + playerId);

    req.app.get("io").to(`testroom`).emit(`reload:${roomId}`, {
      sender: playerId, 
      gameState: gameState,
    });

    res.status(200).send();
  } catch (error) {
    console.error('End turn/reload:', error);
    res.status(500).json({ error: 'Failed to end turn/reload page' });
  }
});

export default router; 