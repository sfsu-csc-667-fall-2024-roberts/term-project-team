import { GameData, Player, Property, GameState } from './types';
import MonopolyBoard from './board';

interface RollResponse {
  roll: number;
  gameState: GameState;
  newPosition?: number;
}

interface BotActionResponse {
  action: string;
  success: boolean;
  message: string;
  gameState: GameState;
}

class GameService {
  private gameData: GameData;
  private messageContainer: HTMLElement;
  private board: MonopolyBoard;
  private isProcessingBotTurn: boolean = false;
  private statusElement: HTMLElement;
  private playersElement: HTMLElement;

  constructor(gameData: GameData) {
    this.gameData = gameData;
    this.messageContainer = document.querySelector('.game-messages') as HTMLElement;
    this.statusElement = document.querySelector('.game-status') as HTMLElement;
    this.playersElement = document.querySelector('.players-list') as HTMLElement;
    this.board = new MonopolyBoard('monopoly-board');
    this.initializeEventListeners();
    this.initializeBoard();
    this.updateGameStatus();
    this.checkForBotTurn();
  }

  private initializeEventListeners(): void {
    const rollDiceButton = document.getElementById('roll-dice');
    const endTurnButton = document.getElementById('end-turn');
    
    if (rollDiceButton) {
      rollDiceButton.addEventListener('click', () => this.rollDice());
    }
    
    if (endTurnButton) {
      endTurnButton.addEventListener('click', () => this.endTurn());
    }
  }

  private initializeBoard(): void {
    // Initialize player positions
    this.gameData.players.forEach((player: Player, index: number) => {
      this.board.updatePlayerPosition(player.id, player.position, index);
    });

    // Initialize property ownership
    if (this.gameData.gameState.phase === 'playing') {
      this.gameData.properties.forEach((property: Property) => {
        if (property.owner_id) {
          const ownerIndex = this.gameData.players.findIndex((p: Player) => p.id === property.owner_id);
          if (ownerIndex !== -1) {
            this.board.updatePropertyOwnership(property, ownerIndex);
          }
        }
      });
    }
  }

  private async rollDice(): Promise<void> {
    const rollDiceButton = document.getElementById('roll-dice') as HTMLButtonElement;
    const endTurnButton = document.getElementById('end-turn') as HTMLButtonElement;
    
    if (rollDiceButton) rollDiceButton.disabled = true;

    try {
      const response = await fetch(`/game/${this.gameData.gameId}/roll`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const error = await response.json();
        this.showMessage(error.error || 'Failed to roll dice');
        if (rollDiceButton) rollDiceButton.disabled = false;
        return;
      }

      const data: RollResponse = await response.json();
      
      // Show roll result with delay
      await this.showMessageWithDelay(`You rolled a ${data.roll}!`, 0);

      if (data.gameState.phase === 'waiting') {
        await this.handleInitialRollPhase(data);
      } else {
        await this.handleGameplayRoll(data);
        if (endTurnButton) endTurnButton.disabled = false;
      }
    } catch (error) {
      console.error('Roll error:', error);
      this.showMessage('Failed to roll dice');
      if (rollDiceButton) rollDiceButton.disabled = false;
    }
  }

  private async handleInitialRollPhase(data: RollResponse): Promise<void> {
    await this.showMessageWithDelay(`Initial roll for turn order: ${data.roll}`, 1000);
    
    const currentPlayer = this.gameData.players.find((p: Player) => p.user_id === this.gameData.currentUserId);
    if (!currentPlayer) return;

    // Update game state
    this.gameData.gameState = data.gameState;

    // Check if current player has already rolled
    const hasCurrentPlayerRolled = data.gameState.dice_rolls.some(
      (roll: { playerId: number; roll: number }) => roll.playerId === currentPlayer.id
    );

    // Re-enable roll button if player hasn't rolled yet
    const rollDiceButton = document.getElementById('roll-dice') as HTMLButtonElement;
    if (rollDiceButton) {
      rollDiceButton.disabled = hasCurrentPlayerRolled;
    }

    // If current player just rolled, trigger bot rolls
    if (hasCurrentPlayerRolled) {
      // After human rolls, trigger bot rolls with delays
      const botPlayers = this.gameData.players.filter((p: Player) => p.is_bot);
      for (const bot of botPlayers) {
        if (!data.gameState.dice_rolls.find((r: { playerId: number; roll: number }) => r.playerId === bot.id)) {
          await new Promise(resolve => setTimeout(resolve, 1500));
          await this.rollForBot(bot.id);
        }
      }

      // Check if all players have rolled
      if (data.gameState.dice_rolls.length === this.gameData.players.length) {
        await this.showMessageWithDelay('Determining turn order...', 1000);
        this.showTurnOrder(data.gameState);
        setTimeout(() => window.location.reload(), 3000);
      }
    }

    // Update the status message
    this.updateGameStatus();
  }

