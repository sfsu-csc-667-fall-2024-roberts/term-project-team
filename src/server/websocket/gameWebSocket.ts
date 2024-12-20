import { WebSocket } from 'ws';
import { GameService } from '../services/gameService';
import { WebSocketMessage, GameState, SpaceAction, WebSocketMessageType, GameEvent } from '../../shared/types';
import { PropertyImprovementService } from '../services/propertyImprovementService';

export class GameWebSocket {
    private static connections: Map<number, Map<number, WebSocket>> = new Map();
    private ws: WebSocket | null = null;
    private gameId: number;
    private playerId: number;
    private gameService: GameService;
    private propertyImprovementService: PropertyImprovementService;
    private messageHandlers: Map<WebSocketMessageType, ((message: WebSocketMessage) => void)[]>;
    private reconnectAttempts: number = 0;
    private maxReconnectAttempts: number = 3;
    private reconnectTimeout: NodeJS.Timeout | null = null;

    constructor(gameId: number, playerId: number) {
        console.log(`Creating new GameWebSocket for game ${gameId}, player ${playerId}`);
        this.gameId = gameId;
        this.playerId = playerId;
        this.gameService = GameService.getInstance();
        this.propertyImprovementService = PropertyImprovementService.getInstance();
        this.messageHandlers = new Map();
        this.setupEventHandlers();
        console.log('GameWebSocket instance created successfully');
    }

    static getGameConnections(gameId: number): Map<number, WebSocket> | undefined {
        return GameWebSocket.connections.get(gameId);
    }

    static getConnection(gameId: number, playerId: number): WebSocket | undefined {
        return GameWebSocket.connections.get(gameId)?.get(playerId);
    }

