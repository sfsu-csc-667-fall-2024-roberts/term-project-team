import express, { Request, Response, Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { pool } from '../db/config';
import { getGame, getGamePlayers, getGameProperties, buyProperty, getPropertyByPosition, payRent } from '../db/services/dbService';
import { Game, GameState } from '../db/models/types';
import { BOARD_SPACES } from '../../shared/boardData';
import { BotService } from '../services/botService';

const router: Router = express.Router();

// GET /game/:id/state - Get game state as JSON
router.get('/:id/state', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    console.log('Getting game state for game:', req.params.id);
    const gameId = parseInt(req.params.id);
    const userId = req.session.userId;

    if (!userId) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const game = await getGame(gameId);
    if (!game) {
      console.error('Game not found:', gameId);
      res.status(404).json({ error: 'Game not found' });
      return;
    }

    const [players, properties] = await Promise.all([
      getGamePlayers(gameId),
      getGameProperties(gameId)
    ]);

    const currentPlayer = players.find(p => p.user_id === userId);
    if (!currentPlayer) {
      res.status(403).json({ error: 'Not in game' });
      return;
    }

    // Initialize game state if it doesn't exist
    let gameState = game.game_state || {
      phase: 'waiting',
      current_player_index: 0,
      dice_rolls: [],
      turn_order: []
    };

    // Ensure game state has all required properties
    gameState = {
      phase: gameState.phase || 'waiting',
      current_player_index: typeof gameState.current_player_index === 'number' ? gameState.current_player_index : 0,
      dice_rolls: Array.isArray(gameState.dice_rolls) ? gameState.dice_rolls : [],
      turn_order: Array.isArray(gameState.turn_order) ? gameState.turn_order : []
    };

    // Sort players by turn order if it exists
    const sortedPlayers = gameState.turn_order.length > 0
      ? gameState.turn_order.map(playerId => players.find(p => p.id === playerId)).filter(Boolean)
      : players;

    // Log the state we're about to send
    console.log('Game state being sent:', {
      phase: gameState.phase,
      currentPlayerIndex: gameState.current_player_index,
      diceRolls: gameState.dice_rolls,
      turnOrder: gameState.turn_order,
      playerCount: sortedPlayers.length,
      currentPlayerId: currentPlayer.id
    });

    const response = {
      gameState,
      players: sortedPlayers,
      properties,
      currentUserId: userId,
      currentPlayerId: currentPlayer.id
    };

    res.json(response);
  } catch (error) {
    console.error('Game state error:', error);
    res.status(500).json({ error: 'Failed to get game state' });
  }
});

