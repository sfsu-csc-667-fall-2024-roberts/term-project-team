import { GameState, Player, Property, Card, SpaceAction, GameEvent, BoardSpace, MonopolyGameData } from '../../shared/types';
import { MonopolyBoard } from './board';
import { GameService } from '../services/gameService';

declare global {
    interface Window {
        monopolyGameData: MonopolyGameData;
    }
}

interface WebSocketMessage {
    type: string;
    playerId?: number;
    payload: {
        gameState?: GameState;
    };
}

export class UIManager {
    private static instance: UIManager | null = null;
    private readonly gameBoard: HTMLElement;
    private readonly playerInfoContainer: HTMLElement;
    private readonly gameLogContainer: HTMLElement | null;
    private readonly propertiesList: HTMLElement | null;
    private readonly playersList: HTMLElement | null;
    private readonly gamePhase: HTMLElement | null;
    private readonly board: MonopolyBoard;
    private gameState: GameState = {
        id: 0,
        gamePhase: 'WAITING',
        players: [],
        currentPlayerId: 0,
        properties: [],
        winner: null,
        doublesCount: 0,
        turnCount: 0,
        bankruptPlayers: [],
        jailFreeCards: {},
        gameLog: [],
        turnOrder: [],
        pendingTrades: []
    };
    private lastPhase: string = 'WAITING';
    private gameService: GameService;

    constructor() {
        console.log('UIManager: Starting initialization...');
        
        // Initialize DOM elements
        this.playersList = document.getElementById('players-list');
        this.propertiesList = document.getElementById('properties-list');
        this.gamePhase = document.getElementById('game-phase');
        this.gameLogContainer = document.getElementById('game-log');
        this.gameBoard = document.getElementById('monopoly-board') || document.createElement('div');
        this.playerInfoContainer = document.getElementById('player-info') || document.createElement('div');
        
        console.log('UIManager: DOM elements initialized:', {
            playersList: !!this.playersList,
            propertiesList: !!this.propertiesList,
            gamePhase: !!this.gamePhase,
            gameLogContainer: !!this.gameLogContainer,
            gameBoard: !!this.gameBoard,
            playerInfoContainer: !!this.playerInfoContainer
        });

        if (!this.playersList) {
            console.error('UIManager: Players list element not found');
        }
        if (!this.propertiesList) {
            console.error('UIManager: Properties list element not found');
        }
        if (!this.gamePhase) {
            console.error('UIManager: Game phase element not found');
        }
        if (!this.gameLogContainer) {
            console.error('UIManager: Game log container not found');
        }
        if (!this.gameBoard) {
            console.error('UIManager: Game board element not found');
        }
        if (!this.playerInfoContainer) {
            console.error('UIManager: Player info container element not found');
        }

        // Initialize board
        console.log('UIManager: Creating MonopolyBoard instance...');
        this.board = new MonopolyBoard();

        // Initialize game service
        const gameId = parseInt(window.location.pathname.split('/').pop() || '0');
        this.gameService = new GameService(gameId);
        
        // Set up game state update handler
        this.gameService.onGameStateUpdate((gameState: GameState) => {
            this.handleGameStateUpdate({
                type: 'game_state_update',
                payload: { gameState }
            });
        });
        
        // Set up button handlers
        this.setupButtonHandlers();
        
        console.log('UIManager: Initialization completed');
    }

    public static getInstance(): UIManager {
        if (!UIManager.instance) {
            UIManager.instance = new UIManager();
        }
        return UIManager.instance;
    }

    private getElement(id: string): HTMLElement | null {
        return document.getElementById(id);
    }

    private setInnerHTML(element: HTMLElement | null, html: string): void {
        if (element) {
            element.innerHTML = html;
        }
    }

    private setupEventListeners(): void {
        console.log('UIManager: Setting up event listeners');
        
        document.addEventListener('click', (e) => {
            const target = e.target as HTMLElement;
            
            if (target.matches('#roll-dice')) {
                console.log('UIManager: Roll dice button clicked');
                const button = target as HTMLButtonElement;
                if (!button.disabled) {
                    this.handleRollDice();
                }
            }
            
            if (target.matches('#end-turn')) {
                console.log('UIManager: End turn button clicked');
                const button = target as HTMLButtonElement;
                if (!button.disabled) {
                    this.handleEndTurn();
                }
            }

            if (target.matches('#start-game')) {
                console.log('UIManager: Start game button clicked');
                const button = target as HTMLButtonElement;
                if (!button.disabled) {
                    this.handleStartGame();
                }
            }
        });
    }

