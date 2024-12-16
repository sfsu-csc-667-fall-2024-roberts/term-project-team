import express, { Request, Response, Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { pool } from '../db/config';
import { GameState, Player } from '../../shared/types';
import { BOARD_SPACES } from '../../shared/boardData';

const router: Router = express.Router();

// Initialize game properties
async function initializeGameProperties(client: any, gameId: number): Promise<void> {
  console.log('=== Initializing Game Properties ===');
  
  for (const space of BOARD_SPACES) {
    if (space.type === 'property' || space.type === 'railroad' || space.type === 'utility') {
      await client.query(
        `INSERT INTO properties (
          game_id,
          position,
          name,
          type,
          price,
          rent_levels,
          house_cost,
          hotel_cost,
          mortgage_value,
          color_group,
          owner_id,
          is_mortgaged,
          house_count,
          has_hotel
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
        [
          gameId,
          space.position,
          space.name,
          space.type,
          space.price || 0,
          space.rentLevels || [],
          space.houseCost || 0,
          space.hotelCost || 0,
          space.mortgageValue || 0,
          space.colorGroup || null,
          null,
          false,
          0,
          false
        ]
      );
    }
  }
  
  console.log('Properties initialized successfully');
}

// Create a new game
async function createGame(ownerId: number): Promise<number> {
  const client = await pool.connect();
  console.log('=== Creating New Game ===');
  console.log('Owner ID:', ownerId);
  
  try {
    await client.query('BEGIN');
    
    const initialGameState = {
      phase: 'waiting',
      currentPlayerIndex: 0,
      diceRolls: [],
      turnOrder: [],
      players: [],
      properties: [],
      doublesCount: 0,
      jailTurns: {},
      bankruptPlayers: [],
      jailFreeCards: {},
      turnCount: 0,
      freeParkingPot: 0
    };
    
    console.log('Initial game state:', initialGameState);
    
    const result = await client.query(
      'INSERT INTO games (owner_id, status, game_state) VALUES ($1, $2, $3) RETURNING id',
      [ownerId, 'waiting', initialGameState]
    );
    
    const gameId = result.rows[0].id;
    console.log('Game created:', result.rows[0]);
    
    // Initialize properties for the game
    await initializeGameProperties(client, gameId);
    
    await client.query('COMMIT');
    return gameId;
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating game:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Get all available games
async function getGames(): Promise<any[]> {
  try {
    const result = await pool.query(`
      SELECT 
        g.*,
        COUNT(p.id) as player_count,
        COUNT(CASE WHEN p.is_bot = false THEN 1 END) as human_count,
        COUNT(CASE WHEN p.is_bot = true THEN 1 END) as bot_count
      FROM games g 
      LEFT JOIN players p ON g.id = p.game_id 
      WHERE g.status = $1 
      GROUP BY g.id
    `, ['waiting']);
    return result.rows;
  } catch (error) {
    console.error('Error getting games:', error);
    return [];
  }
}

// Join a game
async function joinGame(gameId: number, userId: number, username: string): Promise<boolean> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Check if player is already in game
    const existingPlayer = await client.query(
      'SELECT * FROM players WHERE game_id = $1 AND user_id = $2',
      [gameId, userId]
    );
    
    if (existingPlayer.rows.length > 0) {
      return true;
    }
    
    // Add player to game
    await client.query(
      'INSERT INTO players (game_id, user_id, username, position, money, is_bot) VALUES ($1, $2, $3, $4, $5, $6)',
      [gameId, userId, username, 0, 1500, false]
    );
    
    await client.query('COMMIT');
    return true;
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error joining game:', error);
    return false;
  } finally {
    client.release();
  }
}

// Create a bot player
async function createBotPlayer(gameId: number, botName: string, strategy: string = 'default', difficulty: string = 'medium'): Promise<boolean> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    await client.query(
      'INSERT INTO players (game_id, username, position, money, is_bot, bot_strategy, bot_difficulty) VALUES ($1, $2, $3, $4, $5, $6, $7)',
      [gameId, botName, 0, 1500, true, strategy, difficulty]
    );
    
    await client.query('COMMIT');
    return true;
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating bot player:', error);
    return false;
  } finally {
    client.release();
  }
}

// Get user by ID
async function getUserById(userId: number): Promise<any> {
  try {
    const result = await pool.query(
      'SELECT * FROM users WHERE id = $1',
      [userId]
    );
    return result.rows[0];
  } catch (error) {
    console.error('Error getting user:', error);
    return null;
  }
}

// Delete a game
async function deleteGame(gameId: number, userId: number): Promise<boolean> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Check if user owns the game
    const game = await client.query(
      'SELECT * FROM games WHERE id = $1 AND owner_id = $2',
      [gameId, userId]
    );
    
    if (game.rows.length === 0) {
      return false;
    }
    
    // Delete game and all related data
    await client.query('DELETE FROM players WHERE game_id = $1', [gameId]);
    await client.query('DELETE FROM properties WHERE game_id = $1', [gameId]);
    await client.query('DELETE FROM games WHERE id = $1', [gameId]);
    
    await client.query('COMMIT');
    return true;
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error deleting game:', error);
    return false;
  } finally {
    client.release();
  }
}

// Leave a game
async function leaveGame(gameId: number, userId: number): Promise<boolean> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    await client.query(
      'DELETE FROM players WHERE game_id = $1 AND user_id = $2',
      [gameId, userId]
    );
    
    await client.query('COMMIT');
    return true;
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error leaving game:', error);
    return false;
  } finally {
    client.release();
  }
}

// Routes
router.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const games = await getGames();
    const typedSession = req.session as any;
    res.render('lobby', { 
      games,
      user: {
        id: typedSession.userId,
        username: typedSession.username
      }
    });
  } catch (error) {
    console.error('Error rendering lobby:', error);
    res.status(500).send('Server error');
  }
});

router.post('/create', requireAuth, async (req: Request, res: Response) => {
  console.log('=== Create Game Route ===');
  try {
    const typedSession = req.session as any;
    console.log('User session:', typedSession);
    
    const gameId = await createGame(typedSession.userId);
    console.log('Game created with ID:', gameId);
    
    const joinResult = await joinGame(gameId, typedSession.userId, typedSession.username);
    console.log('Join game result:', joinResult);
    
    res.redirect(`/games/${gameId}`);
  } catch (error) {
    console.error('Error in create game route:', error);
    res.status(500).send('Server error');
  }
});

router.post('/join/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const gameId = parseInt(req.params.id);
    const typedSession = req.session as any;
    const success = await joinGame(gameId, typedSession.userId, typedSession.username);
    if (success) {
      res.redirect(`/games/${gameId}`);
    } else {
      res.redirect('/lobby?error=join-failed');
    }
  } catch (error) {
    console.error('Error joining game:', error);
    res.status(500).send('Server error');
  }
});

router.post('/leave/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const gameId = parseInt(req.params.id);
    const typedSession = req.session as any;
    const success = await leaveGame(gameId, typedSession.userId);
    if (success) {
      res.redirect('/lobby');
    } else {
      res.status(400).send('Failed to leave game');
    }
  } catch (error) {
    console.error('Error leaving game:', error);
    res.status(500).send('Server error');
  }
});

router.post('/delete/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const gameId = parseInt(req.params.id);
    const typedSession = req.session as any;
    const success = await deleteGame(gameId, typedSession.userId);
    if (success) {
      res.redirect('/lobby');
    } else {
      res.status(400).send('Failed to delete game');
    }
  } catch (error) {
    console.error('Error deleting game:', error);
    res.status(500).send('Server error');
  }
});

router.post('/add-bot/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const gameId = parseInt(req.params.id);
    const { botName, strategy, difficulty } = req.body;
    const success = await createBotPlayer(gameId, botName, strategy, difficulty);
    if (success) {
      res.redirect(`/games/${gameId}`);
    } else {
      res.status(400).send('Failed to add bot');
    }
  } catch (error) {
    console.error('Error adding bot:', error);
    res.status(500).send('Server error');
  }
});

export default router; 