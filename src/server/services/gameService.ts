import { Game, GameState, Player, GamePhase } from '../../shared/types';
import { DatabaseService } from './databaseService';
import { GameWebSocket } from '../websocket/gameWebSocket';

type GameStatus = 'waiting' | 'in-progress' | 'finished';

const mapPhaseToStatus = (phase: GamePhase): GameStatus => {
    switch (phase) {
        case 'ROLL':
            return 'in-progress';
        case 'ACTION':
            return 'in-progress';
        case 'END_TURN':
            return 'in-progress';
        case 'GAME_OVER':
            return 'finished';
        default:
            return 'waiting';
    }
};

export class GameService {
    private static instance: GameService;
    private databaseService: DatabaseService;

    private constructor() {
        this.databaseService = DatabaseService.getInstance();
    }

    static getInstance(): GameService {
        if (!GameService.instance) {
            GameService.instance = new GameService();
        }
        return GameService.instance;
    }

    async getGames(): Promise<Game[]> {
        try {
            const games = await this.databaseService.getGames();
            return games.map(game => {
                // First ensure we have a valid GameState
                const gameState: GameState = {
                    id: game.id,
                    players: game.state?.players || [],
                    properties: game.state?.properties || [],
                    currentPlayerId: game.state?.currentPlayerId || -1,
                    gamePhase: game.state?.gamePhase || 'ROLL',
                    winner: game.state?.winner || null,
                    doublesCount: game.state?.doublesCount || 0,
                    turnCount: game.state?.turnCount || 0,
                    bankruptPlayers: game.state?.bankruptPlayers || [],
                    jailFreeCards: game.state?.jailFreeCards || {},
                    gameLog: game.state?.gameLog || [],
                    turnOrder: game.state?.turnOrder || [],
                    pendingTrades: game.state?.pendingTrades || []
                };

                // Then construct the Game object
                return {
                    id: game.id,
                    name: `Game ${game.id}`,
                    maxPlayers: 4,
                    state: gameState,
                    status: mapPhaseToStatus(gameState.gamePhase),
                    ownerId: gameState.currentPlayerId,
                    createdAt: Date.now(),
                    updatedAt: Date.now(),
                    minPlayers: 2,
                    isPrivate: false
                };
            });
        } catch (error) {
            console.error('Error getting games:', error);
            throw error;
        }
    }

    async createGame(name: string, maxPlayers: number): Promise<Game> {
        try {
            const gameId = await this.databaseService.createGame(name, maxPlayers);
            const state = await this.databaseService.getGameState(gameId);
            if (!state) {
                throw new Error('Failed to create game');
            }

            // Ensure we have a valid GameState
            const gameState: GameState = {
                id: state.id,
                players: state.players || [],
                properties: state.properties || [],
                currentPlayerId: state.currentPlayerId || -1,
                gamePhase: state.gamePhase || 'ROLL',
                winner: state.winner || null,
                doublesCount: state.doublesCount || 0,
                turnCount: state.turnCount || 0,
                bankruptPlayers: state.bankruptPlayers || [],
                jailFreeCards: state.jailFreeCards || {},
                gameLog: state.gameLog || [],
                turnOrder: state.turnOrder || [],
                pendingTrades: state.pendingTrades || []
            };

            return {
                id: gameState.id,
                name,
                maxPlayers,
                state: gameState,
                status: mapPhaseToStatus(gameState.gamePhase),
                ownerId: gameState.currentPlayerId,
                createdAt: Date.now(),
                updatedAt: Date.now(),
                minPlayers: 2,
                isPrivate: false
            };
        } catch (error) {
            console.error('Error creating game:', error);
            throw error;
        }
    }