    private async handleRollDice(): Promise<void> {
        console.log('UIManager: Handling roll dice action');
        try {
            const response = await fetch(`/game/${window.monopolyGameData.gameId}/roll`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${window.monopolyGameData.token}`,
                    'Content-Type': 'application/json'
                }
            });
            
            if (!response.ok) {
                throw new Error('Failed to roll dice');
            }
            
            const result = await response.json();
            console.log('UIManager: Roll result:', result);

            if (result.dice && Array.isArray(result.dice) && result.dice.length === 2) {
                // Update dice display
                this.showDiceRoll(result.dice as [number, number], result.isDoubles);
                
                // Show roll message
                const total = result.dice[0] + result.dice[1];
                let message = `Rolled ${result.dice[0]} and ${result.dice[1]} (Total: ${total})`;
                
                // Handle different roll outcomes
                if (result.action === 'STILL_IN_JAIL') {
                    message += ' - Still in Jail';
                } else if (result.action === 'WENT_TO_JAIL') {
                    message += ' - Went to Jail!';
                } else if (result.isDoubles) {
                    message += ' - Doubles! Roll again.';
                }
                
                if (result.passedGo) {
                    message += ' - Passed GO, collect $200!';
                }
                
                this.showMessage(message);
                
                // Update game state
                if (result.gameState) {
                    window.monopolyGameData.gameState = result.gameState;
                    this.updateUI(result.gameState);
                }

                // Handle automatic actions based on game state
                if (result.gameState.gamePhase === 'ACTION') {
                    // TODO: Show property purchase/rent payment options if landed on property
                    const currentPlayer = result.gameState.players.find(
                        (p: Player) => p.id === result.gameState.currentPlayerId
                    );
                    
                    const currentSpace = result.gameState.properties.find(
                        (p: Property) => p.position === currentPlayer?.position
                    );
                    
                    if (currentSpace) {
                        if (!currentSpace.ownerId) {
                            this.showMessage(`Landed on ${currentSpace.name} - Available for purchase at $${currentSpace.price}`);
                        } else if (currentSpace.ownerId !== window.monopolyGameData.currentPlayerId) {
                            const owner = result.gameState.players.find((p: Player) => p.id === currentSpace.ownerId);
                            this.showMessage(`Landed on ${currentSpace.name} - Pay rent $${currentSpace.rent} to ${owner?.username}`);
                        }
                    }
                }
            } else {
                console.error('UIManager: Invalid dice roll result:', result);
                this.showMessage('Invalid dice roll result');
            }
        } catch (error) {
            console.error('UIManager: Error rolling dice:', error);
            this.showMessage('Failed to roll dice');
        }
    }

    private async handleEndTurn(): Promise<void> {
        console.log('UIManager: Handling end turn action');
        try {
            const response = await fetch(`/game/${window.monopolyGameData.gameId}/end-turn`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${window.monopolyGameData.token}`,
                    'Content-Type': 'application/json'
                }
            });
            
            if (!response.ok) {
                throw new Error('Failed to end turn');
            }
            
