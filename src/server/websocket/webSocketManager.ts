import { Server as HttpServer } from 'http';
import { WebSocket, Server as WebSocketServer } from 'ws';
import { GameWebSocket, createGameWebSocket } from './gameWebSocket';
import { verifyToken } from '../utils/auth';
import { GameService } from '../services/gameService';

export class WebSocketManager {
    private wss: WebSocketServer;
    private static instance: WebSocketManager;

    private constructor(server: HttpServer) {
        console.log('Creating new WebSocket server instance...');
        this.wss = new WebSocketServer({ 
            server,
            clientTracking: true,
            perMessageDeflate: false
        });
        this.setupWebSocketServer();
        console.log('WebSocket server instance created successfully');
    }

    public static getInstance(server: HttpServer): WebSocketManager {
        if (!WebSocketManager.instance) {
            WebSocketManager.instance = new WebSocketManager(server);
        }
        return WebSocketManager.instance;
    }

    private setupWebSocketServer(): void {
        console.log('Setting up WebSocket server event handlers...');
        
        this.wss.on('listening', () => {
            console.log('WebSocket server is listening for connections');
        });

        this.wss.on('error', (error) => {
            console.error('WebSocket server error:', error);
        });

        this.wss.on('close', () => {
            console.log('WebSocket server closed');
        });

        this.wss.on('connection', async (ws: WebSocket, req: any) => {
            console.log('New WebSocket connection attempt...', req.url);
            try {
                // Extract token from query parameters
                const url = new URL(req.url, `http://${req.headers.host}`);
                const token = url.searchParams.get('token');
                const pathParts = url.pathname.split('/');
                const gameIdIndex = pathParts.indexOf('game') + 1;
                const gameId = parseInt(pathParts[gameIdIndex] || '0');

                console.log(`Connection attempt - Game ID: ${gameId}, Token present: ${!!token}, URL: ${req.url}`);

                if (!token || !gameId) {
                    console.log('Rejecting connection - Missing token or game ID');
                    ws.close(1008, 'Missing token or game ID');
                    return;
                }

                // Verify token and get player ID
                console.log('Verifying token...');
                const decoded = await verifyToken(token);
                if (!decoded || !decoded.id) {
                    console.log('Rejecting connection - Invalid token');
                    ws.close(1008, 'Invalid token');
                    return;
                }
                console.log(`Token verified for user ${decoded.id}`);

                // Check for existing connection
                const existingConnection = GameWebSocket.getConnection(gameId, decoded.id);
                if (existingConnection) {
                    console.log('Closing existing connection for reconnection');
                    existingConnection.close();
                }

                // Create new game WebSocket connection
                console.log(`Creating game WebSocket for game ${gameId} and player ${decoded.id}`);
                const gameWs = createGameWebSocket(gameId, decoded.id);
                
                // Add the connection to the game
                gameWs.connect(ws);
                console.log('Game WebSocket connected successfully');

                // Send initial game state
                const gameService = GameService.getInstance();
                const gameState = await gameService.getGameState(gameId);
                if (gameState) {
                    ws.send(JSON.stringify({
                        type: 'game_state_update',
                        playerId: decoded.id,
                        payload: {
                            gameState,
                            players: gameState.players,
                            properties: gameState.properties
                        }
                    }));
                }

                // Setup ping/pong to keep connection alive
                const pingInterval = setInterval(() => {
                    if (ws.readyState === WebSocket.OPEN) {
                        ws.ping();
                    }
                }, 30000);

                ws.on('close', () => {
                    console.log(`WebSocket closed for game ${gameId}, player ${decoded.id}`);
                    clearInterval(pingInterval);
                });

                ws.on('error', (error) => {
                    console.error(`WebSocket error for game ${gameId}, player ${decoded.id}:`, error);
                    clearInterval(pingInterval);
                });

                console.log('WebSocket connection setup completed successfully');

            } catch (error) {
                console.error('Error establishing WebSocket connection:', error);
                ws.close(1011, 'Internal server error');
            }
        });

        console.log('WebSocket server event handlers setup completed');
    }

    public broadcast(gameId: number, message: any): void {
        console.log(`Broadcasting message to game ${gameId}`);
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
        console.log(`Broadcast complete - Message sent to ${sentCount} players`);
    }

    public sendToPlayer(gameId: number, playerId: number, message: any): void {
        console.log(`Sending message to player ${playerId} in game ${gameId}`);
        const ws = GameWebSocket.getConnection(gameId, playerId);
        if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify(message));
            console.log('Message sent successfully');
        } else {
            console.log('Player connection not found or not open');
        }
    }

    public closeGame(gameId: number): void {
        console.log(`Closing all connections for game ${gameId}`);
        const connections = GameWebSocket.getGameConnections(gameId);
        if (!connections) {
            console.log(`No connections found for game ${gameId}`);
            return;
        }

        let closedCount = 0;
        for (const [playerId, ws] of connections) {
            if (ws.readyState === WebSocket.OPEN) {
                ws.close(1000, 'Game closed');
                closedCount++;
            }
        }
        console.log(`Game closed - ${closedCount} connections terminated`);
    }
} 