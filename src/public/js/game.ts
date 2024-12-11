import MonopolyBoard from './board';
import { GameData, PurchaseResponse, ApiError, Player, Property } from './types';
import { BOARD_SPACES, BoardSpace } from '../../shared/boardData';

class GameService {
  private board: MonopolyBoard;
  private currentPlayerId: number;
  private players: Player[];
  private currentPlayerIndex: number;
  private isMyTurn: boolean;

  constructor() {
    this.currentPlayerId = window.gameData.currentUserId;
    this.players = window.gameData.players;
    this.board = new MonopolyBoard('monopoly-board');
    
    // Initialize turn management
    this.currentPlayerIndex = this.players.findIndex(p => p.user_id === this.currentPlayerId);
    this.isMyTurn = this.currentPlayerIndex === 0; // First player starts
    
    this.initializeEventListeners();
    this.initializePlayerPositions();
    if (window.gameData.properties) {
      this.initializeProperties(window.gameData.properties);
    }
    this.updateControlsVisibility();
  }

  private initializeEventListeners() {
    const rollDiceButton = document.getElementById('roll-dice');
    const endTurnButton = document.getElementById('end-turn');
    const resetBalanceButton = document.getElementById('reset-balance');

    if (rollDiceButton) {
      rollDiceButton.addEventListener('click', () => this.handleRollDice());
    }

    if (endTurnButton) {
      endTurnButton.addEventListener('click', () => this.handleEndTurn());
    }

    if (resetBalanceButton) {
      resetBalanceButton.addEventListener('click', () => this.handleResetBalance());
    }
  }

  private initializePlayerPositions() {
    // Place all players' tokens on their current positions
    this.players.forEach((player, index) => {
      this.board.updatePlayerPosition(player.user_id, player.position, index);
    });
  }

  private updateControlsVisibility() {
    const rollDiceButton = document.getElementById('roll-dice') as HTMLButtonElement;
    const endTurnButton = document.getElementById('end-turn') as HTMLButtonElement;
    
    if (rollDiceButton && endTurnButton) {
      rollDiceButton.disabled = !this.isMyTurn;
      endTurnButton.disabled = !this.isMyTurn;
    }
  }

  private handleRollDice() {
    if (!this.isMyTurn) return;

    // Generate two random numbers between 1 and 6
    const dice1 = Math.floor(Math.random() * 6) + 1;
    const dice2 = Math.floor(Math.random() * 6) + 1;
    const total = dice1 + dice2;

    // Show dice result
    const diceResult = document.getElementById('dice-result');
    const diceValues = document.getElementById('dice-values');
    const diceTotal = document.getElementById('dice-total');
    
    if (diceResult && diceValues && diceTotal) {
      diceValues.textContent = `${dice1} and ${dice2}`;
      diceTotal.textContent = total.toString();
      diceResult.style.display = 'block';
    }

    console.log(`Rolled: ${dice1} and ${dice2} (Total: ${total})`);

    // Find current player
    const currentPlayer = this.players.find(p => p.user_id === this.currentPlayerId);
    if (!currentPlayer) {
      console.error('Current player not found');
      return;
    }

    // Calculate new position
    const newPosition = (currentPlayer.position + total) % 40; // 40 spaces on board
    console.log(`Moving from ${currentPlayer.position} to ${newPosition}`);

    // Update player position
    currentPlayer.position = newPosition;

    // Update UI
    this.updatePlayerPositionDisplay(currentPlayer);
    
    // Get player index for token color
    const playerIndex = this.players.findIndex(p => p.user_id === currentPlayer.user_id);
    
    // Wait for movement animation to complete before checking property
    this.board.updatePlayerPosition(currentPlayer.user_id, newPosition, playerIndex)
      .then(() => {
        // Check if landed on property
        const landedSpace = BOARD_SPACES.find((space: BoardSpace) => space.position === newPosition);
        if (landedSpace && landedSpace.type === 'property' && landedSpace.price) {
          this.handlePropertyLanding(landedSpace);
        }
      });

    // Disable roll button after rolling
    const rollButton = document.getElementById('roll-dice') as HTMLButtonElement;
    if (rollButton) {
      rollButton.disabled = true;
    }
  }

