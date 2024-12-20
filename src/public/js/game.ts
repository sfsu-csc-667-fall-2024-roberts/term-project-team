import { WebSocketService } from '../services/webSocketService';
import { UIManager } from './uiManager';
import { GameState, WebSocketMessage, Player, Property, MonopolyGameData, GameInstance } from '../../shared/types';

declare global {
    interface Window {
        GAME_ID: string;
        USER_TOKEN: string;
        INITIAL_STATE: any;
        monopolyGameData: MonopolyGameData;
    }
}

export class Game implements GameInstance {
    private webSocketService: WebSocketService;
    private uiManager: UIManager;
    private gameId: number;
    private token: string;

    constructor(gameId: number, token: string) {
        console.log('Game: Constructor called with:', { gameId, token: !!token });
        
        if (!gameId || !token) {
            console.error('Game: Invalid constructor parameters:', { gameId, hasToken: !!token });
            throw new Error('Invalid game parameters');
        }

        this.gameId = gameId;
        this.token = token;
        
        // Initialize UI first
        console.log('Game: Creating UIManager...');
        this.uiManager = new UIManager();
        
        // Initialize WebSocket after UI
        console.log('Game: Creating WebSocket service...');
        this.webSocketService = new WebSocketService(this.gameId);
    }

    public async init(): Promise<void> {
        // Setup WebSocket handlers
        console.log('Game: Setting up WebSocket handlers...');
        this.setupWebSocketHandlers();
        
        // Request current game state
        console.log('Game: Requesting current game state');
        this.requestGameState();
        
        console.log('Game: Starting game initialization...');
        await this.initializeGame();
    }

    private setupWebSocketHandlers(): void {
        console.log('Game: Setting up WebSocket handlers...');

        this.webSocketService.onMessage((data: any) => {
            console.log('Game: Received WebSocket message:', data);
            
            if (data.type === 'game_state_update') {
                console.log('Game: Handling game state update:', data.payload.gameState);
                this.handleGameStateUpdate(data.payload.gameState);
            } else if (data.type === 'error') {
                console.error('Game: WebSocket error:', data.payload.error);
                this.uiManager.showError(data.payload.error);
            }
        });

        // Request initial game state
        this.requestCurrentGameState();
    }

    private handleGameStateUpdate(data: any): void {
        console.log('Game: Handling game state update:', data);
        
        // Extract game state from the data, handling both message structures
        const gameState = data.gameState || data;
        
        if (!gameState || !gameState.players) {
            console.error('Game: Invalid game state received:', data);
            return;
        }
        
        // Update the global game state
        window.monopolyGameData.gameState = gameState;
        
        // Update UI
        this.uiManager.updateUI(gameState);
        
        // Handle automatic actions based on game state
        if (gameState.currentPlayerId === window.monopolyGameData.currentPlayerId) {
            if (gameState.gamePhase === 'ROLL') {
                this.uiManager.showMessage('Your turn! Roll the dice.');
            } else if (gameState.gamePhase === 'ACTION') {
                this.uiManager.showMessage('Take your action or end your turn.');
            }
        }
    }

    private requestCurrentGameState(): void {
        console.log('Game: Requesting current game state');
        this.webSocketService.send({
            type: 'request_game_state',
            playerId: window.monopolyGameData.currentPlayerId,
            payload: {}
        });
    }

    private requestGameState(): void {
        this.webSocketService.send({
            type: 'request_game_state',
            gameId: this.gameId
        });
    }

    public async initializeGame(): Promise<void> {
        console.log('Game: Starting game initialization...');
        
        try {
            console.log('Game: Fetching initial state from server...');
            const response = await fetch(`/game/${this.gameId}/state`, {
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });
            
            if (!response.ok) {
                throw new Error('Failed to fetch game state');
            }
            
            const initialState = await response.json();
            console.log('Game: Received initial state from server:', {
                gameId: initialState.id,
                gamePhase: initialState.gamePhase,
                players: initialState.players,
                currentPlayerId: initialState.currentPlayerId,
                currentUserId: window.monopolyGameData.currentUserId
            });
            
            // Initialize game state
            window.monopolyGameData.gameState = initialState;
            
            // Initialize UI
            this.uiManager.initializeUI(initialState);
            
            console.log('Game: Initial state processed successfully');
        } catch (error) {
            console.error('Game: Error initializing game:', error);
            this.uiManager.showError('Failed to initialize game. Please refresh the page.');
        }
    }

    async startGame(): Promise<void> {
        console.log('Starting game...');
        try {
            const response = await fetch(`/game/${this.gameId}/start`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                }
            });

            console.log('Start game response status:', response.status);
            if (!response.ok) {
                const errorText = await response.text();
                console.error('Failed to start game:', errorText);
                throw new Error(`Failed to start game: ${errorText}`);
            }

            const result = await response.json();
            console.log('Game started successfully:', result);
            
            // Update game state after starting
            await this.fetchAndUpdateGameState();
        } catch (error) {
            console.error('Error starting game:', error);
            throw error;
        }
    }

    async fetchAndUpdateGameState(): Promise<void> {
        console.log('Fetching game state...');
        try {
            const response = await fetch(`/game/${this.gameId}/state`, {
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });

            console.log('Game state response status:', response.status);
            if (!response.ok) {
                const errorText = await response.text();
                console.error('Failed to fetch game state:', errorText);
                throw new Error(`Failed to fetch game state: ${errorText}`);
            }

            const gameState = await response.json();
            console.log('Received game state:', gameState);
            
            // Update UI with new game state
            this.uiManager.updateUI(gameState);
            console.log('UI updated with new game state');
        } catch (error) {
            console.error('Error fetching game state:', error);
            throw error;
        }
    }
}

// Initialize the game when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    try {
        console.log('Game: DOM loaded, starting initialization');
        
        // Parse initialization parameters
        const gameId = parseInt(window.GAME_ID);
        const token = window.USER_TOKEN;
        
        console.log('Game: Parsed initialization parameters:', { gameId, hasToken: !!token });
        
        // Create game instance
        console.log('Game: Creating game instance');
        const game = new Game(gameId, token);
        
        // Initialize game
        console.log('Game: Initializing game');
        game.init();
        
        console.log('Game: Initialization completed successfully');
    } catch (error) {
        console.error('Game: Initialization failed:', error);
    }
}); 