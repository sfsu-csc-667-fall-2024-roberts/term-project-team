import express, { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth';
import * as dbService from '../db/services/dbService';
import { Property } from '../../shared/types';

const router = express.Router();

router.get('/:gameId', requireAuth, async (req: Request, res: Response) => {
  try {
    const gameId = parseInt(req.params.gameId);
    if (isNaN(gameId)) {
      res.status(400).json({ error: 'Invalid game ID' });
      return;
    }
    const properties = await dbService.getGameProperties(gameId);
    res.json(properties);
  } catch (error) {
    console.error('Error fetching properties:', error);
    res.status(500).json({ error: 'Failed to fetch properties' });
  }
});

router.post('/buy', requireAuth, async (req: Request, res: Response) => {
  try {
    const { gameId, position, playerId } = req.body;
    if (!gameId || !position || !playerId) {
      res.status(400).json({ error: 'Missing required parameters' });
      return;
    }
    const result = await dbService.buyProperty(gameId, position, playerId);
    res.json(result);
  } catch (error) {
    console.error('Error buying property:', error);
    res.status(500).json({ error: 'Failed to buy property' });
  }
});

export default router;