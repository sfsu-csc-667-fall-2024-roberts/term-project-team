import express from 'express';
import { requireAuth } from '../middleware/auth';
import { 
  listGames, 
  listMyGames, 
  createGame, 
  addPlayerToGame,
  getGame
} from '../db/services/dbService';
import '../types/session';

const router = express.Router();

// GET /lobby - Show game lobby
router.get('/lobby', requireAuth, async (req, res) => {
  try {
    const [allGames, myGames] = await Promise.all([
      listGames(),
      listMyGames(req.session.userId!)
    ]);

    res.render('lobby', { 
      allGames, 
      myGames,
      error: null 
    });
  } catch (error) {
    console.error('Lobby error:', error);
    res.render('lobby', { 
      allGames: [], 
      myGames: [],
      error: 'Failed to load games' 
    });
  }
});

// POST /games - Create a new game
router.post('/games', requireAuth, async (req, res) => {
  try {
    const game = await createGame(req.session.userId!);
    // Add the creator as the first player
    await addPlayerToGame(game.id, req.session.userId!);
    res.redirect(`/game/${game.id}`);
  } catch (error) {
    console.error('Game creation error:', error);
    res.redirect('/lobby?error=failed-to-create-game');
  }
});

// POST /games/:id/join - Join an existing game
router.post('/games/:id/join', requireAuth, async (req, res) => {
  try {
    const gameId = parseInt(req.params.id);
    if (isNaN(gameId)) {
      return res.redirect('/lobby?error=invalid-game');
    }

    const game = await getGame(gameId);
    if (!game) {
      return res.redirect('/lobby?error=game-not-found');
    }

    if (game.status !== 'waiting') {
      return res.redirect('/lobby?error=game-already-started');
    }

    await addPlayerToGame(gameId, req.session.userId!);
    res.redirect(`/game/${gameId}`);
  } catch (error) {
    console.error('Game join error:', error);
    res.redirect('/lobby?error=failed-to-join-game');
  }
});

export default router; 