    async getGameById(gameId: number): Promise<Game | null> {
        try {
            const state = await this.databaseService.getGameState(gameId);
            if (!state) {
                return null;
            }

            // Ensure we have a valid GameState
            const gameState: GameState = {
                id: state.id,
                players: state.players || [],
                properties: state.properties || [],
                currentPlayerId: state.currentPlayerId || -1,
                gamePhase: state.gamePhase || 'ROLL',
                winner: state.winner || null,
                doublesCount: state.doublesCount || 0,
                turnCount: state.turnCount || 0,
                bankruptPlayers: state.bankruptPlayers || [],
                jailFreeCards: state.jailFreeCards || {},
                gameLog: state.gameLog || [],
                turnOrder: state.turnOrder || [],
                pendingTrades: state.pendingTrades || []
            };

            return {
                id: gameState.id,
                name: `Game ${gameState.id}`,
                maxPlayers: 4,
                state: gameState,
                status: mapPhaseToStatus(gameState.gamePhase),
                ownerId: gameState.currentPlayerId,
                createdAt: Date.now(),
                updatedAt: Date.now(),
                minPlayers: 2,
                isPrivate: false
            };
        } catch (error) {
            console.error('Error getting game:', error);
            throw error;
        }
    }

    async getGameState(gameId: number): Promise<GameState | null> {
        try {
            const gameState = await this.databaseService.getGameState(gameId);
            if (!gameState) return null;
            return gameState;
        } catch (error) {
            console.error('Error getting game state:', error);
            throw error;
        }
    }

    async startGame(gameId: number, userId: number): Promise<GameState> {
        console.log(`GameService: Starting game ${gameId} for user ${userId}`);
        
        try {
            // Get current game state to validate
            const currentState = await this.databaseService.getGameState(gameId);
            console.log('Current game state:', currentState);

            if (!currentState) {
                console.error('Game not found');
                throw new Error('Game not found');
            }

            if (currentState.players.length < 2) {
                console.error('Not enough players to start game');
                throw new Error('Need at least 2 players to start game');
            }

            // Verify the user is the first player
            if (currentState.players[0].id !== userId) {
                console.error('User is not the first player');
                throw new Error('Only the first player can start the game');
            }

            // Update game state to start the game
            console.log('Updating game state to start game');
            const updatedState: GameState = {
                ...currentState,
                gamePhase: 'ROLL' as GamePhase,
                currentPlayerId: currentState.players[0].id,
                turnOrder: currentState.players.map(p => p.id),
                turnCount: 0,
                doublesCount: 0,
                diceRoll: undefined,
                winner: null
            };

            // Save the updated state
            console.log('Saving updated game state:', updatedState);
            await this.databaseService.updateGameState(gameId, updatedState);

            // Create game start event
            await this.databaseService.createGameEvent(gameId, {
                type: 'game_start',
                description: 'Game started',
                timestamp: Date.now(),
                playerId: userId
            });

            // Broadcast the game start event through WebSocket
            console.log('Broadcasting game start event');
            GameWebSocket.broadcastGameAction(gameId, {
                type: 'game_state_update',
                playerId: userId,
                payload: updatedState
            });

            return updatedState;
        } catch (error) {
            console.error('Error in GameService.startGame:', error);
            throw error;
        }
    }

    async joinGame(gameId: number, playerId: number): Promise<GameState> {
        try {
            const gameState = await this.databaseService.getGameState(gameId);
            if (!gameState) {
                throw new Error('Game not found');
            }

            // Check if game is full
            if (gameState.players.length >= 4) {
                throw new Error('Game is full');
            }

            // Get player data
            const player = await this.databaseService.getPlayerById(playerId);
            if (!player) {
                throw new Error('Player not found');
            }

            // First, try to leave any existing games
            try {
                await this.databaseService.leaveGame(gameId, playerId);
            } catch (error) {
                // Ignore errors from leaving game as the player might not be in any game
                console.log('No existing game to leave');
            }

            // Add player to game using the database service
            const success = await this.databaseService.addPlayerToGame(gameId, playerId);
            if (!success) {
                throw new Error('Failed to add player to game');
            }

            // Create a game event for the player joining
            await this.databaseService.createGameEvent(gameId, {
                type: 'player_joined',
                playerId,
                description: `${player.username} joined the game`,
                metadata: {}
            });

            // Get updated game state
            const updatedGameState = await this.databaseService.getGameState(gameId);
            if (!updatedGameState) {
                throw new Error('Game not found');
            }

            return updatedGameState;
        } catch (error) {
            console.error('Error joining game:', error);
            throw error;
        }
    }

