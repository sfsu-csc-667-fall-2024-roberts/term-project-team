import { GameData, Player, Property, GameState, PlayerWithRoll, RollResponse } from '../../shared/types';
import MonopolyBoard from './board';

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
    this.gameData.players.forEach((player: Player, index: number) => {
      this.board.updatePlayerPosition(player.id, player.position, index);
    });

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
    console.log('=== Roll Dice Started ===');
    const rollDiceButton = document.getElementById('roll-dice') as HTMLButtonElement;
    const endTurnButton = document.getElementById('end-turn') as HTMLButtonElement;
    
    if (rollDiceButton) {
      rollDiceButton.disabled = true;
      console.log('Roll button disabled');
    }

    try {
      console.log('Sending roll request to server...');
      const response = await fetch(`/game/${this.gameData.gameId}/roll`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
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
      
      // Show roll result immediately
      this.showMessage(`You rolled a ${data.roll}!`);

      if (data.gameState.phase === 'waiting') {
        console.log('Handling initial roll phase');
        await this.handleInitialRollPhase(data);
      } else {
        console.log('Handling gameplay roll');
        // Update local game state
        this.gameData.gameState = data.gameState;
        console.log('Updated game state:', this.gameData.gameState);
        
        // Update player position if provided
        if (typeof data.newPosition === 'number') {
          console.log('Updating player position to:', data.newPosition);
          const currentPlayer = this.gameData.players.find(p => p.id === this.gameData.currentPlayerId);
          if (currentPlayer) {
            console.log('Current player found:', currentPlayer);
            currentPlayer.position = data.newPosition;
            
            // Update player data if provided in response
            if (data.currentPlayer) {
              console.log('Updating current player data:', data.currentPlayer);
              Object.assign(currentPlayer, data.currentPlayer);
            }
            
            // Update all players if provided
            if (data.players) {
              console.log('Updating all players:', data.players);
              this.gameData.players = data.players;
            }
            
            // Update board visually
            const playerIndex = this.gameData.players.findIndex(p => p.id === currentPlayer.id);
            console.log('Updating board for player index:', playerIndex);
            await this.board.updatePlayerPosition(currentPlayer.id, data.newPosition, playerIndex);
          } else {
            console.error('Current player not found in game data');
          }
        }
        
        // Update UI
        console.log('Updating game status and players');
        await this.updateGameStatus();
        await this.updatePlayersStatus();
        
        // Enable end turn button
        if (endTurnButton) {
          console.log('Enabling end turn button');
          endTurnButton.disabled = false;
        }
        
        // Process bot turn if next player is a bot
        const nextPlayer = this.getNextPlayer();
        if (nextPlayer?.is_bot) {
          console.log('Next player is bot, processing bot turn:', nextPlayer);
          await new Promise(resolve => setTimeout(resolve, 1500));
          await this.processBotTurn(nextPlayer);
        }
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
      gameState: {
        phase: data.gameState.phase,
        diceRolls: data.gameState.dice_rolls,
        turnOrder: data.gameState.turn_order,
        currentPlayerIndex: data.gameState.current_player_index
      },
      players: data.players?.map(p => ({
        id: p.id,
        username: p.username,
        isBot: p.is_bot,
        position: p.position
      }))
    });
    
    // Update game state
    this.gameData.gameState = data.gameState;
    
    // Update all players if provided
    if (data.players) {
      this.gameData.players = data.players;
    }

    // Show initial roll message
    await this.showMessageWithDelay(`You rolled a ${data.roll} for turn order!`, 1000);

    // If current player just rolled, trigger bot rolls
    const currentPlayer = this.gameData.players.find(p => p.user_id === this.gameData.currentUserId);
    if (!currentPlayer) {
      console.error('Current player not found');
      return;
    }

    // Check if current player has already rolled
    const hasCurrentPlayerRolled = this.gameData.gameState.dice_rolls.some(r => r.playerId === currentPlayer.id);
    console.log('Roll status:', {
      currentPlayer: currentPlayer.username,
      hasRolled: hasCurrentPlayerRolled,
      allRolls: this.gameData.gameState.dice_rolls
    });

    // If current player just rolled, trigger bot rolls
    if (hasCurrentPlayerRolled) {
      console.log('Processing bot rolls');
      const botPlayers = this.gameData.players.filter(p => p.is_bot);
      console.log('Bot players:', botPlayers.map(p => ({
        id: p.id,
        username: p.username,
        hasRolled: this.gameData.gameState.dice_rolls.some(r => r.playerId === p.id)
      })));
      
      // Roll for each bot
      for (const bot of botPlayers) {
        await new Promise(resolve => setTimeout(resolve, 1500));
        await this.rollForBot(bot.id);
      }

      // Check if all players have rolled
      const allPlayersRolled = this.gameData.gameState.dice_rolls.length === this.gameData.players.length;
      console.log('Roll completion check:', {
        rollCount: this.gameData.gameState.dice_rolls.length,
        playerCount: this.gameData.players.length,
        allRolled: allPlayersRolled,
        rolls: this.gameData.gameState.dice_rolls
      });

      if (allPlayersRolled) {
        console.log('All players have rolled, transitioning to playing phase');
        await this.showMessageWithDelay('Determining turn order...', 1000);
        this.showTurnOrder(this.gameData.gameState);
        
        console.log('Game state before refresh:', {
          phase: this.gameData.gameState.phase,
          turnOrder: this.gameData.gameState.turn_order,
          currentPlayerIndex: this.gameData.gameState.current_player_index
        });
        
        console.log('Refreshing page in 3 seconds...');
        setTimeout(() => window.location.reload(), 3000);
      }
    }

    // Update UI
    console.log('Updating UI components');
    this.updateGameStatus();
    this.updatePlayersStatus();
    console.log('=== Initial Roll Phase Completed ===\n');
  }

  private async handleGameplayRoll(data: RollResponse): Promise<void> {
    console.log('Handling gameplay roll:', data);
    const player = this.gameData.players.find((p: Player) => p.id === this.gameData.currentPlayerId);
    
    if (player && typeof data.newPosition === 'number') {
      // Update player position in local data
      player.position = data.newPosition;
      
      // Update game state
      this.gameData.gameState = data.gameState;
      
      // Update board visually
      const playerIndex = this.gameData.players.findIndex((p: Player) => p.id === player.id);
      await this.board.updatePlayerPosition(player.id, data.newPosition, playerIndex);
      
      // Update UI elements
      await this.updateGameStatus();
      await this.updatePlayersStatus();
      
      // Update buttons state
      const rollDiceButton = document.getElementById('roll-dice') as HTMLButtonElement;
      const endTurnButton = document.getElementById('end-turn') as HTMLButtonElement;
      
      if (rollDiceButton) rollDiceButton.disabled = true;
      if (endTurnButton) endTurnButton.disabled = false;
      
      // Process next player if it's a bot
      const nextPlayer = this.getNextPlayer();
      if (nextPlayer?.is_bot) {
        await new Promise(resolve => setTimeout(resolve, 1500));
        await this.processBotTurn(nextPlayer);
      }
    } else {
      console.error('Invalid player or position data:', { player, newPosition: data.newPosition });
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
    console.log('=== Updating Game Status ===');
    if (!this.statusElement) {
      console.error('Status element not found');
      return;
    }
    
    let currentPlayer: Player | undefined;
    
    if (this.gameData.gameState.phase === 'waiting') {
      // In waiting phase, current player is the one who hasn't rolled yet
      currentPlayer = this.gameData.players.find(p => 
        !this.gameData.gameState.dice_rolls.some(r => r.playerId === p.id) &&
        p.id === this.gameData.currentPlayerId
      );
    } else {
      currentPlayer = this.getNextPlayer();
    }
    
    console.log('Current game state:', {
      phase: this.gameData.gameState.phase,
      currentPlayerIndex: this.gameData.gameState.current_player_index,
      turnOrder: this.gameData.gameState.turn_order,
      diceRolls: this.gameData.gameState.dice_rolls
    });
    
    console.log('Current player:', currentPlayer ? {
      id: currentPlayer.id,
      username: currentPlayer.username,
      isBot: currentPlayer.is_bot,
      position: currentPlayer.position
    } : 'undefined');

    if (currentPlayer) {
      this.board.setCurrentPlayer(currentPlayer.id);
    }
    
    let statusText = '';
    
    if (this.gameData.gameState.phase === 'waiting') {
      const rollCount = this.gameData.gameState.dice_rolls.length;
      const totalPlayers = this.gameData.players.length;
      statusText = `Initial Roll Phase - Roll to determine turn order (${rollCount}/${totalPlayers} players rolled)`;
      console.log('Waiting phase status:', { rollCount, totalPlayers });
    } else {
      statusText = currentPlayer ? 
        `${currentPlayer.username}'s Turn${currentPlayer.id === this.gameData.currentPlayerId ? ' - Your turn!' : ''}` :
        'Waiting for next turn...';
      console.log('Playing phase status:', {
        currentPlayerUsername: currentPlayer?.username,
        isCurrentUser: currentPlayer?.id === this.gameData.currentPlayerId
      });
    }

    console.log('Setting status text:', statusText);
    this.statusElement.textContent = statusText;

    // Update button states
    const rollButton = document.getElementById('roll-dice') as HTMLButtonElement;
    const endTurnButton = document.getElementById('end-turn') as HTMLButtonElement;
    
    if (rollButton) {
      const canRoll = this.canPlayerRoll(currentPlayer);
      rollButton.disabled = !canRoll;
      console.log('Roll button state:', { 
        disabled: !canRoll, 
        reason: canRoll ? 'allowed to roll' : 'not allowed to roll',
        currentPlayer: currentPlayer?.username
      });
    }
    
    if (endTurnButton) {
      const canEndTurn = this.canPlayerEndTurn(currentPlayer);
      endTurnButton.disabled = !canEndTurn;
      console.log('End turn button state:', {
        disabled: !canEndTurn,
        reason: canEndTurn ? 'can end turn' : 'cannot end turn yet',
        currentPlayer: currentPlayer?.username
      });
    }
  }

  private canPlayerRoll(currentPlayer: Player | undefined): boolean {
    if (!currentPlayer) return false;
    
    if (this.gameData.gameState.phase === 'waiting') {
      // In waiting phase, player can roll if they haven't rolled yet
      const hasRolled = this.gameData.gameState.dice_rolls.some(r => r.playerId === currentPlayer.id);
      const isCurrentUser = currentPlayer.id === this.gameData.currentPlayerId;
      console.log('Can roll check (waiting phase):', { hasRolled, isCurrentUser });
      return !hasRolled && isCurrentUser;
    }
    
    // In playing phase, current player can roll if it's their turn
    const isCurrentTurn = currentPlayer.id === this.gameData.gameState.turn_order[this.gameData.gameState.current_player_index];
    const isCurrentUser = currentPlayer.id === this.gameData.currentPlayerId;
    console.log('Can roll check (playing phase):', { isCurrentTurn, isCurrentUser });
    return isCurrentTurn && isCurrentUser;
  }

  private canPlayerEndTurn(currentPlayer: Player | undefined): boolean {
    if (!currentPlayer) return false;
    
    if (this.gameData.gameState.phase === 'waiting') {
      return false; // Can't end turn during waiting phase
    }
    
    const isCurrentTurn = currentPlayer.id === this.gameData.gameState.turn_order[this.gameData.gameState.current_player_index];
    const isCurrentUser = currentPlayer.id === this.gameData.currentPlayerId;
    console.log('Can end turn check:', { isCurrentTurn, isCurrentUser });
    return isCurrentTurn && isCurrentUser;
  }

  private updatePlayersStatus(): void {
    console.log('=== Updating Players Status ===');
    if (!this.playersElement) {
      console.error('Players element not found');
      return;
    }
    
    this.gameData.players.forEach((p: Player) => {
      console.log('Updating player:', p);
      const playerElement = this.playersElement.querySelector(`[data-player-id="${p.id}"]`);
      if (!playerElement) {
        console.error('Player element not found for player:', p);
        return;
      }

      // Update balance
      const balanceElement = playerElement.querySelector('.balance');
      if (balanceElement) {
        balanceElement.textContent = `Balance: $${p.balance}`;
      }

      // Update position
      const positionElement = playerElement.querySelector('.position');
      if (positionElement) {
        positionElement.textContent = `Position: ${p.position}`;
      }

      // Update roll status
      const statusElement = playerElement.querySelector('.roll-status');
      if (statusElement) {
        if (this.gameData.gameState.phase === 'waiting') {
          const roll = this.gameData.gameState.dice_rolls.find(r => r.playerId === p.id);
          statusElement.textContent = roll ? `Initial Roll: ${roll.roll}` : 'Waiting for roll...';
        } else {
          statusElement.textContent = p.id === this.gameData.currentPlayerId ? 
            'Current turn' : 'Waiting for turn...';
        }
      }
    });
  }

  private async processBotTurn(bot: Player): Promise<void> {
    console.log('=== Processing Bot Turn Started ===');
    console.log('Bot:', bot);

    if (this.isProcessingBotTurn) {
      console.log('Already processing a bot turn, skipping');
      return;
    }
    
    this.isProcessingBotTurn = true;

    try {
      // Roll dice
      console.log('Rolling for bot...');
      await new Promise(resolve => setTimeout(resolve, 1000));
      await this.rollForBot(bot.id);

      // Make property decisions
      console.log('Making bot decisions...');
      await new Promise(resolve => setTimeout(resolve, 1000));
      await this.makeBotDecisions(bot);

      // End turn
      console.log('Ending bot turn...');
      await new Promise(resolve => setTimeout(resolve, 1000));
      await this.endBotTurn(bot);
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
      
      this.gameData.gameState = data.gameState;
      if (data.players) {
        this.gameData.players = data.players;
      }
      
      this.updateBoard();
      this.updateGameStatus();
      this.updatePlayersStatus();

      // Process next bot if it's their turn
      const nextPlayer = this.getNextPlayer();
      console.log('Next player after bot turn:', nextPlayer);
      
      if (nextPlayer?.is_bot) {
        console.log('Next player is also a bot, processing their turn...');
        await new Promise(resolve => setTimeout(resolve, 1000));
        await this.processBotTurn(nextPlayer);
      }
    } catch (error) {
      console.error('End bot turn error:', error);
      this.showMessage(`Failed to end ${bot.username}'s turn`);
    } finally {
      console.log('=== Ending Bot Turn Completed ===');
    }
  }

  private async rollForBot(botId: number): Promise<void> {
    console.log('\n=== Rolling for Bot Started ===');
    console.log('Bot ID:', botId);
    
    // Get bot player
    const bot = this.gameData.players.find(p => p.id === botId);
    if (!bot) {
      console.error('Bot not found:', {
        botId,
        availablePlayers: this.gameData.players.map(p => ({
          id: p.id,
          username: p.username,
          isBot: p.is_bot
        }))
      });
      return;
    }

    console.log('Found bot player:', {
      id: bot.id,
      username: bot.username,
      isBot: bot.is_bot,
      position: bot.position,
      currentRolls: this.gameData.gameState.dice_rolls
    });

    try {
      // Get game ID from URL
      const pathParts = window.location.pathname.split('/');
      console.log('URL path parts:', pathParts);
      const gameId = pathParts[pathParts.length - 1];
      
      if (!gameId) {
        throw new Error('Could not determine game ID from URL');
      }
      console.log('Using game ID from URL:', gameId);

      // Send roll request
      const requestBody = JSON.stringify({ botId: botId.toString() });
      const rollUrl = `/game/${gameId}/roll`;
      console.log('Preparing bot roll request:', {
        url: rollUrl,
        method: 'POST',
        body: requestBody,
        currentGameState: this.gameData.gameState
      });

      const response = await fetch(rollUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: requestBody
      });

      console.log('Bot roll response status:', {
        status: response.status,
        statusText: response.statusText
      });

      const data = await response.json();
      console.log('Bot roll response data:', data);

      if (!response.ok) {
        console.error('Bot roll failed:', {
          status: response.status,
          statusText: response.statusText,
          error: data.error,
          bot: bot.username
        });
        throw new Error(data.error || 'Failed to roll for bot');
      }

      // Update game state
      console.log('Updating game state:', {
        oldState: this.gameData.gameState,
        newState: data.gameState
      });
      this.gameData.gameState = data.gameState;

      if (data.players) {
        console.log('Updating players:', {
          oldPlayers: this.gameData.players,
          newPlayers: data.players
        });
        this.gameData.players = data.players;
      }

      // Show roll message
      const rollMessage = `${bot.username} rolled a ${data.roll}!`;
      console.log('Showing roll message:', rollMessage);
      await this.showMessageWithDelay(rollMessage, 1000);

      // Update UI
      console.log('Updating UI components');
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
      // Get game ID from URL to ensure we're using the correct one
      const gameId = window.location.pathname.split('/').pop();
      if (!gameId) {
        throw new Error('Could not determine game ID from URL');
      }

      const stateUrl = `/game/${gameId}/state`;
      console.log('Fetching game state from:', stateUrl);
      
      const response = await fetch(stateUrl, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (!response.ok) {
        console.error('Failed to get latest game state:', response.status, response.statusText);
        return false;
      }
      
      const data = await response.json();
      console.log('Game state received:', data);
      
      if (data.gameState) {
        this.gameData.gameState = data.gameState;
      }
      if (data.players) {
        this.gameData.players = data.players;
      }
      return true;
    } catch (error) {
      console.error('Failed to get game state:', error);
      return false;
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
    console.log('=== Updating Board ===');
    // Update player positions
    this.gameData.players.forEach((player: Player, index: number) => {
      console.log('Updating position for player:', {
        id: player.id,
        username: player.username,
        position: player.position,
        index
      });
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
    console.log('=== Board Update Complete ===');
  }

  private checkForBotTurn(): void {
    const currentPlayer = this.getNextPlayer();
    if (currentPlayer?.is_bot) {
      setTimeout(() => this.processBotTurn(currentPlayer), 1000);
    }
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

      // Get next player
      const nextPlayer = this.getNextPlayer();
      console.log('Next player:', nextPlayer);

      // If next player is a bot, process their turn after a short delay
      if (nextPlayer?.is_bot) {
        console.log('Next player is a bot, processing their turn...');
        await new Promise(resolve => setTimeout(resolve, 1000));
        await this.processBotTurn(nextPlayer);
      }

      console.log('=== End Turn Completed ===');
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