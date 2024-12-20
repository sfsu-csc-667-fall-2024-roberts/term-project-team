import { Server } from 'http';
import { WebSocketManager } from './webSocketManager';

export function setupWebSocket(server: Server): void {
    console.log('\n=== Setting up WebSocket server ===');
    try {
        console.log('Initializing WebSocket manager...');
        const wsManager = WebSocketManager.getInstance(server);
        console.log('WebSocket manager initialized successfully');
        
        // Add error handler to the server
        server.on('upgrade', (request, socket, head) => {
            console.log('WebSocket upgrade request received');
            socket.on('error', (error) => {
                console.error('WebSocket upgrade error:', error);
                socket.destroy();
            });
        });

        console.log('=== WebSocket server setup completed successfully ===\n');
    } catch (error) {
        console.error('Failed to setup WebSocket server:', error);
        throw error;
    }
}

export { WebSocketManager } from './webSocketManager';
export { GameWebSocket } from './gameWebSocket'; 