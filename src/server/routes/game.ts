import express from 'express';
import { requireAuth } from '../middleware/auth';
import { getGame, getGamePlayers, getGameProperties } from '../db/services/dbService';

const router = express.Router();

// GET /game/:id - Show game page
router.get('/game/:id', requireAuth, async (req, res) => {
  try {
    const gameId = parseInt(req.params.id);
    if (isNaN(gameId)) {
      return res.redirect('/lobby?error=invalid-game');
    }

    const [game, players, properties] = await Promise.all([
      getGame(gameId),
      getGamePlayers(gameId),
      getGameProperties(gameId)
    ]);

    if (!game) {
      return res.redirect('/lobby?error=game-not-found');
    }

    // Check if the current user is a player in this game
    const isPlayerInGame = players.some(player => player.user_id === req.session.userId);
    if (!isPlayerInGame) {
      return res.redirect('/lobby?error=not-in-game');
    }

    res.render('game', { 
      game,
      players,
      properties,
      currentUserId: req.session.userId
    });
  } catch (error) {
    console.error('Game view error:', error);
    res.redirect('/lobby?error=game-error');
  }
});

export default router; 