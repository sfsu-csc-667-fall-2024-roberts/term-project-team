import express, { Request, Response, Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { pool } from '../db/config';
import { getGame, getGamePlayers, getGameProperties, buyProperty, getPropertyByPosition, payRent } from '../db/services/dbService';
import { Game, GameState } from '../db/models/types';
import { BOARD_SPACES } from '../../shared/boardData';
import { BotService } from '../services/botService';
import session from 'express-session';

type TypedSession = session.Session & {
  userId?: number;
  username?: string;
  returnTo?: string;
};

const router: Router = express.Router();

// GET /:id/state - Get game state as JSON
router.get('/:id/state', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    console.log('Getting game state for game:', req.params.id);
    const gameId = parseInt(req.params.id);
    if (isNaN(gameId)) {
      console.error('Invalid game ID:', req.params.id);
      res.status(400).json({ error: 'Invalid game ID' });
      return;
    }

    const typedSession = req.session as TypedSession;
    const userId = typedSession.userId;

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

    res.json({
      gameId,
      currentUserId: userId,
      currentPlayerId: currentPlayer.id,
      players,
      properties,
      gameState
    });
  } catch (error) {
    console.error('Game state error:', error);
    res.status(500).json({ error: 'Failed to get game state' });
  }
});

// GET /:id - Show game page
router.get('/:id', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const gameId = parseInt(req.params.id);
    if (isNaN(gameId)) {
      console.error('Invalid game ID:', req.params.id);
      res.redirect('/lobby?error=invalid-game');
      return;
    }

    const typedSession = req.session as TypedSession;
    const userId = typedSession.userId;

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

    // Sort players: humans first, then bots
    const sortedPlayers = [...players].sort((a, b) => {
      if (a.is_bot === b.is_bot) return 0;
      return a.is_bot ? 1 : -1;
    });

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

    console.log('Rendering game view:', {
      gameId,
      userId,
      currentPlayerId: currentPlayer.id,
      playerCount: sortedPlayers.length,
      gameState
    });

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
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const gameId = parseInt(req.params.id);
    const typedSession = req.session as TypedSession;
    const userId = typedSession.userId;

    if (!userId) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    // Get game and validate
    const game = await getGame(gameId);
    if (!game) {
      res.status(404).json({ error: 'Game not found' });
      return;
    }

    // Get current player
    const players = await getGamePlayers(gameId);
    let currentPlayer;
    
    if (req.body.botId) {
      // If botId is provided, use that player
      const botId = parseInt(req.body.botId);
      currentPlayer = players.find(p => p.id === botId && p.is_bot);
      if (!currentPlayer) {
        res.status(404).json({ error: 'Bot not found' });
        return;
      }
    } else {
      // Otherwise use the logged in user's player
      currentPlayer = players.find(p => p.user_id === userId);
      if (!currentPlayer) {
        res.status(403).json({ error: 'Not in game' });
        return;
      }
    }

    // Get game state
    let gameState = game.game_state || {
      phase: 'waiting',
      current_player_index: 0,
      dice_rolls: [],
      turn_order: []
    };

    // Validate roll based on game phase
    if (gameState.phase === 'waiting') {
      if (gameState.dice_rolls.some(roll => roll.playerId === currentPlayer.id)) {
        res.status(400).json({ error: 'You have already rolled' });
        return;
      }
    } else if (gameState.phase === 'playing') {
      // Check if it's the player's turn
      if (gameState.turn_order[gameState.current_player_index] !== currentPlayer.id) {
        res.status(400).json({ error: 'Not your turn' });
        return;
      }
    }

    // Roll the dice
    const roll = Math.floor(Math.random() * 6) + 1;
    console.log(`Player ${currentPlayer.username} rolled a ${roll}`);

    if (gameState.phase === 'waiting') {
      // Add roll to initial rolls
      gameState.dice_rolls.push({
        playerId: currentPlayer.id,
        roll
      });

      // Check if all players have rolled
      if (gameState.dice_rolls.length === players.length) {
        // Sort players by roll value (descending) to determine turn order
        const sortedRolls = [...gameState.dice_rolls].sort((a, b) => b.roll - a.roll);
        gameState.turn_order = sortedRolls.map(roll => roll.playerId);
        gameState.phase = 'playing';
        console.log('All players have rolled. Turn order:', gameState.turn_order);
      }

      // Update game state
      await client.query('UPDATE games SET game_state = $1 WHERE id = $2', [gameState, gameId]);
      
      await client.query('COMMIT');
      res.json({ roll, gameState });
    } else if (gameState.phase === 'playing') {
      // Move player
      const newPosition = (currentPlayer.position + roll) % 40;
      await client.query('UPDATE players SET position = $1 WHERE id = $2', [newPosition, currentPlayer.id]);

      // Get updated player data
      const updatedPlayers = await getGamePlayers(gameId);
      const updatedCurrentPlayer = updatedPlayers.find(p => p.id === currentPlayer.id);

      if (!updatedCurrentPlayer) {
        throw new Error('Player not found after update');
      }

      await client.query('COMMIT');
      res.json({ 
        roll,
        gameState,
        newPosition,
        players: updatedPlayers,
        currentPlayer: updatedCurrentPlayer
      });
    }
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Roll error:', error);
    res.status(500).json({ error: 'Failed to process roll' });
  } finally {
    client.release();
  }
});

// POST /:id/bot/:botId/action - Handle bot actions
router.post('/:id/bot/:botId/action', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const gameId = parseInt(req.params.id);
    const botId = parseInt(req.params.botId);
    const typedSession = req.session as TypedSession;
    const userId = typedSession.userId!;

    // Get game and validate
    const game = await getGame(gameId);
    if (!game) {
      res.status(404).json({ error: 'Game not found' });
      return;
    }

    // Get players
    const players = await getGamePlayers(gameId);
    const bot = players.find(p => p.id === botId && p.is_bot);
    const requestingPlayer = players.find(p => p.user_id === userId);

    if (!bot || !bot.is_bot) {
      res.status(404).json({ error: 'Bot not found' });
      return;
    }

    if (!requestingPlayer) {
      res.status(403).json({ error: 'Not in game' });
      return;
    }

    // Get current property if any
    const currentProperty = await getPropertyByPosition(gameId, bot.position);
    const properties = await getGameProperties(gameId);

    // Get bot's decision
    const decision = await BotService.makeDecision(bot, game.game_state, currentProperty, properties);
    console.log(`Bot ${bot.username} decision:`, decision);

    let success = false;
    let message = '';

    // Execute bot's decision
    switch (decision.action) {
      case 'buy':
        if (decision.property) {
          try {
            await buyProperty(gameId, bot.id, decision.property.position);
            success = true;
            message = 'Property purchased';
          } catch (error) {
            success = false;
            message = 'Failed to buy property';
          }
        }
        break;
      case 'pay_rent':
        if (decision.property) {
          try {
            await payRent(gameId, bot.id, decision.property.position);
            success = true;
            message = 'Rent paid';
          } catch (error) {
            success = false;
            message = 'Failed to pay rent';
          }
        }
        break;
      case 'end_turn':
        success = true;
        message = 'Turn ended';
        break;
      default:
        success = true;
        message = 'No action taken';
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

export default router; 