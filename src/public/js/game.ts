import { GameData, Player, Property, GameState, PlayerWithRoll, RollResponse, GamePhase, Card, TradeProposal, AuctionState, SpaceAction, GameEvent, GameEventType } from '../../shared/types';
import { BOARD_SPACES } from '../../shared/boardData';
import MonopolyBoard from './board';

const GAME_PHASES = {
    WAITING: 'waiting' as GamePhase,
    ROLLING: 'rolling' as GamePhase,
    PROPERTY_DECISION: 'property_decision' as GamePhase,
    PAYING_RENT: 'paying_rent' as GamePhase,
    IN_JAIL: 'in_jail' as GamePhase,
    BANKRUPT: 'bankrupt' as GamePhase,
    GAME_OVER: 'game_over' as GamePhase,
    PLAYING: 'playing' as GamePhase,
    AUCTION: 'auction' as GamePhase,
    END_TURN: 'end_turn' as GamePhase
};

interface MessageHistoryItem {
    message: string;
    timestamp: Date;
}

interface PropertyGroup {
    available: Property[];
    owned: Property[];
    yours: Property[];
}

interface PropertyTabs {
    available: HTMLDivElement;
    owned: HTMLDivElement;
    yours: HTMLDivElement;
}

interface BotActionResponse {
    action: string;
    success: boolean;
    message: string;
    gameState: GameState;
}

interface GameMessage {
    type: 'roll' | 'purchase' | 'error';
    message?: string;
    player?: Player;
    property?: Property;
    roll?: number;
    dice?: [number, number];
}

export class GameService {
    private readonly gameData: GameData;
    private messageContainer: HTMLElement;
    private board: MonopolyBoard;
    private isProcessingBotTurn: boolean = false;
    private statusElement: HTMLElement;
    private playersElement: HTMLElement;
    private messageHistory: MessageHistoryItem[] = [];
    private messageHistoryPanel: HTMLElement | null = null;
    private static instance: GameService | null = null;
    private _lastMessageTime: number | null = null;
    private _messageQueue: Array<{ message: string, delay: number }> = [];
    private _isProcessingMessages: boolean = false;
    private _isPurchaseInProgress: boolean = false;
    private _lastPurchasePosition: number | null = null;
    private _isProcessingRoll: boolean = false;
    private _lastRollTimestamp: number = 0;
    private readonly ROLL_DEBOUNCE_MS: number = 1000;

    constructor(gameData: GameData) {
        console.log('GameService constructor called');
        console.log('Initial game data:', gameData);
        
        // Singleton pattern to ensure only one game service instance
        if (GameService.instance) {
            console.log('Existing game service instance found, cleaning up');
            GameService.instance.cleanup();
        }

        // Initialize game data with proper types
        this.gameData = {
            ...gameData,
            currentPlayerId: gameData.currentPlayerId,
            gameState: gameData.gameState || this.createDefaultGameState(gameData.gameId)
        };

        // Initialize UI elements
        this.messageContainer = document.querySelector('.game-messages') as HTMLElement;
        this.statusElement = document.querySelector('.game-status') as HTMLElement;
        this.playersElement = document.querySelector('.players-list') as HTMLElement;
        
        // Initialize board
        console.log('Initializing new board instance');
        this.board = new MonopolyBoard('monopoly-board');

        // Initialize UI components
        this.initializeEventListeners();
        this.initializeBoard();
        this.updateGameStatus();
        this.updatePlayersStatus();
        this.updatePropertiesPanel();
        
        // Initialize message history
        this.initializeMessageHistory();
        
        // Set singleton instance
        GameService.instance = this;
        
        // Check for bot turn after initialization
        this.checkForBotTurn();
        
        console.log('Game service initialized with state:', this.gameData.gameState);
    }

    private createDefaultGameState(gameId: number): GameState {
        // Use the player's ID if available, otherwise -1
        const effectiveCurrentPlayerId = this.gameData.players.find(p => p.userId === this.gameData.currentPlayerId)?.id ?? -1;
        
        return {
            id: gameId,
            phase: 'waiting',
            currentPlayerId: effectiveCurrentPlayerId,
            currentPlayerIndex: 0,
            players: this.gameData.players.map(player => ({
                ...player,
                position: 0,
                money: 1500,
                balance: 1500,
                inJail: false,
                jailTurns: 0,
                isBankrupt: false,
                turnOrder: 0
            })),
            properties: this.gameData.properties || [],
            diceRolls: [],
            turnOrder: [],
            doublesCount: 0,
            jailTurns: {},
            bankruptPlayers: [],
            jailFreeCards: {},
            turnCount: 0,
            freeParkingPot: 0,
            lastRoll: undefined,
            lastDice: undefined,
            lastDoubles: undefined,
            lastPosition: undefined,
            drawnCard: undefined,
            currentPropertyDecision: undefined,
            currentRentOwed: undefined,
            winner: undefined,
            pendingTrades: [],
            auction: undefined,
            lastAction: undefined,
            lastActionTimestamp: undefined,
            gameLog: []
        };
    }

    private cleanup(): void {
        console.log('Cleaning up game service');
        
        // Remove event listeners by replacing elements with clones
        const rollDiceButton = document.getElementById('roll-dice') as HTMLButtonElement;
        const endTurnButton = document.getElementById('end-turn') as HTMLButtonElement;
        const viewRulesButton = document.getElementById('view-rules');
        const gameTitle = document.querySelector('.game-title');
        const statusElement = document.querySelector('.game-status');
        
        if (rollDiceButton) {
            rollDiceButton.replaceWith(rollDiceButton.cloneNode(true));
        }
        
        if (endTurnButton) {
            endTurnButton.replaceWith(endTurnButton.cloneNode(true));
        }
        
        if (viewRulesButton) {
            viewRulesButton.replaceWith(viewRulesButton.cloneNode(true));
        }
        
        if (gameTitle) {
            gameTitle.replaceWith(gameTitle.cloneNode(true));
        }
        
        if (statusElement) {
            statusElement.replaceWith(statusElement.cloneNode(true));
        }

        // Clear message container
        if (this.messageContainer) {
            this.messageContainer.innerHTML = '';
        }

        // Clear status element
        if (this.statusElement) {
            this.statusElement.textContent = '';
        }

        // Clear players element
        if (this.playersElement) {
            this.playersElement.innerHTML = '';
        }
    }

    private initializeEventListeners(): void {
        console.log('Initializing event listeners');
        
        // Remove existing listeners first
        const rollButton = document.getElementById('roll-dice') as HTMLButtonElement;
        const endTurnButton = document.getElementById('end-turn') as HTMLButtonElement;
        const viewRulesButton = document.getElementById('view-rules');
        const gameTitle = document.querySelector('.game-title');
        const statusElement = document.querySelector('.game-status');

        // Clone and replace elements to remove old listeners
        if (rollButton) {
            console.log('Setting up roll button');
            const newRollButton = rollButton.cloneNode(true) as HTMLButtonElement;
            // Preserve button state and classes
            newRollButton.className = rollButton.className;
            newRollButton.disabled = rollButton.disabled;
            rollButton.parentNode?.replaceChild(newRollButton, rollButton);
            newRollButton.addEventListener('click', () => {
                if (this._isProcessingRoll) return;
                this.rollDice();
            });
            
            // Set initial button state
            const canRoll = this.canPlayerRoll(this.getNextPlayer());
            newRollButton.disabled = !canRoll;
            if (canRoll) {
                newRollButton.classList.add('active');
            } else {
                newRollButton.classList.remove('active');
            }
            console.log('Roll button initial state:', { canRoll });
        }

        if (endTurnButton) {
            console.log('Setting up end turn button');
            const newEndButton = endTurnButton.cloneNode(true) as HTMLButtonElement;
            // Preserve button state and classes
            newEndButton.className = endTurnButton.className;
            newEndButton.disabled = endTurnButton.disabled;
            endTurnButton.parentNode?.replaceChild(newEndButton, endTurnButton);
            newEndButton.addEventListener('click', () => this.endTurn());
            
            // Set initial button state
            const canEndTurn = this.canPlayerEndTurn(this.getNextPlayer());
            newEndButton.disabled = !canEndTurn;
            if (canEndTurn) {
                newEndButton.classList.add('active');
            } else {
                newEndButton.classList.remove('active');
            }
            console.log('End turn button initial state:', { canEndTurn });
        }

        if (viewRulesButton) {
            const newRulesButton = viewRulesButton.cloneNode(true);
            viewRulesButton.parentNode?.replaceChild(newRulesButton, viewRulesButton);
            newRulesButton.addEventListener('click', () => this.showRules());
        }

        if (gameTitle) {
            const newTitle = gameTitle.cloneNode(true);
            gameTitle.parentNode?.replaceChild(newTitle, gameTitle);
            newTitle.addEventListener('click', () => {
                window.location.href = '/lobby';
            });
        }

        if (statusElement) {
            const newStatus = statusElement.cloneNode(true);
            statusElement.parentNode?.replaceChild(newStatus, statusElement);
            newStatus.addEventListener('click', (e: Event) => {
                e.stopPropagation();
                this.toggleMessageHistory();
            });
        }
        
        console.log('Event listeners initialized');
    }