  private async handleGameplayRoll(data: RollResponse): Promise<void> {
    const player = this.gameData.players.find((p: Player) => p.id === this.gameData.currentPlayerId);
    if (player && typeof data.newPosition === 'number') {
      await new Promise(resolve => setTimeout(resolve, 1000));
      await this.updatePlayerPosition(player, data.newPosition);
      this.gameData.gameState = data.gameState;
      
      await this.updateGameStatus();
      await this.updatePlayersStatus();
      
      const nextPlayer = this.getNextPlayer();
      if (nextPlayer?.is_bot) {
        await new Promise(resolve => setTimeout(resolve, 1500));
        await this.processBotTurn(nextPlayer);
      }
    }
  }

  private async updatePlayerPosition(player: Player, newPosition: number): Promise<void> {
    player.position = newPosition;
    const playerIndex = this.gameData.players.findIndex((p: Player) => p.id === player.id);
    await this.board.updatePlayerPosition(player.id, newPosition, playerIndex);
    await this.updatePlayersStatus();
  }

  private async showMessageWithDelay(message: string, delay: number): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, delay));
    this.showMessage(message);
  }

  private updateGameStatus(): void {
    if (!this.statusElement) return;
    
    const currentPlayer = this.getNextPlayer();
    let statusText = '';
    
    if (this.gameData.gameState.phase === 'waiting') {
      statusText = 'Initial Roll Phase - Roll to determine turn order';
    } else {
      statusText = `${currentPlayer?.username}'s Turn - `;
      if (this.gameData.currentPlayerId === this.gameData.currentUserId) {
        statusText += 'Your turn to roll!';
      } else {
        statusText += 'Waiting for player to take their turn...';
      }
    }
    
    this.statusElement.textContent = statusText;
  }

  private updatePlayersStatus(): void {
    if (!this.playersElement) return;
    
    const playerElements = this.playersElement.querySelectorAll('.player-info');
    playerElements.forEach((element: Element) => {
      const playerId = element.getAttribute('data-player-id');
      const player = this.gameData.players.find(p => p.id.toString() === playerId);
      if (player) {
        const statusElement = element.querySelector('.player-status');
        if (statusElement) {
          if (player.id === this.gameData.currentPlayerId) {
            statusElement.textContent = 'Current turn';
          } else {
            statusElement.textContent = 'Waiting for turn...';
          }
        }
      }
    });
  }

  private async processBotTurn(bot: Player): Promise<void> {
    if (this.isProcessingBotTurn) return;
    this.isProcessingBotTurn = true;

    try {
      // Roll dice
      await new Promise(resolve => setTimeout(resolve, 1000));
      await this.rollForBot(bot.id);

      // Make property decisions
      await new Promise(resolve => setTimeout(resolve, 1000));
      await this.makeBotDecisions(bot);

      // End turn
      await new Promise(resolve => setTimeout(resolve, 1000));
      await this.endBotTurn(bot);
    } finally {
      this.isProcessingBotTurn = false;
    }
  }

  private async makeBotDecisions(bot: Player): Promise<void> {
    try {
      const response = await fetch(`/game/${this.gameData.gameId}/bot/${bot.id}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      if (!response.ok) {
        throw new Error('Failed to process bot action');
      }

      const data: BotActionResponse = await response.json();
      this.showMessage(`${bot.username} ${data.message}`);
      
      if (data.gameState) {
        this.gameData.gameState = data.gameState;
        this.updateBoard();
      }
    } catch (error) {
      console.error('Bot decision error:', error);
      this.showMessage(`${bot.username} encountered an error`);
    }
  }

  private async endBotTurn(bot: Player): Promise<void> {
    try {
      const response = await fetch(`/game/${this.gameData.gameId}/end-turn`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerId: bot.id })
      });

      if (!response.ok) {
        throw new Error('Failed to end bot turn');
      }

      const data = await response.json();
      this.gameData.gameState = data.gameState;
      this.updateBoard();

      // Process next bot if it's their turn
      const nextPlayer = this.getNextPlayer();
      if (nextPlayer?.is_bot) {
        await this.processBotTurn(nextPlayer);
      }
    } catch (error) {
      console.error('End bot turn error:', error);
    }
  }

  private async rollForBot(botId: number): Promise<void> {
    try {
      const response = await fetch(`/game/${this.gameData.gameId}/roll`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ botId })
      });

      if (!response.ok) {
        const error = await response.json();
        this.showMessage(error.error || 'Failed to roll for bot');
        return;
      }

      const data: RollResponse = await response.json();
      const bot = this.gameData.players.find((p: Player) => p.id === botId);
      this.showMessage(`${bot?.username || 'Bot'} rolled a ${data.roll}!`);

      if (data.gameState.phase === 'playing' && typeof data.newPosition === 'number') {
        const playerIndex = this.gameData.players.findIndex((p: Player) => p.id === botId);
        await this.board.updatePlayerPosition(botId, data.newPosition, playerIndex);
      }
    } catch (error) {
      console.error('Bot roll error:', error);
      this.showMessage('Failed to roll for bot');
    }
  }

  private showMessage(message: string): void {
    const messageElement = document.createElement('div');
    messageElement.className = 'game-message';
    messageElement.textContent = message;
    this.messageContainer.appendChild(messageElement);

    setTimeout(() => {
      messageElement.remove();
    }, 5000);
  }

  private showTurnOrder(gameState: GameState): void {
    const turnOrder = gameState.turn_order
      .map((playerId: number) => this.gameData.players.find((p: Player) => p.id === playerId)?.username)
      .filter(Boolean)
      .join(' → ');
    
    this.showMessage(`Turn order: ${turnOrder}`);
  }

  private getNextPlayer(): Player | undefined {
    return this.gameData.players.find((p: Player) => 
      p.id === this.gameData.gameState.turn_order[this.gameData.gameState.current_player_index]
    );
  }

  private updateBoard(): void {
    // Update player positions
    this.gameData.players.forEach((player: Player, index: number) => {
      this.board.updatePlayerPosition(player.id, player.position, index);
    });

    // Update property ownership
    this.gameData.properties.forEach((property: Property) => {
      if (property.owner_id) {
        const ownerIndex = this.gameData.players.findIndex((p: Player) => p.id === property.owner_id);
        if (ownerIndex !== -1) {
          this.board.updatePropertyOwnership(property, ownerIndex);
        }
      }
    });
  }

  private checkForBotTurn(): void {
    const currentPlayer = this.getNextPlayer();
    if (currentPlayer?.is_bot) {
      setTimeout(() => this.processBotTurn(currentPlayer), 1000);
    }
  }

  private async endTurn(): Promise<void> {
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
      this.gameData.gameState = data.gameState;
      this.updateBoard();

      // Process next bot if it's their turn
      const nextPlayer = this.getNextPlayer();
      if (nextPlayer?.is_bot) {
        await this.processBotTurn(nextPlayer);
      }
    } catch (error) {
      console.error('End turn error:', error);
      this.showMessage('Failed to end turn');
    }
  }
}

// Initialize game service when the page loads
document.addEventListener('DOMContentLoaded', () => {
  new GameService(window.gameData);
}); 