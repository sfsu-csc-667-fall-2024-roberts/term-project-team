import { GameData, Player, Property, GameState, PlayerWithRoll, RollResponse, GamePhase } from '../../shared/types';
import { BOARD_SPACES } from '../../shared/boardData';
import MonopolyBoard from './board';

interface BotActionResponse {
  action: string;
  success: boolean;
  message: string;
  gameState: GameState;
}

const GAME_PHASES = {
  WAITING: 'waiting' as const,
  ROLLING: 'rolling' as const,
  PROPERTY_DECISION: 'property_decision' as const,
  PAYING_RENT: 'paying_rent' as const,
  IN_JAIL: 'in_jail' as const,
  BANKRUPT: 'bankrupt' as const,
  GAME_OVER: 'game_over' as const,
  PLAYING: 'playing' as const,
} as const;

interface MessageHistoryItem {
  message: string;
  timestamp: string;
}

interface GameMessage {
  type?: string;
  message?: string;
  player?: Player;
  property?: Property;
  roll?: number;
  dice?: number[];
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

export class GameService {
  private gameData: GameData;
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
    
    // Singleton pattern to ensure only one game service instance
    if (GameService.instance) {
      console.log('Existing game service instance found, cleaning up');
      GameService.instance.cleanup();
    }

    this.gameData = gameData;
    this.messageContainer = document.querySelector('.game-messages') as HTMLElement;
    this.statusElement = document.querySelector('.game-status') as HTMLElement;
    this.playersElement = document.querySelector('.players-list') as HTMLElement;
    
    // Initialize board after cleaning up any existing instance
    console.log('Initializing new board instance');
    this.board = new MonopolyBoard('monopoly-board');
    
    this.initializeEventListeners();
    this.initializeBoard();
    this.updateGameStatus();
    this.updatePropertiesPanel();
    this.checkForBotTurn();
    
    this.initializeMessageHistory();
    
    GameService.instance = this;
  }