    static broadcastGameAction(gameId: number, message: WebSocketMessage): void {
        console.log(`Broadcasting game action for game ${gameId}`);
        const connections = GameWebSocket.getGameConnections(gameId);
        if (!connections) {
            console.log(`No connections found for game ${gameId}`);
            return;
        }

        const messageString = JSON.stringify(message);
        let sentCount = 0;
        for (const [playerId, ws] of connections) {
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(messageString);
                sentCount++;
            }
        }
        console.log(`Game action broadcast complete - Message sent to ${sentCount} players`);
    }

    private addConnection(): void {
        console.log(`Adding connection for game ${this.gameId}, player ${this.playerId}`);
        if (!GameWebSocket.connections.has(this.gameId)) {
            GameWebSocket.connections.set(this.gameId, new Map());
        }
        if (this.ws) {
            GameWebSocket.connections.get(this.gameId)?.set(this.playerId, this.ws);
            console.log('Connection added successfully');
        } else {
            console.log('No WebSocket instance to add');
        }
    }

    private removeConnection(): void {
        console.log(`Removing connection for game ${this.gameId}, player ${this.playerId}`);
        const gameConnections = GameWebSocket.connections.get(this.gameId);
        if (gameConnections) {
            gameConnections.delete(this.playerId);
            if (gameConnections.size === 0) {
                GameWebSocket.connections.delete(this.gameId);
                console.log(`All connections removed for game ${this.gameId}`);
            }
            console.log('Connection removed successfully');
        } else {
            console.log('No connections found to remove');
        }
    }

    private setupEventHandlers(): void {
        if (!this.ws) {
            console.log('No WebSocket instance to setup handlers for');
            return;
        }

        console.log('Setting up WebSocket event handlers');

        this.ws.on('open', () => {
            console.log(`WebSocket connection opened for game ${this.gameId}, player ${this.playerId}`);
            this.reconnectAttempts = 0;
        });

        this.ws.on('message', async (message: string) => {
            console.log(`Received message for game ${this.gameId}, player ${this.playerId}`);
            try {
                const data = JSON.parse(message) as WebSocketMessage;
                await this.handleMessage(data);
            } catch (error) {
                console.error('Error handling WebSocket message:', error);
                this.sendError('Failed to process message');
            }
        });

        this.ws.on('close', (code: number, reason: string) => {
            console.log(`WebSocket closed for game ${this.gameId}, player ${this.playerId}. Code: ${code}, Reason: ${reason}`);
            this.removeConnection();
            this.attemptReconnect();
        });

        this.ws.on('error', (error) => {
            console.error(`WebSocket error for game ${this.gameId}, player ${this.playerId}:`, error);
            this.removeConnection();
            this.attemptReconnect();
        });

        console.log('WebSocket event handlers setup completed');
    }

    private attemptReconnect(): void {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.log(`Max reconnection attempts (${this.maxReconnectAttempts}) reached`);
            return;
        }

        this.reconnectAttempts++;
        const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 5000);
        
        console.log(`Attempting reconnect ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms`);
        
        if (this.reconnectTimeout) {
            clearTimeout(this.reconnectTimeout);
        }

        console.log('Reconnection handled by server-side WebSocket manager');
    }

    private async handleMessage(message: WebSocketMessage): Promise<void> {
        console.log(`Handling message of type ${message.type}:`, message);
        
        try {
            switch (message.type) {
                case 'request_game_state':
                    await this.handleGameStateRequest(message);
                    break;
                default:
                    const handlers = this.messageHandlers.get(message.type);
                    if (handlers) {
                        handlers.forEach(handler => handler(message));
                    }
                    
                    GameWebSocket.broadcastGameAction(this.gameId, {
                        type: message.type,
                        playerId: this.playerId,
                        payload: message.payload
                    });
            }
        } catch (error) {
            console.error('Error handling message:', error);
            this.sendError('Failed to process message');
        }
    }

    private async handleGameStateRequest(message: WebSocketMessage): Promise<void> {
        console.log('Handling game state request:', message);
        try {
            const gameService = GameService.getInstance();
            const gameState = await gameService.getGameState(this.gameId);
            
            if (gameState) {
                console.log('Sending game state update:', gameState);
                this.send({
                    type: 'game_state_update',
                    playerId: this.playerId,
                    payload: {
                        gameState,
                        players: gameState.players,
                        properties: gameState.properties
                    }
                });

                // Broadcast to all other players
                GameWebSocket.broadcastGameAction(this.gameId, {
                    type: 'game_state_update',
                    playerId: this.playerId,
                    payload: {
                        gameState,
                        players: gameState.players,
                        properties: gameState.properties
                    }
                });
            } else {
                console.error('Game state not found');
                this.sendError('Game state not found');
            }
        } catch (error) {
            console.error('Error handling game state request:', error);
            this.sendError('Failed to get game state');
        }
    }

    private handleGameEvent(event: GameEvent): void {
        console.log(`Handling game event for game ${this.gameId}`);
        GameWebSocket.broadcastGameAction(this.gameId, {
            type: 'gameEvent',
            playerId: this.playerId,
            payload: event
        });
    }

    private handleSpaceAction(action: SpaceAction): void {
        console.log(`Handling space action for game ${this.gameId}`);
        GameWebSocket.broadcastGameAction(this.gameId, {
            type: 'spaceAction',
            playerId: this.playerId,
            payload: action
        });
    }

    private send(message: WebSocketMessage): void {
        if (this.ws?.readyState === WebSocket.OPEN) {
            console.log(`Sending message of type ${message.type}`);
            this.ws.send(JSON.stringify(message));
        } else {
            console.log('Cannot send message - WebSocket not open');
        }
    }

    private sendError(error: string): void {
        console.log(`Sending error message: ${error}`);
        this.send({
            type: 'error',
            playerId: this.playerId,
            payload: { error }
        });
    }

    public connect(ws: WebSocket): void {
        console.log(`Connecting WebSocket for game ${this.gameId}, player ${this.playerId}`);
        
        if (this.ws) {
            console.log('Closing existing WebSocket connection');
            this.ws.close();
        }

        this.ws = ws;
        this.setupEventHandlers();
        this.addConnection();
        console.log('WebSocket connection established');
        
        // Request initial game state
        this.handleGameStateRequest({
            type: 'request_game_state',
            playerId: this.playerId,
            payload: {}
        });
    }
}

export const createGameWebSocket = (gameId: number, playerId: number) => {
    console.log(`Creating new GameWebSocket instance for game ${gameId}, player ${playerId}`);
    return new GameWebSocket(gameId, playerId);
}; 