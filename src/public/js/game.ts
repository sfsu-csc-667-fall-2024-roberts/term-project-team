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

 export class GameService {
  private gameData: GameData;
  private static messageContainer: HTMLElement;
  private board: MonopolyBoard;
  private isProcessingBotTurn: boolean = false;

  constructor(gameData: GameData) {
    this.gameData = gameData;
    GameService.messageContainer = document.querySelector('.game-messages') as HTMLElement;
    this.board = new MonopolyBoard('monopoly-board');
    this.initializeEventListeners();
    this.initializeBoard();
    this.checkForBotTurn(); // Check if a bot should start
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
    try {
      const response = await fetch(`/game/${this.gameData.gameId}/roll`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const error = await response.json();
        GameService.showMessage(error.error || 'Failed to roll dice');
        return;
      }

      const data: RollResponse = await response.json();
      
      // Show roll result
      GameService.showMessage(`You rolled a ${data.roll}!`);

      if (data.gameState.phase === 'waiting') {
        await this.handleInitialRollPhase(data);
      } else {
        await this.handleGameplayRoll(data);
      }
    } catch (error) {
      console.error('Roll error:', error);
      GameService.showMessage('Failed to roll dice');
    }
  }

  private async handleInitialRollPhase(data: RollResponse): Promise<void> {
    GameService.showMessage(`Initial roll for turn order: ${data.roll}`);
    
    // Hide bot rolls until human player rolls
    const currentPlayer = this.gameData.players.find((p: Player) => p.user_id === this.gameData.currentUserId);
    if (!currentPlayer) return;

    const hasHumanRolled = data.gameState.dice_rolls.some((roll: { playerId: number; roll: number }) => 
      roll.playerId === currentPlayer.id
    );

    if (!hasHumanRolled) {
      return;
    }

    // After human rolls, trigger bot rolls
    const botPlayers = this.gameData.players.filter((p: Player) => p.is_bot);
    for (const bot of botPlayers) {
      if (!data.gameState.dice_rolls.find((r: { playerId: number; roll: number }) => r.playerId === bot.id)) {
        await this.rollForBot(bot.id);
      }
    }

    if (data.gameState.dice_rolls.length === this.gameData.players.length) {
      this.showTurnOrder(data.gameState);
      setTimeout(() => window.location.reload(), 2000);
    }
  }

  private async handleGameplayRoll(data: RollResponse): Promise<void> {
    const player = this.gameData.players.find((p: Player) => p.id === this.gameData.currentPlayerId);
    if (player && typeof data.newPosition === 'number') {
      await this.updatePlayerPosition(player, data.newPosition);
      this.gameData.gameState = data.gameState;

      this.board.showBuyOption(player, data.roll, async () => {
        // Update UI
        this.updateTurnUI();
        
        // If it's a bot's turn, process their actions
        const nextPlayer = this.getNextPlayer();
        if (nextPlayer?.is_bot) {
          await this.processBotTurn(nextPlayer);
        }
      })
    }
  }

  private async updatePlayerPosition(player: Player, newPosition: number): Promise<void> {
    player.position = newPosition;
    const playerIndex = this.gameData.players.findIndex((p: Player) => p.id === player.id);
    await this.board.updatePlayerPosition(player.id, newPosition, playerIndex);
  }

  private updateTurnUI(): void {
    const rollDiceButton = document.getElementById('roll-dice') as HTMLButtonElement;
    const endTurnButton = document.getElementById('end-turn') as HTMLButtonElement;
    
    if (rollDiceButton) rollDiceButton.disabled = true;
    if (endTurnButton) endTurnButton.disabled = false;
    
    const nextPlayer = this.getNextPlayer();
    if (nextPlayer) {
      GameService.showMessage(`It's ${nextPlayer.username}'s turn`);
    }
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
      GameService.showMessage(`${bot.username} ${data.message}`);
      
      if (data.gameState) {
        this.gameData.gameState = data.gameState;
        this.updateBoard();
      }
    } catch (error) {
      console.error('Bot decision error:', error);
      GameService.showMessage(`${bot.username} encountered an error`);
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
        GameService.showMessage(error.error || 'Failed to roll for bot');
        return;
      }

      const data: RollResponse = await response.json();
      const bot = this.gameData.players.find((p: Player) => p.id === botId);
      GameService.showMessage(`${bot?.username || 'Bot'} rolled a ${data.roll}!`);

      if (data.gameState.phase === 'playing' && typeof data.newPosition === 'number') {
        const playerIndex = this.gameData.players.findIndex((p: Player) => p.id === botId);
        await this.board.updatePlayerPosition(botId, data.newPosition, playerIndex);
      }
    } catch (error) {
      console.error('Bot roll error:', error);
      GameService.showMessage('Failed to roll for bot');
    }
  }

  public static showMessage(message: string): void {
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
    
    GameService.showMessage(`Turn order: ${turnOrder}`);
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
        GameService.showMessage(error.error || 'Failed to end turn');
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
      GameService.showMessage('Failed to end turn');
    }
  }
}

// Initialize game service when the page loads
document.addEventListener('DOMContentLoaded', () => {
  new GameService(window.gameData);
}); 