  private cleanup(): void {
    console.log('Cleaning up game service');
    
    // Remove event listeners by replacing elements with clones
    const rollDiceButton = document.getElementById('roll-dice');
    const endTurnButton = document.getElementById('end-turn');
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
    // Remove existing listeners first
    const rollButton = document.getElementById('roll-dice');
    const endTurnButton = document.getElementById('end-turn');
    const viewRulesButton = document.getElementById('view-rules');
    const gameTitle = document.querySelector('.game-title');
    const statusElement = document.querySelector('.game-status');

    // Clone and replace elements to remove old listeners
    if (rollButton) {
        const newRollButton = rollButton.cloneNode(true);
        rollButton.parentNode?.replaceChild(newRollButton, rollButton);
        newRollButton.addEventListener('click', () => {
            if (this._isProcessingRoll) return;
            this.rollDice();
        });
    }

    if (endTurnButton) {
        const newEndButton = endTurnButton.cloneNode(true);
        endTurnButton.parentNode?.replaceChild(newEndButton, endTurnButton);
        newEndButton.addEventListener('click', () => this.endTurn());
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
        newStatus.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleMessageHistory();
        });
    }
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
      const response = await fetch(`/game/${this.gameData.gameId}/roll`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          playerId: this.gameData.currentPlayerId
        })
      });

      if (!response.ok) {
        const error = await response.json();
        console.error('Roll request failed:', error);
        this.showMessage(error.error || 'Failed to roll dice');
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
      this.showMessage('Failed to roll dice');
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
        isBot: p.isBot
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

    // Show roll message with delay
    await this.showMessageWithDelay(`You rolled ${data.dice[0]} and ${data.dice[1]} (total: ${data.roll})!`, 1000);

    // If this was the human player's roll, trigger bot rolls sequentially
    if (this.gameData.gameState.diceRolls.length === 1) {
      console.log('First roll detected, triggering bot rolls...');
      const botsToRoll = this.gameData.players.filter(p => 
        p.isBot && !this.gameData.gameState.diceRolls.some(r => r.id === p.id)
      );
      
      console.log('Bots that need to roll:', botsToRoll.map(b => b.username));
      
      // Roll for each bot sequentially
      for (const bot of botsToRoll) {
        await this.showMessageWithDelay(`Waiting for ${bot.username} to roll...`, 800);
        await this.rollForBot(bot.id);
        await new Promise(resolve => setTimeout(resolve, 1000)); // Wait between bot rolls
      }
    }

    // Check if we need to reroll due to ties
    if (this.gameData.gameState.phase === 'waiting' && this.gameData.gameState.diceRolls.length === 0) {
      console.log('Tie detected, handling rerolls...', {
        gameState: this.gameData.gameState,
        players: this.gameData.players
      });
      
      await this.showMessageWithDelay('Tie detected! Players need to reroll.', 1500);
      const tiedRoll = data.roll;
      await this.showMessageWithDelay(`Both players rolled ${tiedRoll}!`, 800);
      await this.showMessageWithDelay('Starting reroll...', 1000);
      
      // Enable roll button for human player
      const rollDiceButton = document.getElementById('roll-dice') as HTMLButtonElement;
      if (rollDiceButton) {
        rollDiceButton.disabled = false;
        console.log('Enabling roll button for reroll');
      }

      // If the current player is a bot, trigger their roll
      const currentPlayer = this.getNextPlayer();
      if (currentPlayer?.isBot) {
        console.log('Bot needs to reroll first:', currentPlayer);
        await new Promise(resolve => setTimeout(resolve, 1000));
        await this.rollForBot(currentPlayer.id);
      }
    } else if (this.gameData.gameState.turnOrder.length > 0) {
      // No ties, proceed with turn order display
      await this.showMessageWithDelay(`Determining turn order...`, 1500);
      
      // Sort players by their roll values and match with player names
      const rollResults = this.gameData.gameState.diceRolls
        .map(roll => {
          const player = this.gameData.players.find(p => p.id === roll.id);
          return {
            username: player?.username || 'Unknown',
            roll: roll.roll || 0,
            isBot: player?.isBot || false,
            id: roll.id
          };
        })
        .sort((a, b) => b.roll - a.roll);

      console.log('Turn order results:', rollResults);

      // Show final turn order
      await this.showMessageWithDelay(`Final turn order:`, 1000);
      for (let i = 0; i < rollResults.length; i++) {
        const result = rollResults[i];
        const playerType = result.isBot ? '🤖' : '👤';
        const position = i + 1;
        await this.showMessageWithDelay(`${position}. ${result.username}${playerType} (rolled ${result.roll})`, 800);
      }
      
      // Wait before transitioning to playing phase
      await this.showMessageWithDelay(`Game starting...`, 1500);
      
      // Get the first player
      const firstPlayer = this.gameData.players.find(p => p.id === this.gameData.gameState.turnOrder[0]);
      if (firstPlayer) {
        const playerType = firstPlayer.isBot ? '🤖' : '👤';
        await this.showMessageWithDelay(`${firstPlayer.username}${playerType} goes first!`, 1000);
        await this.showMessageWithDelay(`Starting first turn...`, 1000);
        
        // Important: Wait for all messages and state updates to complete
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        // Get fresh game state before proceeding
        await this.getLatestGameState();
        
        // Update UI before processing first turn
        this.updateGameStatus();
        this.updatePlayersStatus();
        
        // Only start bot turn if we're definitely in playing phase and it's their turn
        if (firstPlayer.isBot && 
            this.gameData.gameState.phase === 'playing' && 
            this.gameData.gameState.currentPlayerIndex === 0) {
            console.log('First player is a bot, ensuring game state before starting turn...');
            // Additional wait to ensure all messages are displayed
            await new Promise(resolve => setTimeout(resolve, 1500));
            // Only process bot turn if still in playing phase
            if (this.gameData.gameState.phase === 'playing') {
                await this.processBotTurn(firstPlayer);
            }
        } else if (!firstPlayer.isBot && firstPlayer.id === this.gameData.currentPlayerId) {
            // Enable controls for human player
            const rollButton = document.getElementById('roll-dice') as HTMLButtonElement;
            if (rollButton) {
                rollButton.disabled = false;
                console.log('Enabling roll button for first player');
            }
        }
      }
    }

    // Update UI
    console.log('Updating UI components');
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
      console.log('Updating player position:', {
        playerId: currentPlayer.id,
        newPosition
      });
      
      const playerIndex = this.gameData.players.findIndex(p => p.id === currentPlayer.id);
      await this.board.updatePlayerPosition(currentPlayer.id, newPosition, playerIndex);

      // Wait for animation to complete
      await new Promise(resolve => setTimeout(resolve, 1000));

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

  private async handleSpaceAction(spaceAction: any, currentPlayer: any): Promise<void> {
    console.log('\n=== Processing Space Action ===');
    console.log('Space action details:', spaceAction);
    console.log('Current game phase:', this.gameData.gameState.phase);
    
    // Don't process any space actions during waiting phase
    if (this.gameData.gameState.phase === GAME_PHASES.WAITING) {
        console.log('Skipping space action during waiting phase');
        return;
    }
    
    if (spaceAction.type === 'card_drawn') {
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
        if (spaceAction.card.action?.type === 'get_out_of_jail') {
            // For Get Out of Jail Free card, ensure position doesn't change
            currentPlayer.position = currentPosition;
        }
    } else if (spaceAction.type === 'pay_tax') {
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
    } else if (spaceAction.type === 'purchase_available') {
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
            
            const purchaseDialog = document.createElement('div');
            purchaseDialog.className = 'purchase-dialog';
            purchaseDialog.innerHTML = `
                <div class="purchase-content">
                    <h3>Purchase Property</h3>
                    <p>${property.name} is available for $${property.price}</p>
                    <div class="purchase-buttons">
                        <button id="buy-property">Buy</button>
                        <button id="skip-purchase">Skip</button>
                    </div>
                </div>
            `;
            
            document.body.appendChild(purchaseDialog);

            // Add event listeners
            const buyButton = purchaseDialog.querySelector('#buy-property');
            const skipButton = purchaseDialog.querySelector('#skip-purchase');

            if (buyButton && skipButton) {
                buyButton.addEventListener('click', async () => {
                    purchaseDialog.remove();
                    await this.buyProperty(property.position);
                });

                skipButton.addEventListener('click', () => {
                    purchaseDialog.remove();
                });
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
        timestamp: new Date().toISOString()
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
          displayMessage = `${message.player?.username} rolled ${message.dice?.[0]} and ${message.dice?.[1]} (total: ${message.roll})!`;
          break;
        case 'purchase':
          displayMessage = `${message.player?.username} purchased ${message.property?.name}!`;
          break;
        case 'error':
          displayMessage = message.message || 'An error occurred';
          break;
        default:
          displayMessage = message.message || 'Unknown message';
      }
    }

    this._messageQueue.push({ message: displayMessage, delay: 5000 });
    this.processMessageQueue();
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
      timestamp: new Date().toISOString()
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
    
    let currentPlayer: Player | undefined;
    
    if (this.gameData.gameState.phase === GAME_PHASES.WAITING) {
      currentPlayer = this.getNextPlayer();
      console.log('Current player in waiting phase:', currentPlayer ? {
        id: currentPlayer.id,
        username: currentPlayer.username,
        isBot: currentPlayer.isBot
      } : 'undefined');
    } else {
      currentPlayer = this.getNextPlayer();
      console.log('Current player in playing phase:', currentPlayer ? {
        id: currentPlayer.id,
        username: currentPlayer.username,
        isBot: currentPlayer.isBot
      } : 'undefined');
    }
    
    console.log('Current game state:', {
      phase: this.gameData.gameState.phase,
      currentPlayerIndex: this.gameData.gameState.currentPlayerIndex,
      turnOrder: this.gameData.gameState.turnOrder,
      diceRolls: this.gameData.gameState.diceRolls
    });
    
    if (currentPlayer) {
      this.board.setCurrentPlayer(currentPlayer.id);
    }
    
    let statusText = '';
    
    if (this.gameData.gameState.phase === GAME_PHASES.WAITING) {
      const rollCount = this.gameData.gameState.diceRolls.length;
      const totalPlayers = this.gameData.players.length;
      
      if (rollCount === 0 && this.gameData.gameState.lastRoll !== undefined) {
        statusText = `Tie detected! Players need to reroll (${rollCount}/${totalPlayers} players rolled)`;
      } else {
        statusText = `Initial Roll Phase - Roll to determine turn order (${rollCount}/${totalPlayers} players rolled)`;
      }
    } else {
      statusText = currentPlayer ? 
        `${currentPlayer.username}'s Turn${currentPlayer.id === this.gameData.currentPlayerId ? ' - Your turn!' : ''}` :
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

  private canPlayerRoll(currentPlayer: Player | undefined): boolean {
    if (!currentPlayer) return false;
    
    // In waiting phase, player can roll if they haven't rolled yet
    if (this.gameData.gameState.phase === GAME_PHASES.WAITING) {
      const hasRolled = this.gameData.gameState.diceRolls.some(r => r.id === currentPlayer.id);
      const isCurrentUser = currentPlayer.id === this.gameData.currentPlayerId;
      const isBot = currentPlayer.isBot;
      return !hasRolled && isCurrentUser && !isBot;
    }
    
    // In playing phase, current player can roll if it's their turn and hasn't rolled yet
    const isCurrentTurn = currentPlayer.id === this.gameData.gameState.turnOrder[this.gameData.gameState.currentPlayerIndex];
    const isCurrentUser = currentPlayer.id === this.gameData.currentPlayerId;
    const hasRolled = this.gameData.gameState.lastRoll !== undefined;
    const isBot = currentPlayer.isBot;
    
    return isCurrentTurn && isCurrentUser && !hasRolled && !isBot;
  }

  private canPlayerEndTurn(currentPlayer: Player | undefined): boolean {
    if (!currentPlayer) return false;
    
    // Can't end turn during waiting phase
    if (this.gameData.gameState.phase === GAME_PHASES.WAITING) {
      return false;
    }
    
    const isCurrentTurn = currentPlayer.id === this.gameData.gameState.turnOrder[this.gameData.gameState.currentPlayerIndex];
    const isCurrentUser = currentPlayer.id === this.gameData.currentPlayerId;
    const hasRolled = this.gameData.gameState.lastRoll !== undefined;
    const isBot = currentPlayer.isBot;
    
    return isCurrentTurn && isCurrentUser && hasRolled && !isBot;
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
      console.log('Updating player:', p);
      
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
      
      if (p.id === this.gameData.currentPlayerId) {
        const youLabel = document.createElement('span');
        youLabel.className = 'player-you';
        youLabel.textContent = '(You)';
        nameContainer.appendChild(youLabel);
        
        // Add controls for current player
        const controls = document.createElement('div');
        controls.className = 'player-controls';
        
        const rollButton = document.createElement('button') as HTMLButtonElement;
        rollButton.id = 'roll-dice';
        rollButton.textContent = 'Roll';
        rollButton.disabled = !this.canPlayerRoll(p);
        
        const endButton = document.createElement('button') as HTMLButtonElement;
        endButton.id = 'end-turn';
        endButton.textContent = 'End';
        endButton.disabled = !this.canPlayerEndTurn(p);
        
        controls.appendChild(rollButton);
        controls.appendChild(endButton);
        nameContainer.appendChild(controls);
        
        // Add event listeners
        rollButton.addEventListener('click', () => this.rollDice());
        endButton.addEventListener('click', () => this.endTurn());
      }
      
      info.appendChild(nameContainer);
      
      // Add player stats
      const stats = document.createElement('div');
      stats.className = 'player-stats';
      
      const balance = document.createElement('div');
      balance.className = 'player-balance';
      balance.textContent = `$${p.balance}`;
      
      const position = document.createElement('div');
      position.className = 'player-position';
      position.textContent = BOARD_SPACES[p.position].name;
      
      const status = document.createElement('div');
      status.className = 'roll-status';
      
      // Show jail free card status if any
      const jailFreeCards = this.gameData.gameState.jailFreeCards?.[p.id] || 0;
      if (jailFreeCards > 0) {
        const jailCard = document.createElement('div');
        jailCard.className = 'jail-free-card';
        jailCard.textContent = `🎟️ Get Out of Jail Free${jailFreeCards > 1 ? ` (${jailFreeCards})` : ''}`;
        status.appendChild(jailCard);
      }
      
      // Add roll status text based on game phase
      let statusText = '';
      if (this.gameData.gameState.phase === GAME_PHASES.WAITING) {
        const allRolls = this.gameData.gameState.diceRolls;
        const playerRoll = allRolls.find(r => r.id === p.id);
        
        if (playerRoll) {
          statusText = `Rolled: ${playerRoll.dice ? `${playerRoll.dice[0]} + ${playerRoll.dice[1]} = ${playerRoll.roll}` : playerRoll.roll}`;
        } else if (allRolls.length === 0 && this.gameData.gameState.lastRoll !== undefined) {
          statusText = `Previous: ${this.gameData.gameState.lastRoll} (Tied)`;
        } else {
          statusText = 'Waiting for roll...';
        }
      } else {
        if (p.id === this.gameData.gameState.turnOrder[this.gameData.gameState.currentPlayerIndex]) {
          statusText = this.gameData.gameState.lastRoll ? 
            `Current turn (rolled ${this.gameData.gameState.lastRoll})` : 
            'Current turn';
        } else {
          statusText = 'Waiting';
        }
      }
      
      const statusTextEl = document.createElement('div');
      statusTextEl.textContent = statusText;
      status.appendChild(statusTextEl);
      
      stats.appendChild(balance);
      stats.appendChild(position);
      stats.appendChild(status);
      info.appendChild(stats);
      
      playerCard.appendChild(avatar);
      playerCard.appendChild(info);
      
      this.playersElement.appendChild(playerCard);
    });

    // Re-initialize event listeners after updating player status
    this.initializeEventListeners();
  }

  private async processBotTurn(bot: Player): Promise<void> {
    // Early check for processing state and game phase
    if (this.isProcessingBotTurn || this.gameData.gameState.phase !== 'playing') {
        console.log('Skipping bot turn:', {
            isProcessing: this.isProcessingBotTurn,
            gamePhase: this.gameData.gameState.phase
        });
        return;
    }

    console.log('=== Processing Bot Turn Started ===');
    console.log('Bot details:', {
        id: bot.id,
        username: bot.username,
        position: bot.position,
        balance: bot.balance,
        gamePhase: this.gameData.gameState.phase,
        currentPlayerIndex: this.gameData.gameState.currentPlayerIndex
    });

    // Set processing flag before any async operations
    this.isProcessingBotTurn = true;

    try {
        // Get fresh game state before proceeding
        await this.getLatestGameState();

        // Verify it's still the bot's turn and we're in playing phase
        const currentPlayer = this.getNextPlayer();
        if (!currentPlayer || 
            currentPlayer.id !== bot.id || 
            this.gameData.gameState.phase !== 'playing' ||
            currentPlayer.id !== this.gameData.gameState.turnOrder[this.gameData.gameState.currentPlayerIndex]) {
            console.log('Bot turn verification failed:', {
                expected: bot.id,
                actual: currentPlayer?.id,
                phase: this.gameData.gameState.phase,
                currentIndex: this.gameData.gameState.currentPlayerIndex,
                turnOrder: this.gameData.gameState.turnOrder
            });
            return;
        }

        // Ensure all previous messages are processed
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Roll dice
        console.log('Rolling for bot...');
        await this.showMessageWithDelay(`${bot.username}'s turn`, 1000);
        await this.rollForBot(bot.id);

        // Wait for roll animation and messages
        await new Promise(resolve => setTimeout(resolve, 1500));

        // Verify game state again before making decisions
        await this.getLatestGameState();
        if (this.gameData.gameState.phase === 'playing' && 
            currentPlayer.id === this.gameData.gameState.turnOrder[this.gameData.gameState.currentPlayerIndex]) {
            // Make property decisions
            console.log('Making bot decisions...');
            await this.makeBotDecisions(bot);

            // Wait for decision messages
            await new Promise(resolve => setTimeout(resolve, 1500));

            // End turn
            console.log('Ending bot turn...');
            await this.endBotTurn(bot);
        }
    } catch (error) {
        console.error('Bot turn error:', error);
        this.showMessage(`${bot.username} encountered an error during their turn`);
    } finally {
        this.isProcessingBotTurn = false;
        console.log('=== Processing Bot Turn Completed ===');
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
        const response = await fetch(`/game/${this.gameData.gameId}/roll`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ botId: bot.id })
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

        // Show roll message based on game phase BEFORE updating state
        if (this.gameData.gameState.phase === GAME_PHASES.WAITING) {
            await this.showMessageWithDelay(
                `${bot.username} rolled ${data.dice[0]} and ${data.dice[1]} (total: ${data.roll})!`,
                1000
            );
        } else if (typeof bot.position === 'number' && typeof data.newPosition === 'number') {
            const fromSpace = BOARD_SPACES[bot.position];
            const toSpace = BOARD_SPACES[data.newPosition];
            await this.showMessageWithDelay(
                `${bot.username} rolled ${data.dice[0]} and ${data.dice[1]} (total: ${data.roll})! Moving from ${fromSpace.name} to ${toSpace.name}`,
                1000
            );
        }

        // Update game state AFTER showing message
        console.log('Updating game state:', {
            oldState: this.gameData.gameState,
            newState: data.gameState
        });
        this.gameData.gameState = data.gameState;

        // Update players if provided
        if (data.players) {
            console.log('Updating players:', {
                oldPlayers: this.gameData.players,
                newPlayers: data.players
            });
            this.gameData.players = data.players;
        }

        // Update bot position only during playing phase
        if (this.gameData.gameState.phase !== GAME_PHASES.WAITING) {
            bot.position = data.newPosition;
            const botIndex = this.gameData.players.findIndex(p => p.id === bot.id);
            await this.board.updatePlayerPosition(bot.id, data.newPosition, botIndex);
        }

        // Handle space action only during playing phase
        if (data.spaceAction && this.gameData.gameState.phase !== GAME_PHASES.WAITING) {
            await this.handleSpaceAction(data.spaceAction, bot);
        }

        // Update UI
        console.log('Updating UI components');
        this.updateBoard();
        this.updateGameStatus();
        this.updatePlayersStatus();

        console.log('=== Rolling for Bot Completed ===\n');
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
      const response = await fetch(`/game/${this.gameData.gameId}/state`);
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

  private initializeMessageHistory(): void {
    console.log('=== Initializing Message History ===');
    
    // Remove existing panel if it exists
    const existingPanel = document.getElementById('message-history-panel');
    if (existingPanel) {
      existingPanel.remove();
    }

    // Create message history panel
    const panel = document.createElement('div');
    panel.id = 'message-history-panel';
    panel.className = 'message-history-panel hidden';
    document.body.appendChild(panel);

    // Create header
    const header = document.createElement('div');
    header.className = 'message-history-header';
    header.innerHTML = '<h3>Game History</h3>';
    panel.appendChild(header);

    // Create close button
    const closeButton = document.createElement('button');
    closeButton.className = 'close-history-button';
    closeButton.textContent = '×';
    header.appendChild(closeButton);

    // Create content container
    const content = document.createElement('div');
    content.className = 'message-history-content';
    panel.appendChild(content);

    // Store panel reference
    this.messageHistoryPanel = panel;

    // Add click handler to status element
    const statusElement = document.querySelector('.game-status');
    if (statusElement) {
      statusElement.addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggleMessageHistory();
      });
    }

    // Add click handler to close button
    closeButton.addEventListener('click', (e) => {
      e.stopPropagation();
      this.hideMessageHistory();
    });

    // Add click handler to document to close panel when clicking outside
    document.addEventListener('click', (e) => {
      if (panel && !panel.contains(e.target as Node) && e.target !== statusElement) {
        this.hideMessageHistory();
      }
    });

    console.log('Message history panel initialized:', this.messageHistoryPanel);
  }

  private toggleMessageHistory(): void {
    console.log('=== Toggling Message History ===');
    if (!this.messageHistoryPanel) {
      console.warn('Message history panel not found');
      return;
    }
    
    const isHidden = this.messageHistoryPanel.classList.contains('hidden');
    console.log('Current state:', { isHidden });
    
    if (isHidden) {
      this.showMessageHistory();
    } else {
      this.hideMessageHistory();
    }
  }

  private showMessageHistory(): void {
    if (!this.messageHistoryPanel) {
      console.warn('Message history panel not found');
      return;
    }
    
    this.messageHistoryPanel.classList.remove('hidden');
    this.updateMessageHistory();
  }

  private hideMessageHistory(): void {
    if (!this.messageHistoryPanel) {
      console.warn('Message history panel not found');
      return;
    }
    
    this.messageHistoryPanel.classList.add('hidden');
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
    
    recentMessages.forEach(messageData => {
      const item = document.createElement('div');
      item.className = 'message-history-item';
      
      // Format timestamp
      const timestamp = new Date(messageData.timestamp);
      const timeString = timestamp.toLocaleTimeString();
      
      item.innerHTML = `
        <span class="message-time">${timeString}</span>
        <span class="message-text">${messageData.message}</span>
      `;
      
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
          <div class="rules-section">
            <h3>Game Setup</h3>
            <ul>
              <li>Each player starts with $1500</li>
              <li>Players roll dice to determine turn order</li>
              <li>In case of a tie, tied players roll again</li>
            </ul>
          </div>
          <div class="rules-section">
            <h3>Taking Your Turn</h3>
            <ul>
              <li>Roll the dice and move your token clockwise</li>
              <li>Landing on an unowned property allows you to buy it</li>
              <li>Landing on an owned property requires paying rent</li>
              <li>Rolling doubles lets you roll again</li>
              <li>Three doubles in a row sends you to jail</li>
            </ul>
          </div>
          <div class="rules-section">
            <h3>Properties & Rent</h3>
            <ul>
              <li>Collect rent when other players land on your properties</li>
              <li>Build houses/hotels to increase rent</li>
              <li>Must build evenly within a color group</li>
              <li>Owning all properties of a color increases rent</li>
            </ul>
          </div>
          <div class="rules-section">
            <h3>Special Spaces</h3>
            <ul>
              <li>GO: Collect $200 when passing</li>
              <li>Chance/Community Chest: Draw a card and follow instructions</li>
              <li>Income Tax: Pay $200</li>
              <li>Luxury Tax: Pay $100</li>
              <li>Free Parking: No action required</li>
              <li>Go to Jail: Move directly to jail</li>
            </ul>
          </div>
          <div class="rules-section">
            <h3>Jail</h3>
            <ul>
              <li>Get out by: Rolling doubles, paying $50, or using a Get Out of Jail Free card</li>
              <li>Must pay $50 after three turns if still in jail</li>
              <li>Can still collect rent while in jail</li>
            </ul>
          </div>
        </div>
      </div>
    `;
    
    overlay.innerHTML = rulesContent;
    document.body.appendChild(overlay);
    
    // Add click handlers
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        this.closeRules();
      }
    });
    
    const closeButton = overlay.querySelector('.close-rules');
    if (closeButton) {
      closeButton.addEventListener('click', () => this.closeRules());
    }
    
    // Show with animation
    requestAnimationFrame(() => {
      overlay.classList.add('show');
      const popup = overlay.querySelector('.rules-popup');
      if (popup) {
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
    console.log('=== Updating Board ===');
    
    // Get latest positions from game state
    const currentPositions = new Map<number, number>();
    this.gameData.players.forEach(player => {
      currentPositions.set(player.id, player.position);
      console.log('Current position for player:', {
        id: player.id,
        username: player.username,
        position: player.position
      });
    });

    // Update player positions only if they've changed
    this.gameData.players.forEach((player: Player, index: number) => {
      const lastKnownPosition = currentPositions.get(player.id);
      if (lastKnownPosition !== undefined && lastKnownPosition !== player.position) {
        console.log('Position changed for player:', {
          id: player.id,
          username: player.username,
          from: lastKnownPosition,
          to: player.position,
          index
        });
      }
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

    // Update properties panel
    this.updatePropertiesPanel();
  }

  private updatePropertiesPanel(): void {
    console.log('=== Updating Properties Panel ===');
    console.log('Creating properties panel');
    
    const propertiesContent = document.querySelector('.properties-section .panel-content');
    if (!propertiesContent) {
        console.error('Properties panel content not found');
        return;
    }

    // Group properties by ownership with proper typing
    const propertiesByOwnership = this.gameData.properties.reduce<PropertyGroup>((acc, property) => {
        if (!property.ownerId) {
            acc.available.push(property);
        } else if (property.ownerId === this.gameData.currentPlayerId) {
            acc.yours.push(property);
        } else {
            acc.owned.push(property);
        }
        return acc;
    }, { available: [], owned: [], yours: [] });

    console.log('Properties by ownership:', propertiesByOwnership);

    // Get or create tab content container
    let tabContent = propertiesContent.querySelector('.tab-content');
    if (!tabContent) {
        tabContent = document.createElement('div');
        tabContent.className = 'tab-content';
        propertiesContent.appendChild(tabContent);
    }

    // Clear existing content
    tabContent.innerHTML = '';

    // Create content for each tab with proper typing
    const createPropertyList = (properties: Property[], type: keyof PropertyGroup): HTMLDivElement => {
        const list = document.createElement('div');
        list.className = `property-list ${type}-properties`;
        
        if (properties.length === 0) {
            const noProperties = document.createElement('div');
            noProperties.className = 'no-properties';
            noProperties.textContent = 'No properties in this category';
            list.appendChild(noProperties);
            return list;
        }

        properties.forEach((property: Property) => {
            const propertyItem = document.createElement('div');
            propertyItem.className = 'property-item';
            
            // Add color indicator based on property type
            const colorClass = this.getPropertyColorClass(property);
            propertyItem.classList.add(colorClass);
            
            let details = '';
            if (property.houseCount > 0) {
                details = property.houseCount === 5 ? '🏨' : '🏠'.repeat(property.houseCount);
            }
            if (property.isMortgaged) {
                details += ' 📝';
            }

            propertyItem.innerHTML = `
                <div class="property-name">${property.name}${details ? ` ${details}` : ''}</div>
                <div class="property-price">$${property.price}</div>
            `;
            list.appendChild(propertyItem);
        });

        return list;
    };

    // Add content for each tab with proper typing
    const tabs: PropertyTabs = {
        available: createPropertyList(propertiesByOwnership.available, 'available'),
        owned: createPropertyList(propertiesByOwnership.owned, 'owned'),
        yours: createPropertyList(propertiesByOwnership.yours, 'yours')
    };

    // Show the active tab
    const activeTab = propertiesContent.querySelector('.tab-button.active');
    const activeTabType = (activeTab?.getAttribute('data-tab') || 'available') as keyof PropertyTabs;
    tabContent.appendChild(tabs[activeTabType]);

    // Add tab click handlers
    propertiesContent.querySelectorAll('.tab-button').forEach(button => {
        button.addEventListener('click', (e) => {
            const tabType = (e.target as HTMLElement).getAttribute('data-tab') as keyof PropertyTabs | null;
            if (!tabType || !tabs[tabType]) return;

            // Update active state
            propertiesContent.querySelectorAll('.tab-button').forEach(b => 
                b.classList.remove('active'));
            (e.target as HTMLElement).classList.add('active');

            // Update content
            tabContent.innerHTML = '';
            tabContent.appendChild(tabs[tabType]);
        });
    });

    console.log('Properties panel updated');
  }

  private getPropertyColorClass(property: Property): string {
    if (property.type === 'railroad') return 'color-railroad';
    if (property.type === 'utility') return 'color-utility';
    
    // Map color groups to CSS classes
    const colorMap: { [key: string]: string } = {
        'brown': 'color-brown',
        'light-blue': 'color-light-blue',
        'pink': 'color-pink',
        'orange': 'color-orange',
        'red': 'color-red',
        'yellow': 'color-yellow',
        'green': 'color-green',
        'blue': 'color-blue'
    };
    
    return colorMap[property.colorGroup || ''] || 'color-default';
  }

  private async endTurn(): Promise<void> {
    try {
      console.log('=== End Turn Started ===');
      console.log('Current game state:', this.gameData.gameState);
      
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
      console.log('End turn response:', data);
      
      // Update game state
      this.gameData.gameState = data.gameState;
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

        // If next player is a bot, process their turn after a short delay
        if (nextPlayer.isBot) {
          console.log('Next player is a bot, processing their turn...');
          await new Promise(resolve => setTimeout(resolve, 1000));
          await this.processBotTurn(nextPlayer);
        }
      }

      console.log('=== End Turn Completed ===');
    } catch (error) {
      console.error('End turn error:', error);
      this.showMessage('Failed to end turn');
    }
  }

  private getNextPlayer(): Player | undefined {
    // During waiting phase, return the first player who hasn't rolled yet
    if (this.gameData.gameState.phase === GAME_PHASES.WAITING) {
        const unrolledPlayer = this.gameData.players.find((p: Player) => 
            !this.gameData.gameState.diceRolls.some(r => r.id === p.id)
        );
        console.log('Next player during waiting phase:', {
            unrolledPlayer,
            currentRolls: this.gameData.gameState.diceRolls,
            players: this.gameData.players
        });
        return unrolledPlayer;
    }
    
    // During playing phase, return the current player based on turn order
    const currentPlayer = this.gameData.players.find((p: Player) => 
        p.id === this.gameData.gameState.turnOrder[this.gameData.gameState.currentPlayerIndex]
    );
    console.log('Next player during playing phase:', {
        currentPlayer,
        turnOrder: this.gameData.gameState.turnOrder,
        currentIndex: this.gameData.gameState.currentPlayerIndex
    });
    return currentPlayer;
  }

  private getCurrentPlayer(): Player | null {
    if (!this.gameData || !this.gameData.players) return null;
    
    const currentIndex = this.gameData.gameState.currentPlayerIndex;
    return this.gameData.players[currentIndex] || null;
  }

  private checkForBotTurn(): void {
    console.log('Checking for bot turn...');
    const currentPlayer = this.getNextPlayer();
    
    if (!currentPlayer) {
        console.log('No current player found');
        return;
    }
    
    console.log('Current player:', {
        id: currentPlayer.id,
        username: currentPlayer.username,
        isBot: currentPlayer.isBot,
        phase: this.gameData.gameState.phase
    });

    // Only process bot turns during playing phase and when not already processing
    if (currentPlayer.isBot && 
        this.gameData.gameState.phase === GAME_PHASES.PLAYING && 
        !this.isProcessingBotTurn) {
        console.log('Bot turn detected, processing...');
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
}

// Initialize game service when the page loads
document.addEventListener('DOMContentLoaded', () => {
  new GameService(window.gameData);
}); 