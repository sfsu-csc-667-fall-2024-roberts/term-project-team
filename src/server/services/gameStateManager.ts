import { GameState, Player, Property, GameEvent, GameEventType, PlayerWithRoll, WebSocketMessageType, WebSocketMessage } from '../../shared/types';
import { DatabaseService } from './databaseService';
import { GameWebSocket } from '../websocket/gameWebSocket';

export class GameStateManager {
    private static instance: GameStateManager;
    private gameStates: Map<number, GameState> = new Map();
    private databaseService: DatabaseService;
    private eventHandlers: Map<WebSocketMessageType, ((message: WebSocketMessage) => void)[]>;

    private constructor() {
        this.databaseService = DatabaseService.getInstance();
        this.eventHandlers = new Map();
    }

    static getInstance(): GameStateManager {
        if (!GameStateManager.instance) {
            GameStateManager.instance = new GameStateManager();
        }
        return GameStateManager.instance;
    }

    async getGameState(gameId: number): Promise<GameState | null> {
        try {
            const [gameState, players, properties] = await Promise.all([
                this.databaseService.getGameState(gameId),
                this.databaseService.getGamePlayers(gameId),
                this.databaseService.getGameProperties(gameId)
            ]);

            if (!gameState) return null;

            // Ensure the state has all required properties
            return {
                ...gameState,
                players,
                properties,
                turnOrder: gameState.turnOrder || [],
                bankruptPlayers: gameState.bankruptPlayers || [],
                pendingTrades: gameState.pendingTrades || [],
                gameLog: gameState.gameLog || []
            };
        } catch (error) {
            console.error('Error getting game state:', error);
            throw error;
        }
    }

    async updateGameState(gameId: number, updates: Partial<GameState>): Promise<void> {
        try {
            const currentState = await this.getGameState(gameId);
            if (!currentState) {
                throw new Error('Game not found');
            }

            // Handle phase transition from waiting to playing
            if (currentState.gamePhase === 'ROLL' && updates.gamePhase === 'ACTION') {
                await this.handlePhaseTransition(gameId, currentState, updates);
            }

            // Merge current state with updates
            const newState = {
                ...currentState,
                ...updates,
                // Ensure these arrays are always present
                turnOrder: updates.turnOrder || currentState.turnOrder || [],
                bankruptPlayers: updates.bankruptPlayers || currentState.bankruptPlayers || [],
                pendingTrades: updates.pendingTrades || currentState.pendingTrades || [],
                gameLog: updates.gameLog || currentState.gameLog || []
            };

            // Update the game state in the database
            await this.databaseService.updateGameState(gameId, newState);

            // Broadcast updated state to all clients
            await this.broadcastGameState(gameId);
        } catch (error) {
            console.error('Error updating game state:', error);
            throw error;
        }
    }

    private async handlePhaseTransition(
        gameId: number,
        currentState: GameState,
        updates: Partial<GameState>
    ): Promise<void> {
        console.log('Transitioning from ROLL to ACTION phase');
        
        // Sort players by their roll values to determine turn order
        const rolls = currentState.diceRoll || [];
        const rollResults = rolls
            .filter(roll => typeof roll === 'number')
            .sort((a, b) => b - a);

        // Set turn order and first player
        updates.turnOrder = currentState.players.map(p => p.id);
        updates.currentPlayerId = updates.turnOrder[0];
        
        // Add phase transition event to game log
        const firstPlayer = currentState.players.find(p => p.id === updates.currentPlayerId);
        if (firstPlayer) {
            if (!updates.gameLog) {
                updates.gameLog = [];
            }
            updates.gameLog.push(this.createGameEvent(
                'phase_change',
                firstPlayer.id,
                `Game started! ${firstPlayer.username} goes first!`
            ));
        }
    }

    async addGameEvent(
        gameId: number,
        type: GameEventType,
        playerId: number,
        description: string,
        metadata?: Record<string, any>
    ): Promise<void> {
        const gameState = await this.getGameState(gameId);
        if (!gameState) {
            throw new Error('Game not found');
        }

        const event = this.createGameEvent(type, playerId, description, metadata);
        gameState.gameLog.push(event);
        await this.databaseService.updateGameState(gameId, gameState);

        // Emit the event to all clients
        this.emit('gameEvent', {
            type: 'gameEvent',
            playerId,
            gameId,
            payload: event
        });
    }

    private createGameEvent(
        type: GameEventType,
        playerId: number,
        description: string,
        metadata?: Record<string, any>
    ): GameEvent {
        return {
            type,
            playerId,
            description,
            timestamp: Date.now(),
            metadata
        };
    }

    private async broadcastGameState(gameId: number): Promise<void> {
        const gameState = await this.getGameState(gameId);
        if (gameState) {
            const message: WebSocketMessage = {
                type: 'game_state_update',
                playerId: gameState.currentPlayerId,
                gameId,
                payload: {
                    gameState,
                    players: gameState.players,
                    properties: gameState.properties
                }
            };
            await GameWebSocket.broadcastGameAction(gameId, message);
        }
    }

    handleEndTurn(gameId: number): void {
        const gameState = this.gameStates.get(gameId);
        if (!gameState) return;

        // Reset turn-specific state
        gameState.lastRoll = undefined;
        gameState.lastDice = undefined;
        gameState.lastDoubles = undefined;
        gameState.currentPropertyDecision = undefined;
        gameState.currentRentOwed = undefined;

        // Move to next player
        const currentIndex = gameState.turnOrder.indexOf(gameState.currentPlayerId);
        const nextIndex = (currentIndex + 1) % gameState.turnOrder.length;
        gameState.currentPlayerId = gameState.turnOrder[nextIndex];

        // Increment turn count
        gameState.turnCount++;

        // Update the game state
        this.gameStates.set(gameId, gameState);

        // Broadcast the state change
        this.broadcastGameState(gameId);
    }

    public on(eventType: WebSocketMessageType, handler: (message: WebSocketMessage) => void): void {
        if (!this.eventHandlers.has(eventType)) {
            this.eventHandlers.set(eventType, []);
        }
        this.eventHandlers.get(eventType)?.push(handler);
    }

    public emit(eventType: WebSocketMessageType, message: WebSocketMessage): void {
        const handlers = this.eventHandlers.get(eventType);
        if (handlers) {
            handlers.forEach(handler => handler(message));
        }
    }
}

// Export a singleton instance
export const gameStateManager = GameStateManager.getInstance(); 