    private initializeBoard(): void {
        // Only place tokens if the game is in playing phase
        if (this.gameData.gameState.phase === 'playing') {
            this.gameData.players.forEach((player: Player, index: number) => {
                this.board.updatePlayerPosition(player.id, player.position, index);
            });

            // Update property ownership
            this.gameData.properties.forEach((property: Property) => {
                if (property.ownerId) {
                    const ownerIndex = this.gameData.players.findIndex((p: Player) => p.id === property.ownerId);
                    if (ownerIndex !== -1) {
                        this.board.updatePropertyOwnership(property, ownerIndex);
                    }
                }
            });
        }
    }

    private async rollDice(): Promise<void> {
        console.log('=== Roll Dice Started ===');
        const rollDiceButton = document.getElementById('roll-dice') as HTMLButtonElement;
        if (rollDiceButton) rollDiceButton.disabled = true;

        try {
            const response = await fetch(`/games/${this.gameData.gameId}/roll`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    playerId: this.gameData.currentPlayerId
                })
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error('Roll request failed:', {
                    status: response.status,
                    statusText: response.statusText,
                    error: errorText
                });
                this.showMessage('Failed to roll dice. Please try again.');
                if (rollDiceButton) rollDiceButton.disabled = false;
                return;
            }

            const data: RollResponse = await response.json();
            console.log('Roll response received:', data);
            
            if (!data.gameState) {
                console.error('No game state received in roll response');
                return;
            }
            
