import express, { Request, Response, RequestHandler } from 'express';
import { GameService } from '../services/gameService';
import { PlayerService } from '../services/playerService';
import { PropertyService } from '../services/propertyService';
import { requireAuth } from '../middleware/auth';
import { generateToken } from '../utils/auth';
import { AuthRequest } from '../../shared/types';

const router = express.Router();
const gameService = GameService.getInstance();
const playerService = PlayerService.getInstance();
const propertyService = PropertyService.getInstance();

// Create a new game
const createGameHandler: RequestHandler = async (req, res) => {
    try {
        const { name, maxPlayers } = req.body;
        const userId = (req as AuthRequest).user?.id;

        if (!userId) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }

        const game = await gameService.createGame(name, maxPlayers);
        res.status(201).json(game);
    } catch (error) {
        console.error('Error creating game:', error);
        res.status(500).json({ error: 'Failed to create game' });
    }
};

// Join a game
const joinGameHandler: RequestHandler = async (req, res) => {
    try {
        const gameId = parseInt(req.params.gameId);
        const userId = (req as AuthRequest).user?.id;

        if (!userId) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }

        const player = await playerService.getPlayerByUserId(userId);
        if (!player) {
            res.status(403).json({ error: 'Player not found' });
            return;
        }

        const result = await gameService.joinGame(gameId, player.id);
        res.json(result);
    } catch (error) {
        console.error('Error joining game:', error);
        res.status(500).json({ error: 'Failed to join game' });
    }
};

// Get game state
const getGameStateHandler: RequestHandler = async (req: Request, res: Response) => {
    try {
        const gameId = parseInt(req.params.gameId);
        const userId = (req as AuthRequest).user?.id;

        if (!userId) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }

        const gameState = await gameService.getGameState(gameId);
        res.json(gameState);
    } catch (error) {
        console.error('Error getting game state:', error);
        res.status(500).json({ error: 'Failed to get game state' });
    }
};

// Start game
export const startGameHandler = async (req: Request, res: Response): Promise<void> => {
    console.log('Start game request received');
    try {
        const gameId = parseInt(req.params.gameId);
        const userId = req.user?.id;

        console.log(`Starting game ${gameId} for user ${userId}`);

        if (!gameId || !userId) {
            console.error('Missing gameId or userId:', { gameId, userId });
            res.status(400).json({ error: 'Missing required parameters' });
            return;
        }

        const gameService = GameService.getInstance();
        console.log('Calling gameService.startGame');
        const result = await gameService.startGame(gameId, userId);
        console.log('Game started successfully:', result);

        res.json(result);
    } catch (error) {
        console.error('Error in startGameHandler:', error);
        res.status(500).json({ error: 'Failed to start game' });
    }
};

// Roll dice
const rollDiceHandler: RequestHandler = async (req: Request, res: Response) => {
    try {
        const gameId = parseInt(req.params.gameId);
        const userId = (req as AuthRequest).user?.id;

        if (!userId) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }

        const result = await gameService.handleRoll(gameId, userId);
        res.json(result);
    } catch (error) {
        console.error('Error rolling dice:', error);
        res.status(500).json({ error: 'Failed to roll dice' });
    }
};

// End turn
const endTurnHandler: RequestHandler = async (req: Request, res: Response) => {
    try {
        const gameId = parseInt(req.params.gameId);
        const userId = (req as AuthRequest).user?.id;

        if (!userId) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }

        const result = await gameService.endTurn(gameId, userId);
        res.json(result);
    } catch (error) {
        console.error('Error ending turn:', error);
        res.status(500).json({ error: 'Failed to end turn' });
    }
};

// Purchase property
const purchasePropertyHandler: RequestHandler = async (req: Request, res: Response) => {
    try {
        const gameId = parseInt(req.params.gameId);
        const propertyId = parseInt(req.params.propertyId);
        const userId = (req as AuthRequest).user?.id;

        if (!userId) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }

        const result = await propertyService.purchaseProperty(propertyId, userId);
        res.json({ success: result });
    } catch (error) {
        console.error('Error purchasing property:', error);
        res.status(500).json({ error: 'Failed to purchase property' });
    }
};

// Pay rent
const payRentHandler: RequestHandler = async (req, res) => {
    try {
        const gameId = parseInt(req.params.id);
        const fromPlayerId = parseInt(req.body.fromPlayerId);
        const toPlayerId = parseInt(req.body.toPlayerId);
        const amount = parseInt(req.body.amount);
        const success = await playerService.payRent(fromPlayerId, toPlayerId, amount, gameId);
        
        if (success) {
            const gameState = await gameService.getGameState(gameId);
            res.json({ success: true, gameState });
        } else {
            res.status(400).json({ error: 'Failed to pay rent' });
        }
    } catch (error: any) {
        console.error('Error paying rent:', error);
        res.status(error.status || 500).json({ error: error.message || 'Failed to pay rent' });
    }
};

// Render game view
const renderGameHandler: RequestHandler = async (req, res) => {
    try {
        const gameId = parseInt(req.params.gameId);
        const userId = (req as AuthRequest).user?.id;

        if (!userId) {
            res.redirect('/login');
            return;
        }

        const game = await gameService.getGameById(gameId);
        if (!game) {
            res.status(404).render('error', { message: 'Game not found' });
            return;
        }

        const player = await playerService.getPlayerByUserId(userId);
        if (!player) {
            res.status(403).render('error', { message: 'Player not found' });
            return;
        }

        const gameState = await gameService.getGameState(gameId);
        const properties = await propertyService.getPropertiesInGame(gameId);
        
        // Generate token with player data
        const token = generateToken({
            id: userId,
            username: player.username,
            gameId
        });

        // Group properties by color
        const groupedProperties = properties.reduce((acc: any, prop: any) => {
            if (!acc[prop.colorGroup]) {
                acc[prop.colorGroup] = [];
            }
            acc[prop.colorGroup].push(prop);
            return acc;
        }, {});

        res.render('game', {
            gameId,
            currentUserId: userId,
            currentPlayerId: player.id,
            username: player.username,
            token,
            players: gameState?.players || [],
            properties,
            groupedProperties,
            gameState: gameState || { players: [], properties: [], currentPlayerId: -1 }
        });
    } catch (error) {
        console.error('Error rendering game view:', error);
        res.status(500).render('error', { message: 'Failed to load game' });
    }
};

// Route handlers
router.post('/', requireAuth, createGameHandler);
router.post('/:gameId/join', requireAuth, joinGameHandler);
router.get('/:gameId/state', requireAuth, getGameStateHandler);
router.post('/:gameId/start', requireAuth, startGameHandler);
router.post('/:gameId/roll', requireAuth, rollDiceHandler);
router.post('/:gameId/end-turn', requireAuth, endTurnHandler);
router.post('/:gameId/properties/:propertyId/purchase', requireAuth, purchasePropertyHandler);
router.post('/:id/pay-rent', payRentHandler);
router.get('/:gameId/play', requireAuth, renderGameHandler);

export default router; 