// GET /:id - Show game page
router.get('/:id', requireAuth, async (req: Request, res: Response): Promise<void> => {
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

// POST /:id/roll - Handle dice roll
router.post('/:id/roll', requireAuth, async (req: Request, res: Response): Promise<void> => {
  console.log('\n=== Roll Request Started ===');
  const gameId = parseInt(req.params.id);
  const userId = req.session.userId;
  const { botId } = req.body;

  console.log('Roll request details:', {
    gameId,
    userId,
    botId,
    rawBody: req.body,
    url: req.url,
    method: req.method
  });

  if (!userId) {
    console.error('No user ID in session');
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    console.log('Transaction started');

    // Get current game state and all players
    console.log('Fetching game and players data...');
    const [game, players] = await Promise.all([
      client.query('SELECT * FROM games WHERE id = $1 FOR UPDATE', [gameId]),
      client.query('SELECT * FROM players WHERE game_id = $1 ORDER BY id', [gameId])
    ]);

    if (!game.rows[0]) {
      console.error('Game not found:', gameId);
      res.status(404).json({ error: 'Game not found' });
      return;
    }

    console.log('Game data:', {
      id: game.rows[0].id,
      status: game.rows[0].status,
      gameState: game.rows[0].game_state
    });

    console.log('Players data:', players.rows.map(p => ({
      id: p.id,
      username: p.username,
      isBot: p.is_bot,
      userId: p.user_id,
      position: p.position
    })));

    // Initialize or parse game state
    let gameState: GameState = game.rows[0].game_state || {
      phase: 'waiting',
      current_player_index: 0,
      dice_rolls: [],
      turn_order: []
    };

    console.log('Current game state:', gameState);

    // Get current player (either human or bot)
    const parsedBotId = botId ? parseInt(botId.toString()) : null;
    console.log('Looking for player:', { parsedBotId, userId });

    const player = parsedBotId 
      ? players.rows.find(p => p.id === parsedBotId && p.is_bot)
      : players.rows.find(p => p.user_id === userId);

    if (!player) {
      console.error('Player not found:', { 
        parsedBotId, 
        userId,
        allPlayers: players.rows.map(p => ({ id: p.id, userId: p.user_id, isBot: p.is_bot }))
      });
      res.status(404).json({ error: 'Player not found in game' });
      return;
    }

    console.log('Found player:', {
      id: player.id,
      username: player.username,
      isBot: player.is_bot,
      userId: player.user_id,
      position: player.position
    });

    // Check if player has already rolled in initial phase
    if (gameState.phase === 'waiting') {
      const existingRoll = gameState.dice_rolls.find(r => r.playerId === player.id);
      if (existingRoll) {
        console.error('Player has already rolled:', {
          player: player.username,
          playerId: player.id,
          existingRoll,
          allRolls: gameState.dice_rolls
        });
        res.status(400).json({ error: 'You have already rolled' });
        return;
      }
    }

    // Generate roll
    const roll = Math.floor(Math.random() * 6) + 1 + Math.floor(Math.random() * 6) + 1;
    console.log('Roll result:', {
      player: player.username,
      playerId: player.id,
      roll,
      isBot: player.is_bot
    });

    // Update game state based on phase
    if (gameState.phase === 'waiting') {
      console.log('Processing roll in waiting phase');
      // Add roll to initial roll phase
      gameState.dice_rolls.push({ playerId: player.id, roll });
      console.log('Updated dice rolls:', gameState.dice_rolls);

      // If all players have rolled, determine turn order
      if (gameState.dice_rolls.length === players.rows.length) {
        console.log('All players have rolled, determining turn order');
        // Sort players by roll value (highest to lowest)
        const sortedRolls = [...gameState.dice_rolls].sort((a, b) => b.roll - a.roll);
        gameState.turn_order = sortedRolls.map(r => r.playerId);
        gameState.phase = 'playing';
        console.log('New game state after turn order:', {
          phase: gameState.phase,
          turnOrder: gameState.turn_order,
          sortedRolls
        });
      }
    } else {
      console.log('Processing roll in gameplay phase');
      // Update player position in gameplay phase
      const newPosition = (player.position + roll) % 40;
      await client.query(
        'UPDATE players SET position = $1 WHERE id = $2',
        [newPosition, player.id]
      );
      player.position = newPosition;
      console.log('Updated player position:', {
        player: player.username,
        oldPosition: player.position,
        newPosition,
        roll
      });
    }

    // Update game state in database
    console.log('Updating game state in database:', gameState);
    await client.query(
      'UPDATE games SET game_state = $1 WHERE id = $2',
      [gameState, gameId]
    );

    await client.query('COMMIT');
    console.log('Transaction committed');

    // Send response with updated state
    const response = {
      roll,
      gameState,
      players: players.rows,
      newPosition: player.position
    };
    console.log('Sending response:', response);
    res.json(response);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Roll error:', error);
    res.status(500).json({ error: 'Failed to process roll' });
  } finally {
    client.release();
    console.log('=== Roll Request Completed ===\n');
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
            await payRent(gameId, botId, decision.property.position);
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

// PUT /game/:gameId/properties/:propertyId/rent - Pay rent for a property
router.put('/game/:gameId/properties/:propertyId/rent', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const gameId = parseInt(req.params.gameId);
    const propertyId = parseInt(req.params.propertyId);
    const userId = req.session.userId!;

    // Get current player
    const players = await getGamePlayers(gameId);
    const currentPlayer = players.find(p => p.user_id === userId);
    if (!currentPlayer) {
      res.status(400).json({ error: 'Player not found in game' });
      return;
    }

    // Pay rent and get updated balances
    const { tenantBalance, ownerBalance } = await payRent(gameId, currentPlayer.id, propertyId);

    res.json({ 
      success: true,
      tenantBalance,
      ownerBalance
    });
  } catch (error) {
    console.error('Rent payment error:', error);
    res.status(400).json({ error: error instanceof Error ? error.message : 'Failed to pay rent' });
  }
});

export default router; 