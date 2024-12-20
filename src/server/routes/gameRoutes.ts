import express, { RequestHandler } from 'express';
import { requireAuth } from '../middleware/auth';
import { GameService } from '../services/gameService';
import { PlayerService } from '../services/playerService';
import { generateToken } from '../utils/auth';
import { AuthRequest } from '../../shared/types';

const router = express.Router();
const gameService = GameService.getInstance();
const playerService = PlayerService.getInstance();

// Render game page
const renderGameHandler: RequestHandler = async (req, res) => {
    try {
        const gameId = parseInt(req.params.gameId);
        const userId = (req as AuthRequest).user?.id;

        if (!userId) {
            res.redirect('/auth/login');
            return;
        }

        const [gameState, player] = await Promise.all([
            gameService.getGameState(gameId),
            playerService.getPlayerByUserId(userId)
        ]);

        if (!gameState) {
            res.status(404).render('error', { message: 'Game not found' });
            return;
        }

        if (!player) {
            res.status(403).render('error', { message: 'You are not a player in this game' });
            return;
        }

        // Group properties by color
        const groupedProperties = gameState.properties.reduce((acc: any, prop: any) => {
            if (!acc[prop.colorGroup]) {
                acc[prop.colorGroup] = [];
            }
            acc[prop.colorGroup].push(prop);
            return acc;
        }, {});

        // Generate token for WebSocket authentication
        const token = generateToken({
            id: userId,
            username: player.username,
            gameId: gameId
        });

        res.render('game', {
            gameId,
            currentUserId: userId,
            currentPlayerId: player.id,
            username: player.username,
            token,
            players: gameState.players || [],
            properties: gameState.properties || [],
            groupedProperties,
            gameState: {
                ...gameState,
                players: gameState.players || [],
                properties: gameState.properties || [],
                currentPlayerId: gameState.currentPlayerId || -1,
                gamePhase: gameState.gamePhase || 'WAITING',
                turnCount: gameState.turnCount || 0,
                diceRoll: gameState.diceRoll || null,
                doublesCount: gameState.doublesCount || 0,
                winner: gameState.winner || null
            }
        });
    } catch (error) {
        console.error('Error rendering game page:', error);
        res.status(500).render('error', { message: 'Failed to load game' });
    }
};

// Get game state
const getGameStateHandler: RequestHandler = async (req, res) => {
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
const startGameHandler: RequestHandler = async (req, res) => {
    try {
        const gameId = parseInt(req.params.gameId);
        const userId = (req as AuthRequest).user?.id;

        if (!userId) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }

        const result = await gameService.startGame(gameId, userId);
        res.json(result);
    } catch (error) {
        console.error('Error starting game:', error);
        res.status(500).json({ error: 'Failed to start game' });
    }
};

// Roll dice
const rollDiceHandler: RequestHandler = async (req, res) => {
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
const endTurnHandler: RequestHandler = async (req, res) => {
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

// Get player state
const getPlayerStateHandler: RequestHandler = async (req, res) => {
    try {
        const gameId = parseInt(req.params.gameId);
        const userId = (req as AuthRequest).user?.id;

        if (!userId) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }

        const gameState = await gameService.getGameState(gameId);
        if (!gameState) {
            res.status(404).json({ error: 'Game not found' });
            return;
        }

        const player = gameState.players.find(p => p.id === userId);
        if (!player) {
            res.status(404).json({ error: 'Player not found in game' });
            return;
        }
        
        res.json(player);
    } catch (error) {
        console.error('Error getting player state:', error);
        res.status(500).json({ error: 'Failed to get player state' });
    }
};

// Route handlers
router.get('/:gameId/play', requireAuth, renderGameHandler);
router.get('/:gameId/state', requireAuth, getGameStateHandler);
router.post('/:gameId/start', requireAuth, startGameHandler);
router.post('/:gameId/roll', requireAuth, rollDiceHandler);
router.post('/:gameId/end-turn', requireAuth, endTurnHandler);
router.get('/:gameId/player', requireAuth, getPlayerStateHandler);

export default router;