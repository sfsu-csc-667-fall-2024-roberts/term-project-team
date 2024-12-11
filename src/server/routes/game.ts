import express, { Request, Response } from 'express';
import { requireAuth } from '../middleware/auth';
import { getGame, getGamePlayers, getGameProperties, buyProperty, getPropertyByPosition, payRent } from '../db/services/dbService';
import { pool } from '../db/config';

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
    if (existingProperty) {
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

// POST /game/:id/reset-balance - Reset player balance (for testing)
router.post('/game/:id/reset-balance', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const gameId = parseInt(req.params.id);
    if (isNaN(gameId)) {
      res.status(400).json({ error: 'Invalid game ID' });
      return;
    }

    // First check if player exists
    const players = await getGamePlayers(gameId);
    const currentPlayer = players.find(p => p.user_id === req.session.userId);
    
    if (!currentPlayer) {
      res.status(404).json({ error: 'Player not found in this game' });
      return;
    }

    // Update the balance
    const result = await pool.query(
      'UPDATE players SET balance = $1 WHERE game_id = $2 AND user_id = $3 RETURNING balance',
      [1500, gameId, req.session.userId]
    );

    if (result.rows.length === 0) {
      res.status(500).json({ error: 'Failed to update balance' });
      return;
    }

    res.json({
      success: true,
      balance: result.rows[0].balance
    });
  } catch (error) {
    console.error('Reset balance error:', error);
    res.status(500).json({ error: 'Failed to reset balance' });
  }
});

// PUT /game/:id/properties/:position/rent - Pay rent
router.put('/game/:id/properties/:position/rent', requireAuth, async (req: Request, res: Response): Promise<void> => {
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
    if (!existingProperty?.owner_id) {
      res.status(400).json({ error: 'Property not owned' });
      return;
    }

    // Pay the rent
    const rent = await payRent(gameId, position, currentPlayer.id, existingProperty.owner_id);

    // Return the updated property and player data
    res.json({
      success: true,
      playerBalance: rent.tenantBalance,
      ownerBalance: rent.ownerBalance
    });
  } catch (error) {
    console.error('Pay rent error:', error);
    res.status(500).json({ error: 'Failed to pay rent' });
  }
});

export default router; 