            if (data.gameState.phase === GAME_PHASES.WAITING) {
                console.log('Handling initial roll phase');
                await this.handleInitialRollPhase(data);
            } else {
                console.log('Handling gameplay roll');
                await this.handleGameplayRoll(data);
            }
        } catch (error) {
            console.error('Roll error:', error);
            this.showMessage('Failed to roll dice. Please try again.');
            if (rollDiceButton) rollDiceButton.disabled = false;
        }
        console.log('=== Roll Dice Completed ===');
    }

    private async handleInitialRollPhase(data: RollResponse): Promise<void> {
        console.log('\n=== Initial Roll Phase Started ===');
        console.log('Initial roll data:', {
            roll: data.roll,
            dice: data.dice,
            gameState: data.gameState,
            players: data.players?.map((p: Player) => ({
                id: p.id,
                username: p.username,
                isBot: p.isBot,
                hasRolled: data.gameState?.diceRolls.some(r => r.id === p.id)
            }))
        });
        
        // Ensure we have game state
        if (!data.gameState) {
            console.error('No game state received in initial roll phase');
            return;
        }

        // Update game state
        this.gameData.gameState = data.gameState;
        
        // Update all players if provided
        if (data.players) {
            this.gameData.players = data.players;
            console.log('Updated players list:', this.gameData.players);
        }

        // Show initial roll phase message if this is the first roll
        if (this.gameData.gameState.diceRolls.length === 0) {
            await this.showMessageWithDelay('🎲 Rolling for turn order...', 1000);
            // Add to game log
            if (!this.gameData.gameState.gameLog) {
                this.gameData.gameState.gameLog = [];
            }
            this.gameData.gameState.gameLog.push(
                this.createGameEvent('roll', 'Turn order phase started')
            );
        }

        // Show roll message with delay
        const currentPlayer = this.gameData.players.find(p => p.id === this.gameData.currentPlayerId);
        const rollMessage = `${currentPlayer?.username} rolled ${data.dice[0]} and ${data.dice[1]} (total: ${data.roll})!`;
        await this.showMessageWithDelay(rollMessage, 1000);
        
        // Add roll to game log
        if (!this.gameData.gameState.gameLog) {
            this.gameData.gameState.gameLog = [];
        }
        this.gameData.gameState.gameLog.push(
            this.createGameEvent('roll', rollMessage, {
                player: currentPlayer,
                roll: data.roll,
                dice: data.dice
            })
        );

        // Disable roll button immediately after rolling
        const rollButton = document.getElementById('roll-dice') as HTMLButtonElement;
        if (rollButton) {
            rollButton.disabled = true;
            console.log('Disabled roll button after rolling');
        }

        // Get fresh game state before proceeding
        try {
            const response = await fetch(`/games/${this.gameData.gameId}/state`);
            if (!response.ok) {
                throw new Error(`Failed to get game state: ${response.status}`);
            }
            const freshState = await response.json();
            this.gameData.gameState = freshState.gameState;
            if (freshState.players) {
                this.gameData.players = freshState.players;
            }
            console.log('Retrieved fresh game state:', freshState);
        } catch (error) {
            console.error('Failed to get fresh game state:', error);
        }

        // Check who still needs to roll
        const playersWhoHaveRolled = this.gameData.gameState.diceRolls.map(r => r.id);
        const playersWhoNeedToRoll = this.gameData.players.filter(p => !playersWhoHaveRolled.includes(p.id));
        
        console.log('Roll status:', {
            playersWhoHaveRolled,
            playersWhoNeedToRoll: playersWhoNeedToRoll.map(p => p.username)
        });

        // Show waiting message for next player
        if (playersWhoNeedToRoll.length > 0) {
            const nextPlayer = playersWhoNeedToRoll[0];
            const waitMessage = `Waiting for ${nextPlayer.username} to roll...`;
            await this.showMessageWithDelay(waitMessage, 1000);
            // Add to game log
            if (!this.gameData.gameState.gameLog) {
                this.gameData.gameState.gameLog = [];
            }
            this.gameData.gameState.gameLog.push(
                this.createGameEvent('roll', waitMessage)
            );
        }

        // If there are bots that need to roll, trigger their rolls
        const botsToRoll = playersWhoNeedToRoll.filter(p => p.isBot);
        if (botsToRoll.length > 0) {
            console.log('Bots that need to roll:', botsToRoll.map(b => b.username));
            
            // Roll for each bot sequentially
            for (const bot of botsToRoll) {
                const botRollMessage = `${bot.username} is rolling...`;
                await this.showMessageWithDelay(botRollMessage, 800);
                // Add to game log
                if (!this.gameData.gameState.gameLog) {
                    this.gameData.gameState.gameLog = [];
                }
                this.gameData.gameState.gameLog.push(
                    this.createGameEvent('roll', botRollMessage, { player: bot })
                );
                
                try {
                    await this.rollForBot(bot.id);
                    await new Promise(resolve => setTimeout(resolve, 1000)); // Wait between bot rolls
                } catch (error) {
                    console.error(`Failed to roll for bot ${bot.username}:`, error);
                }
            }
        }

        // Check if all players have rolled
        const allPlayersRolled = this.gameData.gameState.diceRolls.length === this.gameData.players.length;
        console.log('Roll completion check:', {
            totalPlayers: this.gameData.players.length,
            rollCount: this.gameData.gameState.diceRolls.length,
            allPlayersRolled
        });

        // If not all players have rolled, enable roll button for next player
        if (!allPlayersRolled) {
            const nextPlayer = this.getNextPlayer();
            if (nextPlayer && !nextPlayer.isBot) {
                const rollButton = document.getElementById('roll-dice') as HTMLButtonElement;
                if (rollButton) {
                    rollButton.disabled = false;
                    console.log('Enabled roll button for next player:', nextPlayer.username);
                }
            }
            // Update UI to show current state
            this.updateGameStatus();
            this.updatePlayersStatus();
            return;
        }

        // All players have rolled - check for ties
        const rolls = this.gameData.gameState.diceRolls;
        // Filter out any rolls without a value and get the highest roll
        const validRolls = rolls.filter(r => typeof r.roll === 'number').map(r => r.roll as number);
        const highestRoll = Math.max(...validRolls);
        const playersWithHighestRoll = rolls.filter(r => r.roll === highestRoll);
        const hasTie = playersWithHighestRoll.length > 1;

        if (hasTie) {
            console.log('Tie detected:', {
                highestRoll,
                tiedPlayers: playersWithHighestRoll.map(r => {
                    const player = this.gameData.players.find(p => p.id === r.id);
                    return player?.username;
                })
            });
            
            const tieMessage = 'Tie detected! Players need to reroll.';
            await this.showMessageWithDelay(tieMessage, 1500);
            // Add to game log
            if (!this.gameData.gameState.gameLog) {
                this.gameData.gameState.gameLog = [];
            }
            this.gameData.gameState.gameLog.push(
                this.createGameEvent('roll', tieMessage, {
                    tiedPlayers: playersWithHighestRoll.map(r => {
                        const player = this.gameData.players.find(p => p.id === r.id);
                        return player?.username;
                    })
                })
            );
            
            await this.showMessageWithDelay(`Players rolled ${highestRoll}!`, 800);
            await this.showMessageWithDelay('Starting reroll...', 1000);
            
            // Reset dice rolls and enable roll button for tied human players
            const tiedHumanPlayer = this.gameData.players.find(p => 
                playersWithHighestRoll.some(r => r.id === p.id) && !p.isBot
            );
            
            if (tiedHumanPlayer) {
                const rollButton = document.getElementById('roll-dice') as HTMLButtonElement;
                if (rollButton) {
                    rollButton.disabled = false;
                    console.log('Enabled roll button for tied player:', tiedHumanPlayer.username);
                }
            }

            // If a tied player is a bot, trigger their roll
            const tiedBot = this.gameData.players.find(p => 
                playersWithHighestRoll.some(r => r.id === p.id) && p.isBot
            );
            
            if (tiedBot) {
                console.log('Bot needs to reroll:', tiedBot.username);
                await new Promise(resolve => setTimeout(resolve, 1000));
                await this.rollForBot(tiedBot.id);
            }
        } else {
            // No ties - proceed with turn order
            await this.showMessageWithDelay(`🎲 Determining turn order...`, 1500);
            
            // Sort players by their roll values, ensuring we have valid roll values
            const rollResults = rolls
                .filter(roll => typeof roll.roll === 'number')
                .map(roll => {
                    const player = this.gameData.players.find(p => p.id === roll.id);
                    return {
                        username: player?.username || 'Unknown',
                        roll: roll.roll as number,
                        isBot: player?.isBot || false,
                        id: roll.id
                    };
                })
                .sort((a, b) => b.roll - a.roll);

            // Show final turn order
            await this.showMessageWithDelay(`📋 Final turn order:`, 1000);
            
            // Add turn order to game log
            if (!this.gameData.gameState.gameLog) {
                this.gameData.gameState.gameLog = [];
            }
            this.gameData.gameState.gameLog.push({
                type: 'roll' as GameEventType,
                playerId: this.gameData.currentPlayerId ?? -1, // Use -1 as fallback
                description: 'Final turn order determined',
                timestamp: new Date(),
                metadata: {
                    turnOrder: rollResults.map(r => ({
                        username: r.username,
                        roll: r.roll,
                        isBot: r.isBot
                    }))
                }
            });
            
            for (let i = 0; i < rollResults.length; i++) {
                const result = rollResults[i];
                const playerType = result.isBot ? '🤖' : '👤';
                const orderMessage = `${i + 1}. ${result.username}${playerType} (rolled ${result.roll})`;
                await this.showMessageWithDelay(orderMessage, 800);
            }

            // Set turn order in game state
            this.gameData.gameState.turnOrder = rollResults.map(r => r.id);
            this.gameData.gameState.currentPlayerIndex = 0;
            this.gameData.gameState.phase = 'playing';

            // Transition to playing phase
            const startMessage = `🎮 Game starting...`;
            await this.showMessageWithDelay(startMessage, 1500);
            
            // Add game start to log
            if (!this.gameData.gameState.gameLog) {
                this.gameData.gameState.gameLog = [];
            }
            this.gameData.gameState.gameLog.push(
                this.createGameEvent('roll', startMessage, { phase: 'playing' })
            );
            
            // Get first player
            const firstPlayer = this.gameData.players.find(p => p.id === rollResults[0].id);
            if (firstPlayer) {
                const playerType = firstPlayer.isBot ? '🤖' : '👤';
                const firstPlayerMessage = `${firstPlayer.username}${playerType} goes first!`;
                await this.showMessageWithDelay(firstPlayerMessage, 1000);
                
                // Add first player to log
                this.gameData.gameState.gameLog.push(
                    this.createGameEvent('roll', firstPlayerMessage, { firstPlayer: {
                        username: firstPlayer.username,
                        isBot: firstPlayer.isBot
                    } })
                );
                
                // Start first turn
                if (firstPlayer.isBot) {
                    const botStartMessage = `Starting ${firstPlayer.username}'s turn...`;
                    await this.showMessageWithDelay(botStartMessage, 1000);
                    await this.processBotTurn(firstPlayer);
                } else {
                    await this.showMessageWithDelay(`Your turn!`, 1000);
                    const rollButton = document.getElementById('roll-dice') as HTMLButtonElement;
                    if (rollButton) {
                        rollButton.disabled = false;
                    }
                }
            }
        }

        // Update UI
        this.updateGameStatus();
        this.updatePlayersStatus();
        console.log('=== Initial Roll Phase Completed ===\n');
    }

    private async handleGameplayRoll(response: RollResponse): Promise<void> {
        console.log('\n=== Handling Gameplay Roll ===');
        console.log('Call stack:', new Error().stack);
        console.log('Current processing state:', {
            gameState: this.gameData.gameState,
            currentPlayer: this.gameData.currentPlayerId,
            isProcessing: this._isProcessingRoll
        });

        if (this._isProcessingRoll) {
            console.log('Skipping duplicate roll processing');
            return;
        }

        this._isProcessingRoll = true;

        try {
            const { 
                roll, 
                dice, 
                isDoubles, 
                gameState, 
                newPosition, 
                spaceAction,
                currentPlayer,
                players 
            } = response;

            console.log('Roll response data:', {
                roll,
                dice,
                isDoubles,
                newPosition,
                spaceAction,
                currentPlayer,
                gameState
            });

            // Update game state if provided
            if (gameState) {
                this.gameData.gameState = gameState;
            } else {
                console.warn('No game state received in gameplay roll');
            }
            
            // Update players if provided
            if (players) {
                this.gameData.players = players;
            }

            // Show roll message
            console.log('Player movement:', {
                player: currentPlayer,
                fromPosition: currentPlayer.position,
                toPosition: newPosition,
                roll,
                dice
            });

            this.showMessage({
                type: 'roll',
                player: currentPlayer,
                roll,
                dice
            });

            // Update player position with animation
            if (typeof newPosition === 'number' && currentPlayer) {
                console.log('Updating player position:', {
                    playerId: currentPlayer.id,
                    fromPosition: currentPlayer.position,
                    toPosition: newPosition
                });
                
                const playerIndex = this.gameData.players.findIndex(p => p.id === currentPlayer.id);
                
                // First update the data
                currentPlayer.position = newPosition;
                
                // Then update the visual position
                if (this.board) {
                    await this.board.updatePlayerPosition(currentPlayer.id, newPosition, playerIndex);
                    
                    // Wait for animation to complete
                    await new Promise(resolve => setTimeout(resolve, 500));
                }
            }

            // Process space action if any
            if (spaceAction) {
                console.log('Processing space action:', spaceAction);
                await this.handleSpaceAction(spaceAction, currentPlayer);
            }

            // Enable end turn button if it's the player's turn
            if (!this.isCurrentPlayerBot()) {
                console.log('End turn button enabled');
                const endTurnButton = document.getElementById('end-turn') as HTMLButtonElement;
                if (endTurnButton) {
                    endTurnButton.disabled = false;
                }
            }

            // Update UI
            this.updateGameStatus();
            this.updatePlayersStatus();
            this.updatePropertiesPanel();

        } catch (error) {
            console.error('Error handling gameplay roll:', error);
        } finally {
            this._isProcessingRoll = false;
            console.log('=== Gameplay Roll Completed ===\n');
        }
    }

    private async handleSpaceAction(spaceAction: SpaceAction, currentPlayer: Player): Promise<void> {
        console.log('\n=== Processing Space Action ===');
        console.log('Space action details:', spaceAction);
        console.log('Current game phase:', this.gameData.gameState.phase);
        
        // Don't process any space actions during waiting phase
        if (this.gameData.gameState.phase === GAME_PHASES.WAITING) {
            console.log('Skipping space action during waiting phase');
            return;
        }
        
        if (spaceAction.type === 'card_drawn' && spaceAction.card) {
            // Store current position before card action
            const currentPosition = currentPlayer.position;
            
            // Show card message
            await this.showMessageWithDelay(
                `${currentPlayer.username} drew a card: ${spaceAction.card.text}`,
                1500
            );
            
            // Show action result
            await this.showMessageWithDelay(spaceAction.message, 1500);
            
            // Update game state but preserve position unless explicitly changed by card
            if (spaceAction.card.action?.type === 'jail_free') {
                // For Get Out of Jail Free card, ensure position doesn't change
                currentPlayer.position = currentPosition;
            }
        } else if (spaceAction.type === 'pay_tax' && spaceAction.tax) {
            // Process tax payment
            try {
                const response = await fetch(`/game/${this.gameData.gameId}/tax/pay`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        playerId: currentPlayer.id,
                        taxAmount: spaceAction.tax.amount
                    })
                });

                if (!response.ok) {
                    const error = await response.json();
                    await this.showMessageWithDelay(error.error || 'Failed to pay tax', 1500);
                    return;
                }

                const data = await response.json();
                
                // Update game data
                if (data.players) {
                    this.gameData.players = data.players;
                }
                if (data.gameState) {
                    this.gameData.gameState = data.gameState;
                }

                // Show tax payment message
                await this.showMessageWithDelay(
                    `${currentPlayer.username} paid $${spaceAction.tax.amount} ${spaceAction.tax.name}`,
                    1500
                );
            } catch (error) {
                console.error('Tax payment error:', error);
                await this.showMessageWithDelay('Failed to process tax payment', 1500);
            }
        } else if (spaceAction.type === 'purchase_available' && spaceAction.property) {
            const property = spaceAction.property;
            
            // Show purchase dialog for human players
            if (!currentPlayer.isBot) {
                // Get fresh property state before showing dialog
                const propertyStateResponse = await fetch(`/game/${this.gameData.gameId}/property/${property.position}`);
                if (!propertyStateResponse.ok) {
                    console.error('Failed to get property state:', propertyStateResponse.status);
                    return;
                }
                
                const propertyState = await propertyStateResponse.json();
                if (propertyState.ownerId !== null) {
                    console.log('Property already owned, skipping purchase dialog');
                    return;
                }
                
                const shouldPurchase = await this.showPurchaseDialog(property.name, property.price, currentPlayer.balance);
                if (shouldPurchase) {
                    await this.buyProperty(property.position);
                }
            }
        }

        // Update UI after any space action
        await this.updateBoard();
        await this.updateGameStatus();
        await this.updatePlayersStatus();
        await this.updatePropertiesPanel();
    }

    private async showPurchaseDialog(propertyName: string, price: number | undefined, playerBalance: number): Promise<boolean> {
        return new Promise((resolve) => {
            if (price === undefined) {
                console.error('Property price is undefined');
                resolve(false);
                return;
            }

            console.log('Showing purchase dialog for:', propertyName, 'Price:', price, 'Balance:', playerBalance);
            
            // Create overlay
            const overlay = document.createElement('div');
            overlay.className = 'purchase-dialog-overlay';
            document.body.appendChild(overlay);
            
            const dialog = document.createElement('div');
            dialog.className = `purchase-dialog property-${this.getPropertyColor(propertyName)}`;
            
            dialog.innerHTML = `
                <h3>Purchase Property</h3>
                <p>${propertyName}</p>
                <div class="balance">Price: $${price}</div>
                <p>Your balance: $${playerBalance}</p>
                <div class="buttons">
                    <button class="cancel" id="cancel-purchase">Cancel</button>
                    <button class="confirm" id="confirm-purchase">Buy Property</button>
                </div>
            `;
            
            document.body.appendChild(dialog);
            
            const confirmButton = dialog.querySelector('#confirm-purchase');
            const cancelButton = dialog.querySelector('#cancel-purchase');
            
            const cleanup = () => {
                document.body.removeChild(dialog);
                document.body.removeChild(overlay);
            };
            
            confirmButton?.addEventListener('click', () => {
                cleanup();
                resolve(true);
            });
            
            cancelButton?.addEventListener('click', () => {
                cleanup();
                resolve(false);
            });

            // Close on overlay click
            overlay.addEventListener('click', () => {
                cleanup();
                resolve(false);
            });
        });
    }

    private getPropertyColor(propertyName: string): string {
        const space = BOARD_SPACES.find(s => s.name === propertyName);
        return space?.color || space?.type || 'default';
    }

    private async buyProperty(position: number): Promise<void> {
        console.log('=== Buy Property Started ===');
        console.log('Attempting to buy property at position:', position);

        try {
            // Get current player
            const currentPlayer = this.getCurrentPlayer();
            if (!currentPlayer) {
                console.error('No current player found');
                return;
            }

            // Get latest game state
            await this.getLatestGameState();
            console.log('Latest game state:', this.gameData.gameState);

            // Update UI
            this.updateBoard();
            this.updateGameStatus();
            this.updatePlayersStatus();
            this.updatePropertiesPanel();

            // Check property state
            const propertyStateResponse = await fetch(`/game/${this.gameData.gameId}/property/${position}`);
            if (!propertyStateResponse.ok) {
                throw new Error('Failed to get property state');
            }

            const propertyState = await propertyStateResponse.json();
            console.log('Property state before purchase:', propertyState);
            
            if (propertyState.ownerId !== null) {
                console.error('Property already owned:', {
                    property: propertyState,
                    currentOwner: propertyState.ownerId
                });
                await this.showMessage('This property is already owned');
                return;
            }

            // Verify player can afford the property
            if (currentPlayer.balance < propertyState.price) {
                console.error('Insufficient funds:', {
                    balance: currentPlayer.balance,
                    price: propertyState.price
                });
                await this.showMessage('Insufficient funds to purchase this property');
                return;
            }

            // Attempt to purchase
            console.log('Sending purchase request:', {
                position
            });
            
            const response = await fetch(`/game/${this.gameData.gameId}/property/buy`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ position })
            });

            if (!response.ok) {
                const error = await response.json();
                console.error('Purchase request failed:', error);
                this.showMessage(error.error || 'Failed to purchase property');
                return;
            }

            const result = await response.json();
            console.log('Purchase successful:', result);

            // Update game state with new property ownership
            await this.getLatestGameState();

            // Show success message
            await this.showMessage(`Successfully purchased ${propertyState.name} for $${propertyState.price}`);

            // Update UI
            this.updateBoard();
            this.updateGameStatus();
            this.updatePlayersStatus();
            this.updatePropertiesPanel();

            console.log('=== Buy Property Completed ===');
        } catch (error) {
            console.error('Error during property purchase:', error);
            this.showMessage('Failed to purchase property');
        }
    }

    private async updatePlayerPosition(player: Player, newPosition: number): Promise<void> {
        player.position = newPosition;
        const playerIndex = this.gameData.players.findIndex((p: Player) => p.id === player.id);
        await this.board.updatePlayerPosition(player.id, newPosition, playerIndex);
        await this.updatePlayersStatus();
    }

    private processMessageQueue(): void {
        if (this._isProcessingMessages) return;
        
        this._isProcessingMessages = true;
        
        while (this._messageQueue.length > 0) {
            const { message, delay } = this._messageQueue[0];
            
            // Add to history with timestamp
            this.messageHistory.push({
                message,
                timestamp: new Date()
            });
            this.updateMessageHistory();

            // Show temporary message
            const messageElement = document.createElement('div');
            messageElement.className = 'game-message';
            messageElement.textContent = message;
            this.messageContainer.appendChild(messageElement);

            // Wait for specified delay
            setTimeout(() => {
                if (messageElement.parentNode === this.messageContainer) {
                    messageElement.remove();
                }
            }, delay);

            // Remove from queue
            this._messageQueue.shift();
        }
        
        this._isProcessingMessages = false;
    }

    private showMessage(message: string | GameMessage): void {
        let displayMessage: string;

        if (typeof message === 'string') {
            displayMessage = message;
        } else {
            switch (message.type) {
                case 'roll':
                    if (message.player && message.dice && message.roll !== undefined) {
                        displayMessage = `${message.player.username} rolled ${message.dice[0]} and ${message.dice[1]} (total: ${message.roll})!`;
                    } else {
                        displayMessage = 'Roll action occurred';
                    }
                    break;
                case 'purchase':
                    if (message.player && message.property) {
                        displayMessage = `${message.player.username} purchased ${message.property.name}!`;
                    } else {
                        displayMessage = 'Property purchased';
                    }
                    break;
                case 'error':
                    displayMessage = message.message || 'An error occurred';
                    break;
                default:
                    displayMessage = message.message || 'Unknown message';
            }
        }

        // Create message element
        const messageElement = document.createElement('div');
        messageElement.className = 'game-message';
        messageElement.textContent = displayMessage;

        // Add to message history
        this.messageHistory.push({
            message: displayMessage,
            timestamp: new Date()
        });

        // Add to message container
        if (this.messageContainer) {
            this.messageContainer.appendChild(messageElement);
            this.messageContainer.scrollTop = this.messageContainer.scrollHeight;

            // Remove old messages if there are too many
            while (this.messageContainer.children.length > 50) {
                this.messageContainer.removeChild(this.messageContainer.firstChild as Node);
            }
        }
    }

    private async showMessageWithDelay(message: string, delay: number): Promise<void> {
        console.log('Showing message:', {
            message,
            delay,
            timestamp: new Date().toISOString()
        });

        // Update status text immediately
        const statusElement = document.querySelector('.game-status');
        if (statusElement) {
            statusElement.textContent = message;
            console.log('Updated status element text');
        } else {
            console.warn('Status element not found');
        }
        
        // Add to history
        this.messageHistory.push({
            message,
            timestamp: new Date()
        });
        this.updateMessageHistory();
        
        // Wait for delay
        await new Promise(resolve => setTimeout(resolve, delay));
        
        // Clear status if it still shows this message
        if (statusElement?.textContent === message) {
            statusElement.textContent = this.getDefaultStatusText();
            console.log('Reset status element to default text');
        }
    }

    private getDefaultStatusText(): string {
        const currentPlayer = this.getNextPlayer();
        return currentPlayer ? 
            `${currentPlayer.username}'s Turn${currentPlayer.id === this.gameData.currentPlayerId ? ' - Your turn!' : ''}` :
            'Waiting for next turn...';
    }

    private updateGameStatus(): void {
        console.log('=== Updating Game Status ===');
        if (!this.statusElement) {
            console.error('Status element not found');
            return;
        }
        
        const currentPlayer = this.getNextPlayer();
        console.log('Current player:', currentPlayer);
        
        if (currentPlayer) {
            this.board.setCurrentPlayer(currentPlayer.id);
        }
        
        let statusText = '';
        
        if (this.gameData.gameState.phase === GAME_PHASES.WAITING) {
            const rollCount = this.gameData.gameState.diceRolls.length;
            const totalPlayers = this.gameData.players.length;
            const playersWhoHaveNotRolled = this.gameData.players.filter(p => 
                !this.gameData.gameState.diceRolls.some(r => r.id === p.id)
            );
            const nextToRoll = playersWhoHaveNotRolled[0];
            
            if (rollCount === 0) {
                statusText = 'Initial Roll Phase - All players need to roll';
            } else if (nextToRoll) {
                statusText = `Initial Roll Phase - Waiting for ${nextToRoll.username}${nextToRoll.isBot ? ' 🤖' : ''} to roll (${rollCount}/${totalPlayers} players rolled)`;
            } else {
                statusText = 'Initial Roll Phase - All players have rolled';
            }
        } else {
            statusText = currentPlayer ? 
                `${currentPlayer.username}${currentPlayer.isBot ? ' 🤖' : ''}'s Turn${currentPlayer.id === this.gameData.currentPlayerId ? ' - Your turn!' : ''}` :
                'Waiting for next turn...';
        }

        this.statusElement.textContent = statusText;

        // Update button states
        const rollButton = document.getElementById('roll-dice') as HTMLButtonElement;
        const endTurnButton = document.getElementById('end-turn') as HTMLButtonElement;
        
        if (rollButton && endTurnButton) {
            const canRoll = this.canPlayerRoll(currentPlayer);
            const canEndTurn = this.canPlayerEndTurn(currentPlayer);

            console.log('Button states:', {
                canRoll,
                canEndTurn,
                currentPlayer: currentPlayer?.username,
                isCurrentUser: currentPlayer?.id === this.gameData.currentPlayerId,
                phase: this.gameData.gameState.phase
            });

            rollButton.disabled = !canRoll;
            endTurnButton.disabled = !canEndTurn;

            // Update button styles
            rollButton.classList.toggle('active', canRoll);
            endTurnButton.classList.toggle('active', canEndTurn);
        }

        // Check for bot turn after updating status
        if (this.gameData.gameState.phase === 'playing') {
            this.checkForBotTurn();
        }
    }

    private canPlayerRoll(player: Player | null): boolean {
        if (!player || !this.gameData.gameState) return false;

        // During waiting phase, any player who hasn't rolled can roll
        if (this.gameData.gameState.phase === GAME_PHASES.WAITING) {
            // Check if it's the current user's player and they haven't rolled yet
            const isCurrentUser = !player.isBot && player.id === this.gameData.currentPlayerId;
            const hasNotRolled = !this.gameData.gameState.diceRolls.some(r => r.id === player.id);
            console.log('Roll check:', {
                player: player.username,
                playerId: player.id,
                currentPlayerId: this.gameData.currentPlayerId,
                isBot: player.isBot,
                isCurrentUser,
                hasNotRolled
            });
            return isCurrentUser && hasNotRolled;
        }

        // During playing phase, only current player can roll if they haven't rolled yet
        const isCurrentPlayer = player.id === this.gameData.gameState.turnOrder[this.gameData.gameState.currentPlayerIndex];
        const isPlayingPhase = this.gameData.gameState.phase === GAME_PHASES.PLAYING;
        const noLastRoll = !this.gameData.gameState.lastRoll;

        return isCurrentPlayer && isPlayingPhase && noLastRoll;
    }

    private canPlayerEndTurn(player: Player | null): boolean {
        if (!player || !this.gameData.gameState) return false;

        // During waiting phase, no one can end turn
        if (this.gameData.gameState.phase === GAME_PHASES.WAITING) {
            return false;
        }

        // During playing phase, only current player can end turn after rolling
        const isCurrentPlayer = player.id === this.gameData.gameState.turnOrder[this.gameData.gameState.currentPlayerIndex];
        const isPlayingPhase = this.gameData.gameState.phase === GAME_PHASES.PLAYING;
        const hasRolled = this.gameData.gameState.lastRoll !== undefined;

        return isCurrentPlayer && isPlayingPhase && hasRolled;
    }

    private updateButtonStates(): void {
        const rollButton = document.getElementById('roll-dice') as HTMLButtonElement;
        const endTurnButton = document.getElementById('end-turn') as HTMLButtonElement;
        
        if (!rollButton || !endTurnButton) return;

        const currentPlayer = this.getNextPlayer();
        const canRoll = this.canPlayerRoll(currentPlayer);
        const canEndTurn = this.canPlayerEndTurn(currentPlayer);

        rollButton.disabled = !canRoll;
        endTurnButton.disabled = !canEndTurn;

        // Update button styles
        rollButton.classList.toggle('active', canRoll);
        endTurnButton.classList.toggle('active', canEndTurn);
    }

    private updatePlayersStatus(): void {
        console.log('=== Updating Players Status ===');
        if (!this.playersElement) {
            console.error('Players element not found');
            return;
        }
        
        this.playersElement.innerHTML = ''; // Clear existing content
        
        this.gameData.players.forEach((p: Player, index: number) => {
            const playerCard = document.createElement('div');
            playerCard.className = `player-card player-color-${index}`;
            if (p.id === this.gameData.gameState.turnOrder[this.gameData.gameState.currentPlayerIndex]) {
                playerCard.classList.add('current-player');
            }
            
            // Create avatar
            const avatar = document.createElement('div');
            avatar.className = 'player-avatar';
            avatar.textContent = p.isBot ? '🤖' : '👤';
            
            // Create info section
            const info = document.createElement('div');
            info.className = 'player-info';
            
            // Add player name and controls
            const nameContainer = document.createElement('div');
            nameContainer.className = 'player-name';
            
            const nameText = document.createElement('span');
            nameText.textContent = p.username;
            nameContainer.appendChild(nameText);
            
            // Add "You" label for current user's player
            if (!p.isBot && p.userId === this.gameData.currentPlayerId) {
                const youLabel = document.createElement('span');
                youLabel.className = 'player-you';
                youLabel.textContent = ' (You)';
                nameContainer.appendChild(youLabel);
            }
            
            info.appendChild(nameContainer);
            
            // Add player stats
            const stats = document.createElement('div');
            stats.className = 'player-stats';
            
            const balance = document.createElement('div');
            balance.className = 'player-balance';
            balance.textContent = `$${p.money}`;
            
            const position = document.createElement('div');
            position.className = 'player-position';
            if (this.gameData.gameState.phase === 'playing') {
                position.textContent = `Position: ${BOARD_SPACES[p.position]?.name || p.position}`;
            }
            
            const status = document.createElement('div');
            status.className = 'roll-status';
            
            // Add roll status text based on game phase
            let statusText = '';
            if (this.gameData.gameState.phase === 'waiting') {
                const playerRoll = this.gameData.gameState.diceRolls.find(r => r.id === p.id);
                statusText = playerRoll ? `Rolled: ${playerRoll.roll}` : 'Waiting for roll...';
            } else {
                statusText = p.id === this.gameData.gameState.turnOrder[this.gameData.gameState.currentPlayerIndex] ? 
                    'Current turn' : 'Waiting...';
            }
            
            const statusTextEl = document.createElement('div');
            statusTextEl.textContent = statusText;
            status.appendChild(statusTextEl);
            
            stats.appendChild(balance);
            stats.appendChild(position);
            stats.appendChild(status);
            info.appendChild(stats);

            // Add controls for human player
            if (!p.isBot && p.userId === this.gameData.currentPlayerId) {
                // Add controls container
                const controls = document.createElement('div');
                controls.className = 'player-controls';
                
                // Create roll button
                const rollButton = document.createElement('button');
                rollButton.id = 'roll-dice';
                rollButton.className = 'btn btn-primary';
                rollButton.textContent = 'Roll Dice';
                const canRoll = this.canPlayerRoll(p);
                rollButton.disabled = !canRoll;
                if (canRoll) {
                    rollButton.classList.add('active');
                }
                
                // Create end turn button
                const endButton = document.createElement('button');
                endButton.id = 'end-turn';
                endButton.className = 'btn btn-secondary';
                endButton.textContent = 'End Turn';
                const canEndTurn = this.canPlayerEndTurn(p);
                endButton.disabled = !canEndTurn;
                if (canEndTurn) {
                    endButton.classList.add('active');
                }
                
                // Add buttons to controls
                controls.appendChild(rollButton);
                controls.appendChild(endButton);
                
                // Add controls to player card
                info.appendChild(controls);
                
                // Add event listeners
                rollButton.addEventListener('click', () => this.rollDice());
                endButton.addEventListener('click', () => this.endTurn());
                
                console.log('Added controls with button states:', {
                    canRoll,
                    canEndTurn
                });
            }
            
            playerCard.appendChild(avatar);
            playerCard.appendChild(info);
            
            this.playersElement.appendChild(playerCard);
        });

        console.log('Players status updated');
    }

    private async processBotTurn(bot: Player): Promise<void> {
        // Early check for processing state and game phase
        if (this.isProcessingBotTurn || this.gameData?.gameState?.phase !== 'playing') {
            return;
        }

        // Set processing flag before any async operations
        this.isProcessingBotTurn = true;

        try {
            // Get fresh game state before proceeding
            await this.getLatestGameState();

            // Verify it's still the bot's turn and we're in playing phase
            const currentPlayer = this.getNextPlayer();
            if (!currentPlayer || 
                currentPlayer.id !== bot.id || 
                this.gameData?.gameState?.phase !== 'playing' ||
                currentPlayer.id !== this.gameData?.gameState?.turnOrder[this.gameData.gameState.currentPlayerIndex]) {
                return;
            }

            // Ensure all previous messages are processed
            await new Promise(resolve => setTimeout(resolve, 1000));

            // Roll dice
            await this.showMessageWithDelay(`${bot.username}'s turn`, 1000);
            await this.rollForBot(bot.id);

            // Wait for roll animation and messages
            await new Promise(resolve => setTimeout(resolve, 1500));

            // Verify game state again before making decisions
            await this.getLatestGameState();
            if (this.gameData?.gameState?.phase === 'playing' && 
                currentPlayer.id === this.gameData.gameState.turnOrder[this.gameData.gameState.currentPlayerIndex]) {
                // Make property decisions
                await this.makeBotDecisions(bot);

                // Wait for decision messages
                await new Promise(resolve => setTimeout(resolve, 1500));

                // End turn
                await this.endBotTurn(bot);
            }
        } catch (error) {
            console.error('Bot turn error:', error);
            this.showMessage(`${bot.username} encountered an error during their turn`);
        } finally {
            this.isProcessingBotTurn = false;
        }
    }

    private async makeBotDecisions(bot: Player): Promise<void> {
        console.log('=== Making Bot Decisions Started ===');
        console.log('Bot:', bot);
        
        try {
            const response = await fetch(`/game/${this.gameData.gameId}/bot/${bot.id}/action`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });

            console.log('Bot decision response status:', response.status);

            if (!response.ok) {
                throw new Error('Failed to process bot action');
            }

            const data: BotActionResponse = await response.json();
            console.log('Bot decision response:', data);
            
            this.showMessage(`${bot.username} ${data.message}`);
            
            if (data.gameState) {
                this.gameData.gameState = data.gameState;
                this.updateBoard();
                this.updateGameStatus();
                this.updatePlayersStatus();
            }
        } catch (error) {
            console.error('Bot decision error:', error);
            this.showMessage(`${bot.username} encountered an error`);
        } finally {
            console.log('=== Making Bot Decisions Completed ===');
        }
    }

    private async endBotTurn(bot: Player): Promise<void> {
        console.log('=== Ending Bot Turn Started ===');
        console.log('Bot:', bot);
        
        try {
            const response = await fetch(`/game/${this.gameData.gameId}/end-turn`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ playerId: bot.id })
            });

            console.log('End bot turn response status:', response.status);

            if (!response.ok) {
                throw new Error('Failed to end bot turn');
            }

            const data = await response.json();
            console.log('End bot turn response:', data);
            
            // Update game state
            this.gameData.gameState = data.gameState;
            // Ensure lastRoll is cleared for the next turn
            delete this.gameData.gameState.lastRoll;
            delete this.gameData.gameState.lastPosition;
            
            if (data.players) {
                this.gameData.players = data.players;
            }

            // Get fresh game state from server
            await this.getLatestGameState();

            // Update UI
            this.updateBoard();
            this.updateGameStatus();
            this.updatePlayersStatus();
            this.updatePropertiesPanel();

            // Show turn transition message
            const nextPlayer = this.gameData.players.find(p => p.id === data.nextPlayerId);
            if (nextPlayer) {
                const playerType = nextPlayer.isBot ? '🤖' : '';
                await this.showMessageWithDelay(
                    `${nextPlayer.username}${playerType}'s turn`,
                    1000
                );

                // If next player is also a bot, process their turn after a short delay
                if (nextPlayer.isBot) {
                    console.log('Next player is also a bot, processing their turn...');
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    await this.processBotTurn(nextPlayer);
                } else {
                    // Enable controls for human player
                    const rollButton = document.getElementById('roll-dice') as HTMLButtonElement;
                    if (rollButton && nextPlayer.id === this.gameData.currentPlayerId) {
                        rollButton.disabled = false;
                        console.log('Enabling roll button for human player');
                    }
                }
            }
        } catch (error) {
            console.error('End bot turn error:', error);
            this.showMessage(`Failed to end ${bot.username}'s turn`);
        } finally {
            this.isProcessingBotTurn = false;
            console.log('=== Ending Bot Turn Completed ===');
        }
    }

    private async rollForBot(botId: number): Promise<void> {
        console.log('\n=== Rolling for Bot Started ===');
        console.log('Bot ID:', botId);
        console.log('Current game phase:', this.gameData.gameState.phase);
        
        // Get bot player
        const bot = this.gameData.players.find(p => p.id === botId);
        if (!bot) {
            console.error('Bot not found:', {
                botId,
                availablePlayers: this.gameData.players.map(p => ({
                    id: p.id,
                    username: p.username,
                    isBot: p.isBot
                }))
            });
            return;
        }

        console.log('Found bot player:', {
            id: bot.id,
            username: bot.username,
            isBot: bot.isBot,
            position: bot.position,
            currentRolls: this.gameData.gameState.diceRolls,
            phase: this.gameData.gameState.phase
        });

        try {
            // Send roll request
            const response = await fetch(`/games/${this.gameData.gameId}/roll`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    playerId: bot.id,  // Use playerId instead of botId to match human player rolls
                    isBot: true,       // Add flag to indicate this is a bot roll
                    isInitialRoll: this.gameData.gameState.phase === 'waiting'
                })
            });

            console.log('Bot roll response status:', {
                status: response.status,
                statusText: response.statusText
            });

            if (!response.ok) {
                const error = await response.json();
                console.error('Bot roll failed:', {
                    status: response.status,
                    statusText: response.statusText,
                    error: error.error,
                    bot: bot.username
                });
                throw new Error(error.error || 'Failed to roll for bot');
            }

            const data = await response.json();
            console.log('Bot roll response data:', data);

            // Update game state with bot's roll
            if (data.gameState) {
                this.gameData.gameState = data.gameState;
                
                // If this is a turn order roll, add it to diceRolls
                if (this.gameData.gameState.phase === 'waiting') {
                    if (!this.gameData.gameState.diceRolls) {
                        this.gameData.gameState.diceRolls = [];
                    }
                    // Create a proper PlayerWithRoll object
                    const playerWithRoll: PlayerWithRoll = {
                        ...bot,  // Spread all player properties
                        roll: data.roll,
                        dice: data.dice,
                        hasRolled: true
                    };
                    this.gameData.gameState.diceRolls.push(playerWithRoll);
                }
            }

            // Update players if provided
            if (data.players) {
                this.gameData.players = data.players;
            }

            // Show roll message based on game phase
            if (this.gameData.gameState.phase === 'waiting') {
                await this.showMessageWithDelay(
                    `${bot.username} 🤖 rolled ${data.dice[0]} and ${data.dice[1]} (total: ${data.roll})!`,
                    1000
                );
                
                // Add to game log
                if (!this.gameData.gameState.gameLog) {
                    this.gameData.gameState.gameLog = [];
                }
                this.gameData.gameState.gameLog.push(
                    this.createGameEvent('roll', `Bot ${bot.username} rolled ${data.roll}`, {
                        botId: bot.id,
                        roll: data.roll,
                        dice: data.dice
                    })
                );
            } else {
                // Handle gameplay roll message
                if (typeof bot.position === 'number' && typeof data.newPosition === 'number') {
                    const fromSpace = BOARD_SPACES[bot.position];
                    const toSpace = BOARD_SPACES[data.newPosition];
                    await this.showMessageWithDelay(
                        `${bot.username} 🤖 rolled ${data.dice[0]} and ${data.dice[1]} (total: ${data.roll})! Moving from ${fromSpace.name} to ${toSpace.name}`,
                        1000
                    );
                }
            }
        } catch (error) {
            console.error('Bot roll error:', {
                error,
                bot: bot.username,
                gameState: this.gameData.gameState
            });
            this.showMessage(`${bot.username} encountered an error while rolling`);
        }
    }

    private async getLatestGameState(): Promise<boolean> {
        try {
            const response = await fetch(`/games/${this.gameData.gameId}/state`);
            if (!response.ok) {
                console.error('Failed to get latest game state:', response.status);
                return false;
            }
            
            const data = await response.json();
            console.log('Latest game state:', data);
            
            // Update game data
            if (data.gameState) {
                this.gameData.gameState = data.gameState;
            }
            if (data.players) {
                this.gameData.players = data.players;
            }
            if (data.properties) {
                this.gameData.properties = data.properties;
            }

            // Update UI
            this.updateBoard();
            this.updateGameStatus();
            this.updatePlayersStatus();
            this.updatePropertiesPanel();

            return true;
        } catch (error) {
            console.error('Failed to get game state:', error);
            return false;
        }
    }

    private hideMessageHistory(): void {
        console.log('Hiding message history panel');
        if (this.messageHistoryPanel) {
            this.messageHistoryPanel.classList.add('hidden');
        }
    }

    private initializeMessageHistory(): void {
        // Remove existing panel if it exists
        const existingPanel = document.getElementById('message-history-panel');
        if (existingPanel) {
            existingPanel.remove();
        }

        // Create message history panel
        const panel = document.createElement('div');
        panel.id = 'message-history-panel';
        panel.className = 'message-history-panel hidden';

        // Create header
        const header = document.createElement('div');
        header.className = 'message-history-header';
        
        const title = document.createElement('h3');
        title.textContent = 'Game History';
        header.appendChild(title);

        // Create close button
        const closeButton = document.createElement('button');
        closeButton.className = 'close-history-button';
        closeButton.innerHTML = '×';
        closeButton.addEventListener('click', (e: Event) => {
            e.stopPropagation();
            this.hideMessageHistory();
        });
        header.appendChild(closeButton);

        // Create content container
        const content = document.createElement('div');
        content.className = 'message-history-content';

        // Add components to panel
        panel.appendChild(header);
        panel.appendChild(content);
        document.body.appendChild(panel);

        // Store panel reference
        this.messageHistoryPanel = panel;

        // Add click handler to status element
        const statusElement = document.querySelector('.game-status');
        if (statusElement) {
            statusElement.addEventListener('click', (e: Event) => {
                e.stopPropagation();
                this.toggleMessageHistory();
            });
        }

        // Add click handler to document to close panel when clicking outside
        document.addEventListener('click', (e: Event) => {
            const target = e.target as Node;
            if (panel && !panel.contains(target) && target !== statusElement) {
                this.hideMessageHistory();
            }
        });
    }

    private toggleMessageHistory(): void {
        if (!this.messageHistoryPanel) {
            console.warn('Message history panel not found');
            return;
        }
        
        const isHidden = this.messageHistoryPanel.classList.contains('hidden');
        
        if (isHidden) {
            this.messageHistoryPanel.classList.remove('hidden');
            this.updateMessageHistory();
        } else {
            this.messageHistoryPanel.classList.add('hidden');
        }
    }

    private updateMessageHistory(): void {
        console.log('=== Updating Message History ===');
        
        if (!this.messageHistoryPanel) {
            console.warn('Message history panel not found');
            return;
        }
        
        const content = this.messageHistoryPanel.querySelector('.message-history-content');
        if (!content) {
            console.warn('Message history content container not found');
            return;
        }

        // Clear existing content
        content.innerHTML = '';
        
        // Get the last 50 messages to prevent too much content
        const recentMessages = this.messageHistory.slice(-50).reverse();
        console.log(`Displaying ${recentMessages.length} recent messages`);
        
        if (recentMessages.length === 0) {
            const emptyMessage = document.createElement('div');
            emptyMessage.className = 'message-history-item';
            emptyMessage.textContent = 'No messages yet';
            content.appendChild(emptyMessage);
            return;
        }
        
        recentMessages.forEach(messageData => {
            const item = document.createElement('div');
            item.className = 'message-history-item';
            
            // Format timestamp
            const timeString = messageData.timestamp.toLocaleTimeString();
            
            const timeSpan = document.createElement('span');
            timeSpan.className = 'message-time';
            timeSpan.textContent = timeString;
            
            const textSpan = document.createElement('span');
            textSpan.className = 'message-text';
            textSpan.textContent = messageData.message;
            
            item.appendChild(timeSpan);
            item.appendChild(textSpan);
            content.appendChild(item);
        });
    }

    private showRules(): void {
        const overlay = document.createElement('div');
        overlay.className = 'rules-overlay';
        
        const rulesContent = `
            <div class="rules-popup">
                <div class="rules-header">
                    <h2>Monopoly Rules</h2>
                    <button class="close-rules">&times;</button>
                </div>
                <div class="rules-content">
                    <!-- Rules content here -->
                </div>
            </div>
        `;
        
        overlay.innerHTML = rulesContent;
        document.body.appendChild(overlay);
        
        const closeButton = overlay.querySelector('.close-rules');
        if (closeButton) {
            closeButton.addEventListener('click', () => this.closeRules());
        }
        
        overlay.addEventListener('click', (e: MouseEvent) => {
            if (e.target === overlay) {
                this.closeRules();
            }
        });
        
        requestAnimationFrame(() => {
            overlay.classList.add('show');
            const popup = overlay.querySelector('.rules-popup');
            if (popup instanceof HTMLElement) {
                popup.classList.add('show');
            }
        });
    }

    private closeRules(): void {
        const overlay = document.querySelector('.rules-overlay');
        if (!overlay) return;
        
        overlay.classList.remove('show');
        
        // Remove after animation
        overlay.addEventListener('transitionend', () => {
            overlay.remove();
        }, { once: true });
    }

    private updateBoard(): void {
        if (!this.gameData?.players || !this.board) {
            console.warn('Cannot update board: missing required data');
            return;
        }

        // Update player positions
        this.gameData.players.forEach((player: Player, index: number) => {
            if (typeof player.position === 'number') {
                this.board.updatePlayerPosition(player.id, player.position, index);
            }
        });

        // Update property ownership
        if (this.gameData.properties) {
            this.gameData.properties.forEach((property: Property) => {
                if (property.ownerId) {
                    const ownerIndex = this.gameData.players.findIndex((p: Player) => p.id === property.ownerId);
                    if (ownerIndex !== -1) {
                        this.board.updatePropertyOwnership(property, ownerIndex);
                    }
                }
            });
        }

        this.updatePropertiesPanel();
    }

    private updatePropertiesPanel(): void {
        const propertiesContent = document.querySelector('.properties-section .panel-content');
        if (!propertiesContent || !this.gameData?.properties) {
            console.warn('Properties panel content or properties data not found');
            return;
        }

        const propertyGroups: PropertyGroup = {
            available: this.gameData.properties.filter(p => !p.ownerId),
            yours: this.gameData.properties.filter(p => p.ownerId === this.gameData.currentPlayerId),
            owned: this.gameData.properties.filter(p => p.ownerId && p.ownerId !== this.gameData.currentPlayerId)
        };

        Object.entries(propertyGroups).forEach(([group, properties]) => {
            const tab = document.getElementById(group) as HTMLDivElement;
            if (tab) {
                tab.innerHTML = '';
                if (properties.length === 0) {
                    tab.innerHTML = '<div class="no-properties">No properties in this category</div>';
                } else {
                    properties.forEach((property: Property & { colorGroup?: string; type?: string }) => {
                        const propertyCard = this.createPropertyCard(property);
                        tab.appendChild(propertyCard);
                    });
                }
            }
        });
    }

    private createPropertyCard(property: Property & { colorGroup?: string; type?: string }): HTMLDivElement {
        const card = document.createElement('div');
        card.className = `property-card ${property.colorGroup || property.type || 'default'}`;
        card.dataset.propertyId = property.id.toString();

        const name = document.createElement('div');
        name.className = 'property-name';
        name.textContent = property.name;

        const price = document.createElement('div');
        price.className = 'property-price';
        price.textContent = `$${property.price}`;

        card.appendChild(name);
        card.appendChild(price);

        return card;
    }

    private async endTurn(): Promise<void> {
        if (!this.gameData?.gameId || !this.gameData?.currentPlayerId) {
            console.warn('Cannot end turn: missing required data');
            return;
        }

        try {
            const response = await fetch(`/game/${this.gameData.gameId}/end-turn`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ playerId: this.gameData.currentPlayerId })
            });

            if (!response.ok) {
                const error = await response.json();
                this.showMessage(error.error || 'Failed to end turn');
                return;
            }

            const data = await response.json();
            
            // Update game state
            if (data.gameState) {
                this.gameData.gameState = data.gameState;
            }
            if (data.players) {
                this.gameData.players = data.players;
            }
            
            // Update UI
            this.updateBoard();
            this.updateGameStatus();
            this.updatePlayersStatus();
            this.updatePropertiesPanel();

            // Show turn transition message
            const nextPlayer = this.gameData.players.find(p => p.id === data.nextPlayerId);
            if (nextPlayer) {
                const playerType = nextPlayer.isBot ? '🤖' : '';
                await this.showMessageWithDelay(
                    `${nextPlayer.username}${playerType}'s turn`,
                    1000
                );

                // If next player is also a bot, process their turn after a short delay
                if (nextPlayer.isBot) {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    await this.processBotTurn(nextPlayer);
                }
            }
        } catch (error) {
            console.error('End turn error:', error);
            this.showMessage('Failed to end turn');
        }
    }

    private getNextPlayer(): Player | null {
        if (!this.gameData?.gameState) {
            return null;
        }

        if (this.gameData.gameState.phase === 'waiting') {
            const playersWhoHaveNotRolled = this.gameData.players.filter(p => 
                !this.gameData.gameState?.diceRolls.some(r => r.id === p.id)
            );
            return playersWhoHaveNotRolled[0] || null;
        }
        
        const currentPlayerId = this.gameData.gameState.turnOrder[this.gameData.gameState.currentPlayerIndex];
        return this.gameData.players.find(p => p.id === currentPlayerId) || null;
    }

    private getCurrentPlayer(): Player | null {
        if (!this.gameData?.currentPlayerId) {
            return null;
        }
        return this.gameData.players.find(p => p.id === this.gameData.currentPlayerId) || null;
    }

    private checkForBotTurn(): void {
        const currentPlayer = this.getNextPlayer();
        
        if (!currentPlayer) {
            return;
        }
        
        // Only process bot turns during playing phase and when not already processing
        if (currentPlayer.isBot && 
            this.gameData?.gameState?.phase === GAME_PHASES.PLAYING && 
            !this.isProcessingBotTurn) {
            // Use Promise to ensure sequential processing
            Promise.resolve().then(() => this.processBotTurn(currentPlayer));
        }
    }

    private updatePlayers(players: Player[]): void {
        this.gameData.players = players;
        this.updatePlayersStatus();
    }

    private isCurrentPlayerBot(): boolean {
        const currentPlayer = this.getNextPlayer();
        return currentPlayer?.isBot || false;
    }

    // Add helper method to create GameEvent
    private createGameEvent(type: GameEventType, description: string, metadata?: Record<string, any>): GameEvent {
        // Use -1 as default if currentPlayerId is null
        const effectivePlayerId = this.gameData.currentPlayerId ?? -1;
        
        return {
            type,
            playerId: effectivePlayerId,
            description,
            timestamp: new Date(),
            metadata
        };
    }
}

// Initialize game when document is ready
document.addEventListener('DOMContentLoaded', () => {
    console.log('=== Game Initialization ===');
    
    // Initialize game service if we have game data
    if (window.monopolyGameData) {
        console.log('Initial game data found:', window.monopolyGameData);
        new GameService(window.monopolyGameData);
    } else {
        console.error('No initial game data found in window.monopolyGameData');
    }
}); 