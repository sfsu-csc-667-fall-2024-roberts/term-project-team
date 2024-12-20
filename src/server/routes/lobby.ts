import express, { RequestHandler } from 'express';
import { GameService } from '../services/gameService';
import { PlayerService } from '../services/playerService';
import { gameHistoryService } from '../services/gameHistoryService';
import { requireAuth } from '../middleware/auth';
import { AuthRequest } from '../../shared/types';
import { DatabaseService } from '../services/databaseService';

const router = express.Router();
const gameService = GameService.getInstance();
const playerService = PlayerService.getInstance();
const dbService = DatabaseService.getInstance();

// Get lobby view
const getLobbyHandler: RequestHandler = async (req, res) => {
    try {
        const userId = (req as AuthRequest).user?.id;
        if (!userId) {
            res.redirect('/auth/login');
            return;
        }

        // Get user data
        const user = await dbService.getUserById(userId);
        if (!user) {
            res.status(404).render('error', { message: 'User not found' });
            return;
        }

        // Get current player
        const player = await playerService.getPlayerByUserId(userId);
        if (!player) {
            res.status(404).render('error', { message: 'Player not found' });
            return;
        }

        // Get all games with their states
        const games = await gameService.getGames();
        const mappedGames = await Promise.all(games.map(async game => {
            const playerStats = game.state.players.length > 0 ? 
                await gameHistoryService.getPlayerStatistics(game.id) : [];

            return {
                id: game.id,
                status: game.status,
                owner_id: game.ownerId,
                human_count: game.state.players.filter(p => !p.isBot).length,
                bot_count: game.state.players.filter(p => p.isBot).length,
                player_count: game.state.players.length,
                joinable: game.state.players.length < (game.maxPlayers || 4) && game.status === 'waiting',
                isPlayerInGame: game.state.players.some(p => p.id === player.id),
                playerStats: playerStats,
                canJoin: game.state.players.length < (game.maxPlayers || 4) && !game.state.players.some(p => p.id === player.id),
                canLeave: game.state.players.some(p => p.id === player.id),
                isOwner: game.ownerId === player.id
            };
        }));

        res.render('lobby', { 
            games: mappedGames,
            user: { id: userId, username: user.username }
        });
    } catch (error) {
        console.error('Error getting lobby:', error);
        res.status(500).render('error', { message: 'Failed to load lobby' });
    }
};

// Create game
const createGameHandler: RequestHandler = async (req, res) => {
    try {
        const { name, maxPlayers, botCount, botDifficulty, botStrategy } = req.body;
        const userId = (req as AuthRequest).user?.id;

        if (!userId) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }

        const player = await playerService.getPlayerByUserId(userId);
        if (!player) {
            res.status(404).json({ error: 'Player not found' });
            return;
        }

        const game = await gameService.createGame(name, maxPlayers);
        
        // Add the creator as the first player
        await gameService.joinGame(game.id, player.id);

        // Add bots if requested
        if (botCount > 0) {
            for (let i = 0; i < botCount; i++) {
                await gameService.addBot(game.id, botDifficulty, botStrategy);
            }
        }

        // Add game creation event
        await gameHistoryService.addEvent(game.id, {
            type: 'custom',
            description: `Game created by ${player.username}`,
            playerId: player.id,
            timestamp: Date.now()
        });

        res.status(201).json(game);
    } catch (error) {
        console.error('Error creating game:', error);
        res.status(500).json({ error: 'Failed to create game' });
    }
};

// Join game
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
            res.status(404).json({ error: 'Player not found' });
            return;
        }

        const result = await gameService.joinGame(gameId, player.id);

        // Add join event
        await gameHistoryService.addEvent(gameId, {
            type: 'custom',
            description: `${player.username} joined the game`,
            playerId: player.id,
            timestamp: Date.now()
        });

        res.json(result);
    } catch (error) {
        console.error('Error joining game:', error);
        if (error instanceof Error) {
            res.status(400).json({ error: error.message });
        } else {
            res.status(500).json({ error: 'Failed to join game' });
        }
    }
};

// Leave game
const leaveGameHandler: RequestHandler = async (req, res) => {
    try {
        const gameId = parseInt(req.params.gameId);
        const userId = (req as AuthRequest).user?.id;

        if (!userId) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }

        const player = await playerService.getPlayerByUserId(userId);
        if (!player) {
            res.status(404).json({ error: 'Player not found' });
            return;
        }

        await gameService.leaveGame(gameId, player.id);

        // Add leave event
        await gameHistoryService.addEvent(gameId, {
            type: 'custom',
            description: `${player.username} left the game`,
            playerId: player.id,
            timestamp: Date.now()
        });

        res.json({ success: true });
    } catch (error) {
        console.error('Error leaving game:', error);
        res.status(500).json({ error: 'Failed to leave game' });
    }
};

// Delete game
const deleteGameHandler: RequestHandler = async (req, res) => {
    try {
        const gameId = parseInt(req.params.gameId);
        const userId = (req as AuthRequest).user?.id;

        if (!userId) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }

        const player = await playerService.getPlayerByUserId(userId);
        if (!player) {
            res.status(404).json({ error: 'Player not found' });
            return;
        }

        const game = await gameService.getGame(gameId);
        if (!game) {
            res.status(404).json({ error: 'Game not found' });
            return;
        }

        if (game.ownerId !== player.id) {
            res.status(403).json({ error: 'Only the game owner can delete the game' });
            return;
        }

        await gameService.deleteGame(gameId);
        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting game:', error);
        res.status(500).json({ error: 'Failed to delete game' });
    }
};

// Route handlers
router.get('/', requireAuth, getLobbyHandler);
router.post('/games', requireAuth, createGameHandler);
router.get('/games', requireAuth, getLobbyHandler);
router.post('/games/:gameId/join', requireAuth, joinGameHandler);
router.post('/games/:gameId/leave', requireAuth, leaveGameHandler);
router.delete('/games/:gameId', requireAuth, deleteGameHandler);

export default router; 