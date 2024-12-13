import express from 'express';
import { requireAuth } from '../middleware/auth';
import { pool } from '../db/config';
import { createGame, getGames, joinGame, createBotPlayer, getUserById, deleteGame, leaveGame } from '../db/services/dbService';
import session from 'express-session';

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
    
    console.log('Request details:', {
      userId,
      body: req.body,
      session: typedSession
    });

    if (!userId) {
      throw new Error('Not authenticated');
    }

    const botCount = parseInt(req.body.botCount) || 0;
    const botDifficulty = req.body.botDifficulty || 'medium';
    const botStrategy = req.body.botStrategy || 'balanced';

    console.log('Game configuration:', {
      botCount,
      botDifficulty,
      botStrategy
    });

    // Get user info
    const user = await getUserById(userId);
    if (!user) {
      throw new Error('User not found');
    }
    console.log('Creating game for user:', { userId: user.id, username: user.username });

    // Create the game
    const game = await createGame(userId);
    console.log('Game created:', { gameId: game.id, ownerId: game.owner_id });
    
    // Add bot players if requested
    if (botCount > 0) {
      console.log(`Adding ${botCount} bots to game ${game.id}`);
      for (let i = 0; i < botCount; i++) {
        const bot = await createBotPlayer(game.id, botStrategy, botDifficulty);
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
    res.redirect('/lobby?error=failed-to-create-game');
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