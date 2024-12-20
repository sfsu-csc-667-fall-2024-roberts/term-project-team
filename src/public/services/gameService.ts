import { GameState } from '../../shared/types';
import { WebSocketService } from './webSocketService';

export class GameService {
    private webSocket: WebSocketService;
    private gameStateCallbacks: ((gameState: GameState) => void)[] = [];

    constructor(gameId: number) {
        this.webSocket = new WebSocketService(gameId);
        this.setupWebSocket();
    }

    private setupWebSocket(): void {
        this.webSocket.onMessage((data: any) => {
            console.log('GameService: Received message:', data);
            if (data.type === 'game_state_update' && data.payload?.gameState) {
                this.handleGameStateUpdate(data.payload.gameState);
            }
        });
    }

    private handleGameStateUpdate(gameState: GameState): void {
        console.log('GameService: Handling game state update:', gameState);
        this.gameStateCallbacks.forEach(callback => callback(gameState));
    }

    public onGameStateUpdate(callback: (gameState: GameState) => void): void {
        this.gameStateCallbacks.push(callback);
    }

    public startGame(): void {
        console.log('GameService: Starting game');
        this.webSocket.send({
            type: 'start_game'
        });
    }

    public rollDice(): void {
        console.log('GameService: Rolling dice');
        this.webSocket.send({
            type: 'roll_dice'
        });
    }

    public endTurn(): void {
        console.log('GameService: Ending turn');
        this.webSocket.send({
            type: 'end_turn'
        });
    }

    public buyProperty(): void {
        console.log('GameService: Buying property');
        this.webSocket.send({
            type: 'buy_property'
        });
    }

    public close(): void {
        this.webSocket.close();
    }
} 