            console.log('UIManager: Turn ended successfully');
        } catch (error) {
            console.error('UIManager: Error ending turn:', error);
            this.showMessage('Failed to end turn');
        }
    }

    private async handleStartGame(): Promise<void> {
        console.log('UIManager: Handling start game action');
        
        const startButton = document.getElementById('start-game-button') as HTMLButtonElement;
        if (!startButton || startButton.disabled) {
            return;
        }
        
        try {
            // Disable button to prevent multiple clicks
            startButton.disabled = true;
            
            console.log('UIManager: Making start game request to server...');
            console.log('UIManager: Game ID:', window.monopolyGameData.gameId);
            console.log('UIManager: Token:', window.monopolyGameData.token ? 'Present' : 'Missing');
            
            const response = await fetch(`/game/${window.monopolyGameData.gameId}/start`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${window.monopolyGameData.token}`,
                    'Content-Type': 'application/json'
                }
            });
            
            console.log('UIManager: Start game response status:', response.status);
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => null);
                console.error('UIManager: Start game failed:', {
                    status: response.status,
                    statusText: response.statusText,
                    error: errorData
                });
                throw new Error(`Failed to start game: ${response.statusText}`);
            }
            
            const result = await response.json();
            console.log('UIManager: Start game response:', result);
            
            // Update UI immediately with the response
            if (result.gameState) {
                this.updateUI(result.gameState);
            }
            
            // Show message to indicate game has started
            this.showMessage('Game started! Waiting for first player to roll...');
            
            // Hide start button since game has started
            startButton.style.display = 'none';
            
        } catch (error) {
            console.error('UIManager: Error starting game:', error);
            this.showMessage('Failed to start game. Please try again.');
            // Re-enable button on error
            startButton.disabled = false;
        }
    }

    public initializeUI(gameState: GameState): void {
        console.log('UIManager: Initializing UI with game state:', gameState);
        
        if (!gameState) {
            console.error('UIManager: Cannot initialize UI with null game state');
            return;
        }
        
        // Initialize board first
        console.log('UIManager: Initializing board...');
        this.board.initializeBoard();
        
        // Update game phase
        console.log('UIManager: Updating game phase to:', gameState.gamePhase);
        if (this.gamePhase) {
            this.gamePhase.textContent = gameState.gamePhase || 'WAITING';
        }
        
        // Update players list
        console.log('UIManager: Updating players list with:', gameState.players);
        if (Array.isArray(gameState.players)) {
            this.updatePlayersList(gameState.players);
        } else {
            console.error('UIManager: Invalid players data in game state');
        }
        
        // Update properties panel
        console.log('UIManager: Updating properties panel with:', gameState.properties);
        if (Array.isArray(gameState.properties)) {
            this.updatePropertiesPanel(gameState.properties);
        } else {
            console.error('UIManager: Invalid properties data in game state');
        }
        
        // Update board with game state
        console.log('UIManager: Updating board with game state...');
        this.board.updateBoard(gameState);
        
        console.log('UIManager: UI initialization completed');
    }

    public updateUI(gameState?: GameState): void {
        const state = gameState || this.gameState;
        
        // Update game phase display
        if (this.gamePhase) {
            this.gamePhase.textContent = state.gamePhase;
        }
        
        // Update board
        this.board.updateBoard(state);
        
        // Update other UI elements as needed
        this.updateTurnControls(
            state.currentPlayerId === window.monopolyGameData.currentPlayerId,
            state.gamePhase === 'ROLL',
            state.gamePhase === 'ACTION'
        );
        this.updatePlayersList(state.players);
        this.updatePropertiesPanel(state.properties);
    }

    public updateTurnControls(isCurrentTurn: boolean, canRoll: boolean, canEndTurn: boolean): void {
        const rollButton = document.getElementById('roll-dice') as HTMLButtonElement | null;
        const endTurnButton = document.getElementById('end-turn') as HTMLButtonElement | null;
        
        if (rollButton) {
            rollButton.disabled = !canRoll;
            console.log('UIManager: Roll button state updated:', { disabled: !canRoll });
        }
        if (endTurnButton) {
            endTurnButton.disabled = !canEndTurn;
            console.log('UIManager: End turn button state updated:', { disabled: !canEndTurn });
        }
    }

    private updatePlayersList(players: Player[]): void {
        console.log('UIManager: Updating players list with:', players);
        const playersList = this.playersList;
        if (!playersList) {
            console.error('UIManager: Players list element not found');
            return;
        }

        if (!Array.isArray(players)) {
            console.error('UIManager: Invalid players data:', players);
            return;
        }

        // Clear existing players
        playersList.innerHTML = '';
        console.log('UIManager: Cleared existing players list');
        
        // Add game controls section at the top if in WAITING phase and current player is first player
        const isWaitingPhase = window.monopolyGameData?.gameState?.gamePhase === 'WAITING';
        const hasEnoughPlayers = players.length >= 2;
        const isFirstPlayer = players[0]?.id === window.monopolyGameData?.currentPlayerId;
        
        console.log('UIManager: Start game button conditions:', {
            isWaitingPhase,
            hasEnoughPlayers,
            isFirstPlayer,
            gamePhase: window.monopolyGameData?.gameState?.gamePhase,
            playersLength: players.length,
            firstPlayerId: players[0]?.id,
            currentPlayerId: window.monopolyGameData?.currentPlayerId
        });
        
        if (isWaitingPhase && hasEnoughPlayers && isFirstPlayer) {
            console.log('UIManager: Creating start game button');
            const gameControlsSection = document.createElement('div');
            gameControlsSection.className = 'game-controls-section';
            
            const playersReadyText = document.createElement('div');
            playersReadyText.className = 'players-ready-text';
            playersReadyText.textContent = `${players.length} Players Ready`;
            
            const startGameButton = document.createElement('button');
            startGameButton.id = 'start-game-button';
            startGameButton.className = 'start-game-button';
            startGameButton.innerHTML = `
                <span class="button-icon">▶</span>
                <span class="button-text">Start Game</span>
            `;
            
            // Add click handler directly here
            startGameButton.addEventListener('click', () => {
                console.log('UIManager: Start game button clicked');
                this.handleStartGame();
            });
            
            gameControlsSection.appendChild(playersReadyText);
            gameControlsSection.appendChild(startGameButton);
            
            // Add the game controls section to the players list
            playersList.appendChild(gameControlsSection);
            console.log('UIManager: Added start game button to DOM');
            
            // Add a divider
            const divider = document.createElement('div');
            divider.className = 'section-divider';
            playersList.appendChild(divider);
        } else {
            console.log('UIManager: Not showing start game button due to conditions not met');
        }
        
        // Create players list header
        const playersHeader = document.createElement('div');
        playersHeader.className = 'players-list-header';
        playersHeader.textContent = 'Players';
        playersList.appendChild(playersHeader);
        
        // Create players list
        players.forEach(player => {
            console.log('UIManager: Processing player:', player);
            if (!player || typeof player.id === 'undefined') {
                console.error('UIManager: Invalid player data:', player);
                return;
            }

            const isCurrentPlayer = player.id === window.monopolyGameData?.currentPlayerId;
            const isCurrentTurn = player.id === window.monopolyGameData?.gameState?.currentPlayerId;
            const playerProperties = window.monopolyGameData?.gameState?.properties?.filter(p => p.ownerId === player.id) || [];
            
            console.log('UIManager: Player status:', {
                id: player.id,
                isCurrentPlayer,
                isCurrentTurn,
                propertiesCount: playerProperties.length
            });

            const playerElement = document.createElement('div');
            playerElement.className = `player-card ${isCurrentPlayer ? 'current-player' : ''} ${isCurrentTurn ? 'active-turn' : ''}`;
            
            playerElement.innerHTML = `
                <div class="player-info">
                    <div class="player-name">
                        ${player.username || `Player ${player.id}`}
                        ${isCurrentPlayer ? '<span class="player-you">(You)</span>' : ''}
                        ${isCurrentTurn ? '<span class="player-turn">Current Turn</span>' : ''}
                    </div>
                    <div class="player-stats">
                        <div class="player-money" id="player-${player.id}-money">$${player.money}</div>
                        <div class="player-position">Position: ${player.position}</div>
                        ${player.isJailed ? '<div class="player-jail-status">In Jail</div>' : ''}
                        <div class="player-properties">Properties: ${playerProperties.length}</div>
                    </div>
                </div>
            `;
            
            playersList.appendChild(playerElement);
            console.log('UIManager: Added player element to list:', player.id);
        });
    }

    private getPlayerPropertyCount(playerId: number): number {
        return window.monopolyGameData.gameState.properties.filter(p => p.ownerId === playerId).length;
    }

    private updatePropertiesPanel(properties: Property[]): void {
        console.log('UIManager: Updating properties panel with:', properties);
        if (!this.propertiesList) {
            console.error('UIManager: Properties list element not found');
            return;
        }

        // Group properties by color
        const groupedProperties = properties.reduce((groups: { [key: string]: Property[] }, property) => {
            const group = property.colorGroup || 'Other';
            if (!groups[group]) {
                groups[group] = [];
            }
            groups[group].push(property);
            return groups;
        }, {});

        this.propertiesList.innerHTML = '';
        
        Object.entries(groupedProperties).forEach(([group, props]) => {
            const groupElement = document.createElement('div');
            groupElement.className = 'property-group';
            groupElement.innerHTML = `<h3>${group}</h3>`;
            
            props.forEach(property => {
                const propertyCard = document.createElement('div');
                propertyCard.className = `property-card ${property.colorGroup?.toLowerCase() || ''}`;
                propertyCard.innerHTML = `
                    <div class="property-name">${property.name}</div>
                    <div class="property-price">$${property.price || 0}</div>
                    <div class="property-rent">Rent: $${property.rent || 0}</div>
                `;
                groupElement.appendChild(propertyCard);
            });
            
            this.propertiesList?.appendChild(groupElement);
        });
    }

    public showError(message: string): void {
        const errorContainer = document.getElementById('error-container') || this.createErrorContainer();
        errorContainer.textContent = message;
        errorContainer.classList.add('show');
        setTimeout(() => errorContainer.classList.remove('show'), 3000);
    }

    public showMessage(message: string): void {
        console.log('UIManager: Showing message:', message);
        // Check if this message already exists in the game log
        const logContent = this.gameLogContainer?.querySelector('.game-log-content');
        if (logContent) {
            const lastMessage = logContent.lastElementChild?.querySelector('.description')?.textContent;
            if (lastMessage === message) {
                console.log('UIManager: Skipping duplicate message:', message);
                return;
            }
        }
        
        this.addToGameLog({
            type: 'message',
            description: message,
            timestamp: Date.now()
        });
    }

    public showGameEvent(event: string | GameEvent): void {
        if (typeof event === 'string') {
            this.addToGameLog({
                type: 'event',
                description: event,
                timestamp: Date.now()
            });
        } else {
            this.addToGameLog(event);
        }
    }

    private addToGameLog(event: GameEvent): void {
        if (!this.gameLogContainer) {
            console.error('UIManager: Game log container not found');
            return;
        }

        const logContent = this.gameLogContainer.querySelector('.game-log-content');
        if (!logContent) {
            console.error('UIManager: Game log content not found');
            return;
        }

        const eventElement = document.createElement('div');
        const timestamp = event.timestamp ? new Date(event.timestamp).toLocaleTimeString() : new Date().toLocaleTimeString();
        
        eventElement.className = `game-event game-event-${event.type}`;
        eventElement.innerHTML = `
            <span class="message-timestamp">[${timestamp}]</span>
            <span class="description">${event.description}</span>
        `;
        
        logContent.appendChild(eventElement);
        logContent.scrollTop = logContent.scrollHeight;
        
        // Keep only the last 50 messages
        const messages = Array.from(logContent.children);
        while (messages.length > 50 && logContent.firstChild) {
            logContent.removeChild(logContent.firstChild);
        }
    }

    public updateDiceRoll(dice: [number, number], isDoubles: boolean): void {
        const diceContainer = document.getElementById('dice-container');
        if (!diceContainer) return;

        diceContainer.innerHTML = `
            <div class="dice dice-${dice[0]}">${dice[0]}</div>
            <div class="dice dice-${dice[1]}">${dice[1]}</div>
        `;

        if (isDoubles) {
            diceContainer.classList.add('doubles');
            setTimeout(() => diceContainer.classList.remove('doubles'), 1500);
        }
    }

    public showPropertyCard(property: Property): void {
        const propertyCard = document.getElementById('property-card') || this.createPropertyCard();
        propertyCard.innerHTML = `
            <div class="property-card-content">
                <div class="property-card-header ${property.colorGroup || ''}">
                    <h3>${property.name}</h3>
                    <button class="property-card-close">&times;</button>
                </div>
                <div class="property-card-body">
                    <div class="property-price">Price: $${property.price}</div>
                    <div class="property-rent">Rent: $${property.rent}</div>
                    ${property.mortgaged ? '<div class="mortgaged">Mortgaged</div>' : ''}
                </div>
            </div>
        `;
        propertyCard.classList.add('show');
    }

    public showTaxPayment(amount: number): void {
        const notification = document.createElement('div');
        notification.className = 'notification tax-payment';
        notification.innerHTML = `
            <h3>Tax Payment</h3>
            <p>You must pay $${amount} in tax</p>
        `;
        document.body.appendChild(notification);
        setTimeout(() => notification.remove(), 3000);
    }

    public showCard(card: Card): void {
        const cardElement = document.createElement('div');
        cardElement.className = `card ${card.type}-card`;
        cardElement.innerHTML = `
            <div class="card-content">
                <h3>${card.type === 'chance' ? 'Chance' : 'Community Chest'}</h3>
                <p>${card.text}</p>
                ${card.action ? `<p class="card-action">${card.action}</p>` : ''}
            </div>
        `;
        document.body.appendChild(cardElement);
        setTimeout(() => cardElement.remove(), 4000);
    }

    public updatePlayerMoney(playerId: number, amount: number): void {
        const playerMoneyElement = document.getElementById(`player-${playerId}-money`);
        if (!playerMoneyElement) return;
        playerMoneyElement.textContent = `$${amount}`;
        playerMoneyElement.classList.add('money-update');
        setTimeout(() => playerMoneyElement.classList.remove('money-update'), 1000);
    }

    public updatePropertyOwnership(propertyId: number, ownerId: number): void {
        const propertyElement = document.getElementById(`property-${propertyId}`);
        if (!propertyElement) {
            console.error(`Property element not found for ID: ${propertyId}`);
            return;
        }

        // Remove existing ownership classes
        propertyElement.classList.remove('owned', 'owned-by-current-player');

        if (ownerId > 0) {
            propertyElement.classList.add('owned');
            if (ownerId === window.monopolyGameData.currentPlayerId) {
                propertyElement.classList.add('owned-by-current-player');
            }
        }
    }

    private setupBoard(): void {
        console.log('Setting up game board');
        const gameBoard = this.gameBoard;
        if (!gameBoard) {
            console.error('Game board element not found');
            return;
        }
        
        gameBoard.innerHTML = '';
        
        // Define board spaces
        const boardSpaces: BoardSpace[] = [
            { position: 0, name: 'GO', type: 'corner' },
            { position: 1, name: 'Mediterranean Avenue', type: 'property', price: 60, rent: 2, colorGroup: 'brown' },
            { position: 2, name: 'Community Chest', type: 'chest' },
            { position: 3, name: 'Baltic Avenue', type: 'property', price: 60, rent: 4, colorGroup: 'brown' },
            { position: 4, name: 'Income Tax', type: 'tax', price: 200 },
            { position: 5, name: 'Reading Railroad', type: 'railroad', price: 200, rent: 25 },
            { position: 6, name: 'Oriental Avenue', type: 'property', price: 100, rent: 6, colorGroup: 'light-blue' },
            { position: 7, name: 'Chance', type: 'chance' },
            { position: 8, name: 'Vermont Avenue', type: 'property', price: 100, rent: 6, colorGroup: 'light-blue' },
            { position: 9, name: 'Connecticut Avenue', type: 'property', price: 120, rent: 8, colorGroup: 'light-blue' },
            { position: 10, name: 'JAIL', type: 'corner' },
            { position: 11, name: 'St. Charles Place', type: 'property', price: 140, rent: 10, colorGroup: 'pink' },
            { position: 12, name: 'Electric Company', type: 'utility', price: 150, rent: 4 },
            { position: 13, name: 'States Avenue', type: 'property', price: 140, rent: 10, colorGroup: 'pink' },
            { position: 14, name: 'Virginia Avenue', type: 'property', price: 160, rent: 12, colorGroup: 'pink' },
            { position: 15, name: 'Pennsylvania Railroad', type: 'railroad', price: 200, rent: 25 },
            { position: 16, name: 'St. James Place', type: 'property', price: 180, rent: 14, colorGroup: 'orange' },
            { position: 17, name: 'Community Chest', type: 'chest' },
            { position: 18, name: 'Tennessee Avenue', type: 'property', price: 180, rent: 14, colorGroup: 'orange' },
            { position: 19, name: 'New York Avenue', type: 'property', price: 200, rent: 16, colorGroup: 'orange' },
            { position: 20, name: 'FREE PARKING', type: 'corner' },
            { position: 21, name: 'Kentucky Avenue', type: 'property', price: 220, rent: 18, colorGroup: 'red' },
            { position: 22, name: 'Chance', type: 'chance' },
            { position: 23, name: 'Indiana Avenue', type: 'property', price: 220, rent: 18, colorGroup: 'red' },
            { position: 24, name: 'Illinois Avenue', type: 'property', price: 240, rent: 20, colorGroup: 'red' },
            { position: 25, name: 'B. & O. Railroad', type: 'railroad', price: 200, rent: 25 },
            { position: 26, name: 'Atlantic Avenue', type: 'property', price: 260, rent: 22, colorGroup: 'yellow' },
            { position: 27, name: 'Ventnor Avenue', type: 'property', price: 260, rent: 22, colorGroup: 'yellow' },
            { position: 28, name: 'Water Works', type: 'utility', price: 150, rent: 4 },
            { position: 29, name: 'Marvin Gardens', type: 'property', price: 280, rent: 24, colorGroup: 'yellow' },
            { position: 30, name: 'GO TO JAIL', type: 'corner' },
            { position: 31, name: 'Pacific Avenue', type: 'property', price: 300, rent: 26, colorGroup: 'green' },
            { position: 32, name: 'North Carolina Avenue', type: 'property', price: 300, rent: 26, colorGroup: 'green' },
            { position: 33, name: 'Community Chest', type: 'chest' },
            { position: 34, name: 'Pennsylvania Avenue', type: 'property', price: 320, rent: 28, colorGroup: 'green' },
            { position: 35, name: 'Short Line Railroad', type: 'railroad', price: 200, rent: 25 },
            { position: 36, name: 'Chance', type: 'chance' },
            { position: 37, name: 'Park Place', type: 'property', price: 350, rent: 35, colorGroup: 'blue' },
            { position: 38, name: 'Luxury Tax', type: 'tax', price: 100 },
            { position: 39, name: 'Boardwalk', type: 'property', price: 400, rent: 50, colorGroup: 'blue' }
        ];
        
        // Create board spaces
        boardSpaces.forEach(space => {
            const spaceElement = document.createElement('div');
            spaceElement.className = `board-space space-${space.position}`;
            spaceElement.id = `space-${space.position}`;
            
            // Add color groups to properties
            if (space.colorGroup) {
                spaceElement.classList.add(space.colorGroup);
            }
            
            // Add space type
            spaceElement.classList.add(`space-type-${space.type}`);
            
            // Add space content
            const content = document.createElement('div');
            content.className = 'space-content';
            
            if (space.type === 'corner') {
                content.innerHTML = `<div class="space-label">${space.name}</div>`;
            } else if (space.type === 'property' || space.type === 'railroad' || space.type === 'utility') {
                content.innerHTML = `
                    <div class="space-name">${space.name}</div>
                    ${space.price ? `<div class="space-price">$${space.price}</div>` : ''}
                `;
            } else if (space.type === 'tax') {
                content.innerHTML = `
                    <div class="space-name">${space.name}</div>
                    <div class="space-price">Pay $${space.price}</div>
                `;
            } else {
                content.innerHTML = `<div class="space-name">${space.name}</div>`;
            }
            
            spaceElement.appendChild(content);
            this.gameBoard.appendChild(spaceElement);
        });
        
        // Create board center
        const centerArea = document.createElement('div');
        centerArea.className = 'board-center';
        centerArea.innerHTML = '<div class="monopoly-logo">MONOPOLY</div>';
        this.gameBoard.appendChild(centerArea);
        
        // Create player tokens
        const gameData = window.monopolyGameData;
        if (gameData && gameData.gameState && gameData.gameState.players) {
            gameData.gameState.players.forEach(player => {
                const token = document.createElement('div');
                token.id = `player-token-${player.id}`;
                token.className = `player-token player-token-${player.id}`;
                const space = document.getElementById(`space-${player.position}`);
                if (space) {
                    space.appendChild(token);
                }
            });
        }
    }

    private setupPlayers(players: Player[]): void {
        console.log('Setting up players:', players);
        if (!this.playerInfoContainer) {
            console.error('Player info container not found');
            return;
        }
        
        this.playerInfoContainer.innerHTML = '';
        
        // Create players section header
        const header = document.createElement('div');
        header.className = 'section-header';
        header.innerHTML = '<h2>Players</h2>';
        this.playerInfoContainer.appendChild(header);
        
        // Create players list
        const playersList = document.createElement('div');
        playersList.className = 'players-list';
        
        players.forEach(player => {
            const playerElement = document.createElement('div');
            playerElement.className = `player-card ${player.id === window.monopolyGameData.currentPlayerId ? 'current-player' : ''}`;
            playerElement.innerHTML = `
                <div class="player-info">
                    <div class="player-name">
                        ${player.username}
                        ${player.id === window.monopolyGameData.currentPlayerId ? '<span class="player-you">(You)</span>' : ''}
                    </div>
                    <div class="player-stats">
                        <div class="player-money" id="player-${player.id}-money">$${player.money}</div>
                        <div class="player-position">Position: ${player.position}</div>
                        ${player.isJailed ? '<div class="player-jail-status">In Jail</div>' : ''}
                    </div>
                    <div class="player-token token-${player.id}"></div>
                </div>
            `;
            playersList.appendChild(playerElement);
        });
        
        this.playerInfoContainer.appendChild(playersList);
    }

    public updatePlayers(players: Player[]): void {
        console.log('Updating players:', players);
        if (!this.playerInfoContainer) {
            console.error('Player info container not found');
            return;
        }
        
        const playersList = this.playerInfoContainer.querySelector('.players-list');
        if (!playersList) {
            this.setupPlayers(players);
            return;
        }
        
        playersList.innerHTML = '';
        players.forEach(player => {
            const playerElement = document.createElement('div');
            playerElement.className = `player-card ${player.id === window.monopolyGameData.currentPlayerId ? 'current-player' : ''}`;
            playerElement.innerHTML = `
                <div class="player-info">
                    <div class="player-name">
                        ${player.username}
                        ${player.id === window.monopolyGameData.currentPlayerId ? '<span class="player-you">(You)</span>' : ''}
                    </div>
                    <div class="player-stats">
                        <div class="player-money" id="player-${player.id}-money">$${player.money}</div>
                        <div class="player-position">Position: ${player.position}</div>
                        ${player.isJailed ? '<div class="player-jail-status">In Jail</div>' : ''}
                    </div>
                    <div class="player-token token-${player.id}"></div>
                </div>
            `;
            playersList.appendChild(playerElement);
        });
    }

    private updateBoard(gameState: GameState): void {
        console.log('Updating board with game state:', gameState);
        if (!gameState) {
            console.error('Game state is null');
            return;
        }

        gameState.properties.forEach(property => {
            const propertyElement = document.getElementById(`property-${property.id}`);
            if (!propertyElement) {
                console.error(`Property element not found for ID: ${property.id}`);
                return;
            }
            this.updatePropertyOwnership(property.id, property.ownerId || 0);
        });

        gameState.players.forEach(player => {
            const playerToken = document.getElementById(`player-token-${player.id}`);
            const spaceElement = document.getElementById(`space-${player.position}`);
            if (playerToken && spaceElement) {
                spaceElement.appendChild(playerToken);
            } else {
                console.error(`Player token or space element not found for player ${player.id}`);
            }
        });
    }

    private handleMortgageProperty(propertyId: number): void {
        // TODO: Implement mortgage property logic
        console.log('Mortgage property:', propertyId);
    }

    private handleUnmortgageProperty(propertyId: number): void {
        // TODO: Implement unmortgage property logic
        console.log('Unmortgage property:', propertyId);
    }

    private updateCurrentPlayer(playerId: number): void {
        console.log('Updating current player:', playerId);
        const currentPlayerElement = document.getElementById('current-player');
        if (!currentPlayerElement) {
            console.error('Current player element not found');
            return;
        }
        currentPlayerElement.textContent = `Current Player: ${playerId}`;
    }

    private updatePhase(phase: string): void {
        console.log('Updating game phase:', phase);
        const phaseElement = document.getElementById('game-phase');
        if (!phaseElement) {
            console.error('Game phase element not found');
            return;
        }
        phaseElement.textContent = `Phase: ${phase}`;
    }

    public showGameOver(winner: Player): void {
        const gameOverModal = document.createElement('div');
        gameOverModal.className = 'modal game-over-modal';
        gameOverModal.innerHTML = `
            <div class="modal-content">
                <h2>Game Over!</h2>
                <p>Winner: ${winner.username}</p>
                <p>Final Balance: $${winner.money}</p>
                <button onclick="window.location.href='/lobby'">Return to Lobby</button>
            </div>
        `;
        document.body.appendChild(gameOverModal);
    }

    private createErrorContainer(): HTMLElement {
        const container = document.createElement('div');
        container.id = 'error-container';
        container.className = 'error-container';
        document.body.appendChild(container);
        return container;
    }

    private createPropertyCard(): HTMLElement {
        const card = document.createElement('div');
        card.id = 'property-card';
        card.className = 'property-card';
        document.body.appendChild(card);
        return card;
    }

    private hidePropertyCard(): void {
        const propertyCard = document.getElementById('property-card');
        if (!propertyCard) return;
        propertyCard.classList.remove('show');
    }

    public showDiceRoll(dice: [number, number], isDoubles: boolean): void {
        const diceContainer = document.getElementById('dice-container');
        if (!diceContainer) {
            console.error('Dice container not found');
            return;
        }

        diceContainer.innerHTML = `
            <div class="dice dice-${dice[0]}">${dice[0]}</div>
            <div class="dice dice-${dice[1]}">${dice[1]}</div>
        `;

        if (isDoubles) {
            diceContainer.classList.add('doubles');
            setTimeout(() => diceContainer.classList.remove('doubles'), 1500);
        }
    }

    private setupEventHandlers(): void {
        console.log('Setting up UI event handlers');
        
        // Start Game button
        const startGameButton = document.getElementById('start-game-btn');
        if (startGameButton) {
            startGameButton.addEventListener('click', async () => {
                console.log('Start Game button clicked');
                try {
                    await window.monopolyGameData.game.startGame();
                    console.log('Game started successfully');
                } catch (error) {
                    console.error('Failed to start game:', error);
                    this.showError('Failed to start game. Please try again.');
                }
            });
        }

        // Roll Dice button
        const rollDiceButton = document.getElementById('roll-dice-btn');
        if (rollDiceButton) {
            rollDiceButton.addEventListener('click', async () => {
                console.log('Roll Dice button clicked');
                try {
                    await this.handleRollDice();
                } catch (error) {
                    console.error('Failed to roll dice:', error);
                    this.showError('Failed to roll dice. Please try again.');
                }
            });
        }

        // End Turn button
        const endTurnButton = document.getElementById('end-turn-btn');
        if (endTurnButton) {
            endTurnButton.addEventListener('click', async () => {
                console.log('End Turn button clicked');
                try {
                    await this.handleEndTurn();
                } catch (error) {
                    console.error('Failed to end turn:', error);
                    this.showError('Failed to end turn. Please try again.');
                }
            });
        }
    }

    private handleGameStateUpdate(data: WebSocketMessage) {
        console.log('Handling game state update:', data);
        
        if (!data.payload?.gameState) {
            console.error('Invalid game state update received:', data);
            return;
        }
        
        const gameState = data.payload.gameState;
        
        // Validate required fields
        if (typeof gameState.id !== 'number' || !Array.isArray(gameState.players)) {
            console.error('Invalid game state structure:', gameState);
            return;
        }
        
        // Update local game state
        this.gameState = {
            ...this.gameState,
            ...gameState
        };
        
        // Update UI elements based on game state
        this.updateUI();
        
        // Log game state change if phase changed
        if (this.lastPhase !== gameState.gamePhase) {
            this.addToGameLog({
                type: 'PHASE_CHANGE',
                description: `Game phase changed to: ${gameState.gamePhase}`,
                timestamp: Date.now()
            });
            this.lastPhase = gameState.gamePhase;
        }
        
        // Update current player indicator
        if (gameState.currentPlayerId) {
            const currentPlayer = gameState.players.find((p: Player) => p.id === gameState.currentPlayerId);
            if (currentPlayer) {
                this.addToGameLog({
                    type: 'TURN_CHANGE',
                    description: `Current turn: ${currentPlayer.username}`,
                    timestamp: Date.now()
                });
            }
        }
    }

    private setupButtonHandlers(): void {
        const rollDiceButton = document.getElementById('roll-dice-button');
        const endTurnButton = document.getElementById('end-turn-button');
        const buyPropertyButton = document.getElementById('buy-property-button');
        
        if (rollDiceButton) {
            rollDiceButton.addEventListener('click', () => {
                console.log('UIManager: Roll dice button clicked');
                this.gameService.rollDice();
            });
        }
        
        if (endTurnButton) {
            endTurnButton.addEventListener('click', () => {
                console.log('UIManager: End turn button clicked');
                this.gameService.endTurn();
            });
        }
        
        if (buyPropertyButton) {
            buyPropertyButton.addEventListener('click', () => {
                console.log('UIManager: Buy property button clicked');
                this.gameService.buyProperty();
            });
        }
    }
}

export const uiManager = UIManager.getInstance(); 