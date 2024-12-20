import { WebSocketMessage, WebSocketMessageType } from '../../shared/types';

export class WebSocketService {
    private socket: WebSocket;
    private messageCallbacks: ((data: any) => void)[] = [];
    private reconnectAttempts = 0;
    private maxReconnectAttempts = 5;
    private reconnectDelay = 1000;
    private gameId: number;

    constructor(gameId: number) {
        this.gameId = gameId;
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const token = window.USER_TOKEN;
        const wsUrl = `${protocol}//${window.location.host}/game/${window.GAME_ID}/ws?token=${encodeURIComponent(token)}`;
        console.log('WebSocket: Creating connection with gameId:', window.GAME_ID, 'URL:', wsUrl);
        this.socket = this.connect(wsUrl);
    }

    private connect(url: string): WebSocket {
        console.log('WebSocket: Connecting to', url);
        const socket = new WebSocket(url);

        socket.onopen = () => {
            console.log('WebSocket: Connection established');
            this.reconnectAttempts = 0;
        };

        socket.onclose = (event) => {
            console.log('WebSocket: Connection closed', event);
            if (this.reconnectAttempts < this.maxReconnectAttempts) {
                setTimeout(() => {
                    console.log('WebSocket: Attempting to reconnect...');
                    this.reconnectAttempts++;
                    this.socket = this.connect(url);
                }, this.reconnectDelay * Math.pow(2, this.reconnectAttempts));
            } else {
                console.error('WebSocket: Max reconnection attempts reached');
            }
        };

        socket.onerror = (error) => {
            console.error('WebSocket: Error occurred:', error);
        };

        socket.onmessage = (event) => {
            console.log('WebSocket: Received message:', event.data);
            try {
                const data = JSON.parse(event.data);
                
                // For game state updates, extract the game state from the payload
                if (data.type === 'game_state_update') {
                    const gameState = data.payload?.gameState || data.payload || data;
                    console.log('WebSocket: Processed game state:', gameState);
                    
                    // Validate game state has required fields
                    if (!gameState || !gameState.players) {
                        console.error('WebSocket: Invalid game state received:', gameState);
                        return;
                    }
                    
                    this.messageCallbacks.forEach(callback => callback({
                        type: data.type,
                        playerId: data.playerId,
                        payload: { gameState }
                    }));
                } else {
                    // Pass through other message types as-is
                    this.messageCallbacks.forEach(callback => callback(data));
                }
            } catch (error) {
                console.error('WebSocket: Error parsing message:', error);
            }
        };

        return socket;
    }

    public send(data: any): void {
        if (this.socket.readyState === WebSocket.OPEN) {
            console.log('WebSocket: Sending message:', data);
            this.socket.send(JSON.stringify(data));
        } else {
            console.error('WebSocket: Cannot send message - connection not open');
        }
    }

    public onMessage(callback: (data: any) => void): void {
        this.messageCallbacks.push(callback);
    }

    public close(): void {
        this.socket.close();
    }
} 