  private async handlePropertyLanding(space: BoardSpace) {
    const currentPlayer = this.players.find(p => p.user_id === this.currentPlayerId);
    const ownedProperty = window.gameData.properties.find(p => p.position === space.position);

    if (!currentPlayer) {
      console.error('Current player not found');
      return;
    }

    if (!space.price) {
      console.error('Invalid property: no price defined');
      return;
    }

    if (ownedProperty) {
      if (ownedProperty.owner_id !== this.currentPlayerId) {
        const propertyOwner = this.players.find(p => p.id === ownedProperty.owner_id);
        const propertyData = BOARD_SPACES.find(b => b.position === ownedProperty.position);
        alert(`Paid ${propertyOwner?.username} $${propertyData?.rent?.[0]} in rent`);
      }
    } else if (currentPlayer.balance >= space.price) {
      const wantsToBuy = confirm(
        `Would you like to buy ${space.name} for $${space.price}?`
      );

      if (wantsToBuy) {
        try {
          const response = await fetch(`/game/${window.gameData.gameId}/properties/${space.position}/buy`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            }
          });

          const data = await response.json();

          if (!response.ok) {
            const errorData = data as ApiError;
            throw new Error(errorData.error || 'Failed to purchase property');
          }

          const purchaseData = data as PurchaseResponse;
          
          // Update player's balance
          currentPlayer.balance = purchaseData.playerBalance;
          this.updatePlayerBalanceDisplay(currentPlayer);

          // Update property ownership display
          this.updatePropertyOwnership(purchaseData.property);

          console.log(`Successfully bought ${space.name} for $${space.price}`);
        } catch (error) {
          console.error('Purchase error:', error);
          alert('Failed to purchase property: ' + (error instanceof Error ? error.message : 'Unknown error'));
        }
      }
    } else {
      alert("You don't have enough money to buy this property!");
    }
  }

  private updatePropertyOwnership(property: PurchaseResponse['property']) {
    const playerIndex = this.players.findIndex(p => p.id === property.owner_id);
    if (playerIndex === -1) {
      console.error('Property owner not found in players list');
      return;
    }

    this.board.updatePropertyOwnership(property, playerIndex);
  }

  // Initialize existing properties on game load
  private initializeProperties(properties: PurchaseResponse['property'][]) {
    properties.forEach(property => {
      this.updatePropertyOwnership(property);
    });
  }

  private handleEndTurn() {
    if (!this.isMyTurn) return;
    
    console.log('Turn ended');
    
    // Move to next player
    this.currentPlayerIndex = (this.currentPlayerIndex + 1) % this.players.length;
    this.isMyTurn = this.players[this.currentPlayerIndex].user_id === this.currentPlayerId;
    
    // Update UI controls
    this.updateControlsVisibility();
    
    // TODO: Add server communication to end turn
  }

  private updatePlayerPositionDisplay(player: Player) {
    // Update position display in player list
    const playerCard = document.querySelector(`.player-card[data-player-id="${player.user_id}"]`);
    if (playerCard) {
      const positionElement = playerCard.querySelector('.position');
      if (positionElement) {
        positionElement.textContent = `Position: ${player.position}`;
      }
    }
  }

  private updatePlayerBalanceDisplay(player: Player) {
    // Update balance display in player list
    const playerCard = document.querySelector(`.player-card[data-player-id="${player.user_id}"]`);
    if (playerCard) {
      const balanceElement = playerCard.querySelector('.balance');
      if (balanceElement) {
        balanceElement.textContent = `Balance: $${player.balance}`;
      }
    }
  }

  private async handleResetBalance() {
    try {
      const response = await fetch(`/game/${window.gameData.gameId}/reset-balance`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const error = await response.json() as ApiError;
        throw new Error(error.error || 'Failed to reset balance');
      }

      const data = await response.json();
      
      // Update the current player's balance
      const currentPlayer = this.players.find(p => p.user_id === this.currentPlayerId);
      if (currentPlayer) {
        currentPlayer.balance = data.balance;
        this.updatePlayerBalanceDisplay(currentPlayer);
      }

      console.log('Balance reset successfully');
    } catch (error) {
      console.error('Reset balance error:', error);
      alert('Failed to reset balance: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  }
}

// Initialize game when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  try {
    console.log('Initializing game...');
    new GameService();
    console.log('Game initialized successfully');
  } catch (error) {
    console.error('Error initializing game:', error);
  }
}); 