    async leaveGame(gameId: number, userId: number): Promise<void> {
        try {
            const gameState = await this.databaseService.getGameState(gameId);
            if (!gameState) {
                throw new Error('Game not found');
            }

            gameState.players = gameState.players.filter(p => p.id !== userId);
            await this.databaseService.updateGameState(gameId, gameState);
        } catch (error) {
            console.error('Error leaving game:', error);
            throw error;
        }
    }

    async handleRoll(gameId: number, userId: number): Promise<any> {
        try {
            console.log('GameService: Handling roll for game:', gameId, 'user:', userId);
            const gameState = await this.databaseService.getGameState(gameId);
            
            if (!gameState) {
                throw new Error('Game not found');
            }

            // Validate it's the player's turn and they can roll
            if (gameState.currentPlayerId !== userId) {
                throw new Error('Not your turn');
            }
            if (gameState.gamePhase !== 'ROLL') {
                throw new Error('Cannot roll dice in current phase');
            }

            // Roll dice
            const dice = [
                Math.floor(Math.random() * 6) + 1,
                Math.floor(Math.random() * 6) + 1
            ];
            const isDoubles = dice[0] === dice[1];
            console.log('GameService: Rolled:', dice, 'doubles:', isDoubles);

            // Find current player
            const currentPlayer = gameState.players.find(p => p.id === userId);
            if (!currentPlayer) {
                throw new Error('Player not found');
            }

            // Handle jail
            if (currentPlayer.isJailed) {
                if (isDoubles) {
                    currentPlayer.isJailed = false;
                    currentPlayer.turnsInJail = 0;
                    await this.databaseService.createGameEvent(gameId, {
                        type: 'jail_release',
                        playerId: userId,
                        description: `${currentPlayer.username} rolled doubles and got out of jail!`,
                        timestamp: Date.now()
                    });
                } else {
                    currentPlayer.turnsInJail++;
                    if (currentPlayer.turnsInJail >= 3) {
                        // Force pay to get out after 3 turns
                        if (currentPlayer.money >= 50) {
                            currentPlayer.money -= 50;
                            currentPlayer.isJailed = false;
                            currentPlayer.turnsInJail = 0;
                            await this.databaseService.createGameEvent(gameId, {
                                type: 'jail_release',
                                playerId: userId,
                                description: `${currentPlayer.username} paid $50 to get out of jail after 3 turns.`,
                                timestamp: Date.now()
                            });
                        }
                    }
                    gameState.gamePhase = 'END_TURN';
                    await this.databaseService.updateGameState(gameId, gameState);
                    return { dice, gameState, action: 'STILL_IN_JAIL' };
                }
            }

            // Update position
            const oldPosition = currentPlayer.position;
            currentPlayer.position = (oldPosition + dice[0] + dice[1]) % 40;
            
            // Handle passing GO
            if (currentPlayer.position < oldPosition) {
                currentPlayer.money += 200;
                await this.databaseService.createGameEvent(gameId, {
                    type: 'pass_go',
                    playerId: userId,
                    description: `${currentPlayer.username} passed GO and collected $200!`,
                    timestamp: Date.now()
                });
            }

            // Handle landing on GO TO JAIL
            if (currentPlayer.position === 30) {
                currentPlayer.position = 10;
                currentPlayer.isJailed = true;
                currentPlayer.turnsInJail = 0;
                gameState.gamePhase = 'END_TURN';
                await this.databaseService.createGameEvent(gameId, {
                    type: 'go_to_jail',
                    playerId: userId,
                    description: `${currentPlayer.username} was sent to Jail!`,
                    timestamp: Date.now()
                });
            } else {
                // Handle doubles
                if (isDoubles) {
                    gameState.doublesCount++;
                    if (gameState.doublesCount === 3) {
                        // Three doubles in a row - go to jail
                        currentPlayer.position = 10;
                        currentPlayer.isJailed = true;
                        currentPlayer.turnsInJail = 0;
                        gameState.doublesCount = 0;
                        gameState.gamePhase = 'END_TURN';
                        await this.databaseService.createGameEvent(gameId, {
                            type: 'go_to_jail',
                            playerId: userId,
                            description: `${currentPlayer.username} rolled doubles three times and was sent to Jail!`,
                            timestamp: Date.now()
                        });
                    } else {
                        gameState.gamePhase = 'ROLL';
                    }
                } else {
                    gameState.doublesCount = 0;
                    gameState.gamePhase = 'ACTION';
                }
            }

            // Update game state
            gameState.diceRoll = dice;
            await this.databaseService.updateGameState(gameId, gameState);

            // Create roll event
            await this.databaseService.createGameEvent(gameId, {
                type: 'dice_roll',
                playerId: userId,
                description: `${currentPlayer.username} rolled ${dice[0]} and ${dice[1]}`,
                timestamp: Date.now(),
                metadata: { dice, isDoubles }
            });

            return { 
                dice, 
                gameState,
                action: currentPlayer.isJailed ? 'WENT_TO_JAIL' : 'MOVED',
                isDoubles,
                passedGo: currentPlayer.position < oldPosition
            };
        } catch (error) {
            console.error('GameService: Error handling roll:', error);
            throw error;
        }
    }

