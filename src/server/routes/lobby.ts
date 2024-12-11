import express from 'express';
import { requireAuth } from '../middleware/auth';
import { pool } from '../db/config';
import { createGame, getGames, joinGame, createBotPlayer, getUserById } from '../db/services/dbService';

const router = express.Router();

// GET /lobby - Show game lobby
router.get('/lobby', requireAuth, async (req, res) => {
  try {
    const games = await getGames();
    res.render('lobby', { games });
  } catch (error) {
    console.error('Lobby view error:', error);
    res.redirect('/?error=lobby-error');
  }
});

// POST /games - Create a new game
router.post('/games', requireAuth, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    const userId = req.session.userId!;
    const botCount = parseInt(req.body.botCount) || 0;
    const botDifficulty = req.body.botDifficulty || 'medium';
    const botStrategy = req.body.botStrategy || 'balanced';

    // Get user info
    const user = await getUserById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Create the game
    const game = await createGame(userId);
    
    // Add bot players if requested
    for (let i = 0; i < botCount; i++) {
      await createBotPlayer(game.id, i + 1);
    }

    await client.query('COMMIT');
    res.redirect(`/game/${game.id}`);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Game creation error:', error);
    res.redirect('/lobby?error=failed-to-create-game');
  } finally {
    client.release();
  }
});

// POST /games/:id/join - Join an existing game
router.post('/games/:id/join', requireAuth, async (req, res) => {
  try {
    const gameId = parseInt(req.params.id);
    if (isNaN(gameId)) {
      return res.redirect('/lobby?error=invalid-game');
    }

    const userId = req.session.userId!;
    
    // Verify user exists
    const user = await getUserById(userId);
    if (!user) {
      req.session.destroy(() => {});
      return res.redirect('/login?error=invalid-user');
    }

    await joinGame(gameId, userId);
    res.redirect(`/game/${gameId}`);
  } catch (error) {
    console.error('Game join error:', error);
    res.redirect('/lobby?error=join-failed');
  }
});

export default router; 