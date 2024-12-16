import WebSocket from 'ws';
import { WebSocketMessage, GameAction } from '../../shared/types';
import { gameService } from '../services/gameService';

class GameWebSocket {
  private connections: Map<number, WebSocket[]>;

  constructor() {
    this.connections = new Map();
  }

  addConnection(gameId: number, ws: WebSocket): void {
    if (!this.connections.has(gameId)) {
      this.connections.set(gameId, []);
    }
    this.connections.get(gameId)?.push(ws);
  }

  removeConnection(gameId: number, ws: WebSocket): void {
    const connections = this.connections.get(gameId);
    if (connections) {
      const index = connections.indexOf(ws);
      if (index !== -1) {
        connections.splice(index, 1);
      }
    }
  }

  async broadcast(gameId: number, message: WebSocketMessage): Promise<void> {
    const connections = this.connections.get(gameId);
    if (connections) {
      const messageString = JSON.stringify(message);
      connections.forEach(ws => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(messageString);
        }
      });
    }
  }

  async broadcastGameAction(gameId: number, action: GameAction): Promise<void> {
    await this.broadcast(gameId, {
      type: 'player_action',
      action
    });
  }
}

export const gameWebSocket = new GameWebSocket(); 