    async addBot(gameId: number, difficulty: string = 'normal', strategy: string = 'balanced'): Promise<void> {
        try {
            const gameState = await this.databaseService.getGameState(gameId);
            if (!gameState) {
                throw new Error('Game not found');
            }

            const botNumber = gameState.players.filter(p => p.isBot).length + 1;
            const botName = `Bot ${botNumber}`;

            // Create a bot player
            await this.databaseService.createPlayer({
                userId: -botNumber, // Negative IDs for bots
                username: botName,
                money: 1500,
                position: 0,
                isJailed: false,
                turnsInJail: 0,
                jailFreeCards: 0,
                isBankrupt: false,
                gameId: gameId
            });

            // Update game state
            const botPlayer: Player = {
                id: -botNumber,
                username: botName,
                money: 1500,
                position: 0,
                isJailed: false,
                turnsInJail: 0,
                jailFreeCards: 0,
                isBankrupt: false,
                gameId: gameId,
                isBot: true,
                color: '#' + Math.floor(Math.random()*16777215).toString(16), // Random color
                botStrategy: strategy,
                properties: []
            };

            gameState.players.push(botPlayer);
            await this.databaseService.updateGameState(gameId, gameState);
        } catch (error) {
            console.error('Error adding bot:', error);
            throw error;
        }
    }

    async endTurn(gameId: number, userId: number): Promise<GameState> {
        try {
            const gameState = await this.databaseService.getGameState(gameId);
            if (!gameState) {
                throw new Error('Game not found');
            }

            const currentPlayerIndex = gameState.players.findIndex(p => p.id === userId);
            const nextPlayerIndex = (currentPlayerIndex + 1) % gameState.players.length;
            gameState.currentPlayerId = gameState.players[nextPlayerIndex].id;
            gameState.gamePhase = 'ROLL';

            await this.databaseService.updateGameState(gameId, gameState);
            return gameState;
        } catch (error) {
            console.error('Error ending turn:', error);
            throw error;
        }
    }

    async getGame(gameId: number): Promise<Game | null> {
        return this.getGameById(gameId);
    }

    async deleteGame(gameId: number): Promise<void> {
        try {
            const gameState = await this.databaseService.getGameState(gameId);
            if (!gameState) {
                throw new Error('Game not found');
            }

            // Delete all game-related data
            await this.databaseService.query('BEGIN');
            try {
                // Delete game events
                await this.databaseService.query(
                    'DELETE FROM game_events WHERE game_id = $1',
                    [gameId]
                );

                // Delete game properties
                await this.databaseService.query(
                    'DELETE FROM game_properties WHERE game_id = $1',
                    [gameId]
                );

                // Delete game players
                await this.databaseService.query(
                    'DELETE FROM game_players WHERE game_id = $1',
                    [gameId]
                );

                // Delete game
                await this.databaseService.query(
                    'DELETE FROM games WHERE id = $1',
                    [gameId]
                );

                await this.databaseService.query('COMMIT');
            } catch (error) {
                await this.databaseService.query('ROLLBACK');
                throw error;
            }
        } catch (error) {
            console.error('Error deleting game:', error);
            throw error;
        }
    }
} 