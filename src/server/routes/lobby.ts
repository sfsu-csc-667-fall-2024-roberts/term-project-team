import express from 'express';
import { requireAuth } from '../middleware/auth';
import { pool } from '../db/config';
import { createGame, getGames, joinGame, createBotPlayer, getUserById, deleteGame, leaveGame } from '../db/services/dbService';
import session from 'express-session';
import { PoolClient } from 'pg';

type TypedSession = session.Session & {
  userId?: number;
  username?: string;
  returnTo?: string;
};

const router = express.Router();

// GET /lobby - Show game lobby
router.get('/lobby', requireAuth, async (req, res) => {
  try {
    console.log('Loading lobby view...');
    const games = await getGames();
    console.log('Available games:', games.map(g => ({ id: g.id, status: g.status, owner: g.owner_id })));
    res.render('lobby', { 
      games,
      error: req.query.error,
      success: req.query.success
    });
  } catch (error) {
    console.error('Lobby view error:', error);
    res.redirect('/?error=lobby-error');
  }
});

// POST /games - Create a new game
router.post('/games', requireAuth, async (req, res) => {
  const client = await pool.connect();
  try {
    console.log('\n=== Creating New Game ===');
    await client.query('BEGIN');
    
    const typedSession = req.session as TypedSession;
    const userId = typedSession.userId;
    
    console.log('Session details:', {
      sessionId: req.sessionID,
      userId,
      username: typedSession.username,
      session: typedSession
    });

    if (!userId) {
      console.error('No user ID in session');
      throw new Error('Not authenticated');
    }

    // First verify user exists in database
    const userCheck = await client.query('SELECT * FROM users WHERE id = $1', [userId]);
    console.log('User check query:', {
      query: 'SELECT * FROM users WHERE id = $1',
      params: [userId]
    });
    console.log('User check result:', {
      userId,
      found: userCheck.rows.length > 0,
      userData: userCheck.rows[0],
      rowCount: userCheck.rowCount
    });

    if (!userCheck.rows[0]) {
      // Additional check - list all users in database
      const allUsers = await client.query('SELECT id, username FROM users');
      console.error('User not found in database. All users:', allUsers.rows);
      
      // Check if session is stale
      if (typedSession.username) {
        const userByUsername = await client.query('SELECT * FROM users WHERE username = $1', [typedSession.username]);
        if (userByUsername.rows[0]) {
          console.log('Found user by username, updating session userId');
          typedSession.userId = userByUsername.rows[0].id;
          await new Promise<void>((resolve, reject) => {
            req.session.save((err) => {
              if (err) reject(err);
              else resolve();
            });
          });
          // Retry with corrected userId
          return res.redirect(307, '/games');
        }
      }
      
      throw new Error(`User ${userId} not found in database`);
    }

    const botCount = parseInt(req.body.botCount) || 0;
    const botDifficulty = req.body.botDifficulty || 'medium';
    const botStrategy = req.body.botStrategy || 'balanced';

    console.log('Game configuration:', {
      botCount,
      botDifficulty,
      botStrategy
    });

    // Get user info using transaction client
    const userResult = await client.query('SELECT * FROM users WHERE id = $1', [userId]);
    const user = userResult.rows[0];
    if (!user) {
      throw new Error(`User ${userId} not found in transaction context`);
    }
    console.log('Creating game for user:', { userId: user.id, username: user.username });

    // Create the game using the transaction client
    const game = await createGame(userId, client as PoolClient);
    console.log('Game created:', { gameId: game.id, ownerId: game.owner_id });
    
    // Add bot players if requested
    if (botCount > 0) {
      console.log(`Adding ${botCount} bots to game ${game.id}`);
      for (let i = 0; i < botCount; i++) {
        const bot = await createBotPlayer(game.id, botStrategy, botDifficulty, client as PoolClient);
        console.log(`Bot ${i + 1} created:`, bot);
      }
    }

    await client.query('COMMIT');
    console.log('Transaction committed successfully');
    console.log(`Redirecting to game ${game.id}`);
    res.redirect(`/game/${game.id}`);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Game creation error:', error);
    // Add more detailed error information to the redirect
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    res.redirect(`/lobby?error=failed-to-create-game&details=${encodeURIComponent(errorMessage)}`);
  } finally {
    client.release();
    console.log('=== Game Creation Complete ===\n');
  }
});

// POST /games/:id/join - Join an existing game
router.post('/games/:id/join', requireAuth, async (req, res) => {
  try {
    console.log('\n=== Joining Game ===');
    const gameId = parseInt(req.params.id);
    console.log('Attempting to join game:', { gameId, rawId: req.params.id });

    if (isNaN(gameId)) {
      console.error('Invalid game ID:', req.params.id);
      return res.redirect('/lobby?error=invalid-game');
    }

    const typedSession = req.session as TypedSession;
    const userId = typedSession.userId;
    
    console.log('Session details:', {
      userId,
      session: typedSession
    });

    if (!userId) {
      throw new Error('Not authenticated');
    }
    
    // Verify user exists
    const user = await getUserById(userId);
    if (!user) {
      console.error('User not found:', userId);
      req.session.destroy(() => {});
      return res.redirect('/login?error=invalid-user');
    }
    console.log('User verified:', { userId: user.id, username: user.username });

    await joinGame(gameId, userId);
    console.log('Successfully joined game');
    console.log(`Redirecting to game ${gameId}`);
    res.redirect(`/game/${gameId}`);
  } catch (error) {
    console.error('Game join error:', error);
    res.redirect('/lobby?error=join-failed');
  } finally {
    console.log('=== Join Game Complete ===\n');
  }
});

// POST /games/:id/delete - Delete a game (owner only)
router.post('/games/:id/delete', requireAuth, async (req, res) => {
  try {
    console.log('\n=== Deleting Game ===');
    const gameId = parseInt(req.params.id);
    console.log('Attempting to delete game:', { gameId, rawId: req.params.id });

    if (isNaN(gameId)) {
      console.error('Invalid game ID:', req.params.id);
      return res.redirect('/lobby?error=invalid-game');
    }

    const typedSession = req.session as TypedSession;
    const userId = typedSession.userId;
    
    console.log('Session details:', {
      userId,
      session: typedSession
    });

    if (!userId) {
      throw new Error('Not authenticated');
    }

    await deleteGame(gameId, userId);
    console.log('Game successfully deleted');
    res.redirect('/lobby?success=game-deleted');
  } catch (error) {
    console.error('Game deletion error:', error);
    res.redirect('/lobby?error=delete-failed');
  } finally {
    console.log('=== Delete Game Complete ===\n');
  }
});

// POST /games/:id/leave - Leave a game
router.post('/games/:id/leave', requireAuth, async (req, res) => {
  try {
    console.log('\n=== Leaving Game ===');
    const gameId = parseInt(req.params.id);
    console.log('Attempting to leave game:', { gameId, rawId: req.params.id });

    if (isNaN(gameId)) {
      console.error('Invalid game ID:', req.params.id);
      return res.redirect('/lobby?error=invalid-game');
    }

    const typedSession = req.session as TypedSession;
    const userId = typedSession.userId;
    
    console.log('Session details:', {
      userId,
      session: typedSession
    });

    if (!userId) {
      throw new Error('Not authenticated');
    }

    await leaveGame(gameId, userId);
    console.log('Successfully left game');
    res.redirect('/lobby?success=game-left');
  } catch (error) {
    console.error('Game leave error:', error);
    res.redirect('/lobby?error=leave-failed');
  } finally {
    console.log('=== Leave Game Complete ===\n');
  }
});

export default router; 