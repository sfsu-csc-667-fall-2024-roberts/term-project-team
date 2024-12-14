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

class GameService {
  private gameData: GameData;
  private messageContainer: HTMLElement;
  private board: MonopolyBoard;
  private isProcessingBotTurn: boolean = false;
  private statusElement: HTMLElement;
  private playersElement: HTMLElement;
  private static instance: GameService | null = null;

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
    
    GameService.instance = this;
  }

  private cleanup(): void {
    console.log('Cleaning up game service');
    // Remove event listeners
    const rollDiceButton = document.getElementById('roll-dice');
    const endTurnButton = document.getElementById('end-turn');
    
    if (rollDiceButton) {
      rollDiceButton.replaceWith(rollDiceButton.cloneNode(true));
    }
    
    if (endTurnButton) {
      endTurnButton.replaceWith(endTurnButton.cloneNode(true));
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

    if (this.gameData.gameState.phase === GAME_PHASES.PLAYING) {
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
        isBot: p.is_bot
      }))
    });
    
    // Update game state
    this.gameData.gameState = data.gameState;
    
    // Update all players if provided
    if (data.players) {
      this.gameData.players = data.players;
      console.log('Updated players list:', this.gameData.players.map(p => ({
        id: p.id,
        username: p.username,
        isBot: p.is_bot
      })));
    }

    // Count how many players have rolled
    const totalPlayers = this.gameData.players.length;
    const rolledPlayers = this.gameData.gameState.dice_rolls.length;
    const isFirstRoll = rolledPlayers === 1;
    const allPlayersRolled = rolledPlayers === totalPlayers;

    console.log('Roll status:', {
      totalPlayers,
      rolledPlayers,
      isFirstRoll,
      allPlayersRolled,
      diceRolls: this.gameData.gameState.dice_rolls
    });

    // Show roll result
    await this.showMessageWithDelay(`You rolled ${data.dice[0]} and ${data.dice[1]} (total: ${data.roll})!`, 1000);

    // Only show turn order determination when all players have rolled
    if (allPlayersRolled) {
      await this.showMessageWithDelay(`Determining turn order...`, 1500);
      
      // Sort players by their roll values and match with player names
      const rollResults = this.gameData.gameState.dice_rolls
        .map(roll => {
          const player = this.gameData.players.find(p => p.id === roll.id);
          if (!player) {
            console.error(`Could not find player for roll:`, { roll, players: this.gameData.players });
          }
          return {
            username: player?.username || 'Unknown',
            roll: roll.roll || 0,
            isBot: player?.is_bot || false
          };
        })
        .sort((a, b) => b.roll - a.roll);

      console.log('Turn order results:', rollResults);

      // Show final turn order
      await this.showMessageWithDelay(`Turn order:`, 1000);
      for (const result of rollResults) {
        const playerType = result.isBot ? '🤖' : '';
        await this.showMessageWithDelay(`${result.username}${playerType}: ${result.roll}`, 800);
      }
      await this.showMessageWithDelay(`Game starting...`, 1500);
    }

    // If current player just rolled, trigger bot rolls
    const currentPlayer = this.gameData.players.find(p => p.user_id === this.gameData.currentUserId);
    if (!currentPlayer) {
      console.error('Current player not found');
      return;
    }

    // Check if current player has already rolled
    const hasCurrentPlayerRolled = this.gameData.gameState.dice_rolls.some((r: PlayerWithRoll) => r.id === currentPlayer.id);
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
        hasRolled: this.gameData.gameState.dice_rolls.some((r: PlayerWithRoll) => r.id === p.id)
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
    console.log('\n=== Handling Gameplay Roll ===');
    console.log('Roll response data:', {
      roll: data.roll,
      dice: data.dice,
      isDoubles: data.isDoubles,
      newPosition: data.newPosition,
      spaceAction: data.spaceAction,
      currentPlayer: {
        id: data.currentPlayer?.id,
        username: data.currentPlayer?.username,
        balance: data.currentPlayer?.balance,
        position: data.currentPlayer?.position
      }
    });
    
    const player = this.gameData.players.find((p: Player) => p.id === this.gameData.currentPlayerId);
    if (!player) {
      console.error('Current player not found');
      return;
    }

    // Show roll result with movement details
    if (typeof player.position === 'number' && typeof data.newPosition === 'number') {
      const fromSpace = BOARD_SPACES[player.position];
      const toSpace = BOARD_SPACES[data.newPosition];
      const doublesText = data.isDoubles ? ' (Doubles!)' : '';
      await this.showMessageWithDelay(
        `${player.username} rolled ${data.dice[0]} and ${data.dice[1]} (total: ${data.roll})${doublesText}! Moving from ${fromSpace.name} to ${toSpace.name}`,
        1000
      );
    } else {
      await this.showMessageWithDelay(
        `${player.username} rolled ${data.dice[0]} and ${data.dice[1]} (total: ${data.roll})!`,
        1000
      );
    }

    if (player && typeof data.newPosition === 'number') {
      console.log('Updating player position:', { from: player.position, to: data.newPosition });
      
      // Update player position in local data
      player.position = data.newPosition;
      
      // Update game state
      this.gameData.gameState = data.gameState;
      
      // Update all players if provided
      if (data.players) {
        this.gameData.players = data.players;
        console.log('Updated players:', data.players.map(p => ({
          id: p.id,
          username: p.username,
          position: p.position,
          balance: p.balance
        })));
      }
      
      // Update board visually
      const playerIndex = this.gameData.players.findIndex((p: Player) => p.id === player.id);
      await this.board.updatePlayerPosition(player.id, data.newPosition, playerIndex);
      
      // Update game status
      await this.updateGameStatus();
      await this.updatePlayersStatus();

      // Handle space action if any
      if (data.spaceAction) {
        await this.handleSpaceAction(data.spaceAction, player);
      }

      // Enable end turn button
      const endTurnButton = document.getElementById('end-turn') as HTMLButtonElement;
      if (endTurnButton) {
        endTurnButton.disabled = false;
        console.log('End turn button enabled');
      }
    } else {
      console.error('Invalid player or position data:', { player, newPosition: data.newPosition });
    }
  }

  private async buyProperty(position: number): Promise<void> {
    try {
      const response = await fetch(`/game/${this.gameData.gameId}/property/buy`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ position })
      });

      if (!response.ok) {
        const error = await response.json();
        await this.showMessage(error.error || 'Failed to buy property');
        return;
      }

      const data = await response.json();
      if (data.success) {
        // Update game data
        this.gameData.players = data.players;
        this.gameData.properties = data.properties;

        // Update UI
        await this.updateBoard();
        await this.updateGameStatus();
        await this.updatePlayersStatus();

        // Show success message
        await this.showMessage(`Successfully purchased ${data.property.name}`);
      }
    } catch (error) {
      console.error('Buy property error:', error);
      await this.showMessage('Failed to buy property');
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
    
    if (this.gameData.gameState.phase === GAME_PHASES.WAITING) {
      // In waiting phase, current player is the one who hasn't rolled yet
      currentPlayer = this.gameData.players.find(p => 
        !this.gameData.gameState.dice_rolls.some(r => r.id === p.id) &&
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
    
    if (this.gameData.gameState.phase === GAME_PHASES.WAITING) {
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
    
    if (this.gameData.gameState.phase === GAME_PHASES.WAITING) {
      // In waiting phase, player can roll if they haven't rolled yet
      const hasRolled = this.gameData.gameState.dice_rolls.some(r => r.id === currentPlayer.id);
      const isCurrentUser = currentPlayer.id === this.gameData.currentPlayerId;
      console.log('Can roll check (waiting phase):', { hasRolled, isCurrentUser });
      return !hasRolled && isCurrentUser;
    }
    
    // In playing phase, current player can roll if it's their turn and hasn't rolled yet
    const isCurrentTurn = currentPlayer.id === this.gameData.gameState.turn_order[this.gameData.gameState.current_player_index];
    const isCurrentUser = currentPlayer.id === this.gameData.currentPlayerId;
    const hasRolled = this.gameData.gameState.last_roll !== undefined;
    console.log('Can roll check (playing phase):', { 
      isCurrentTurn, 
      isCurrentUser, 
      hasRolled,
      currentPlayerIndex: this.gameData.gameState.current_player_index,
      turnOrder: this.gameData.gameState.turn_order,
      currentPlayerId: currentPlayer.id
    });
    return isCurrentTurn && isCurrentUser && !hasRolled;
  }

  private canPlayerEndTurn(currentPlayer: Player | undefined): boolean {
    if (!currentPlayer) return false;
    
    if (this.gameData.gameState.phase === GAME_PHASES.WAITING) {
      return false; // Can't end turn during waiting phase
    }
    
    const isCurrentTurn = currentPlayer.id === this.gameData.gameState.turn_order[this.gameData.gameState.current_player_index];
    const isCurrentUser = currentPlayer.id === this.gameData.currentPlayerId;
    const hasRolled = this.gameData.gameState.last_roll !== undefined;
    console.log('Can end turn check:', { isCurrentTurn, isCurrentUser, hasRolled });
    return isCurrentTurn && isCurrentUser && hasRolled;
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
        const spaceName = BOARD_SPACES[p.position].name;
        positionElement.textContent = `Position: ${spaceName}`;
      }

      // Update status
      const statusElement = playerElement.querySelector('.roll-status');
      if (statusElement) {
        if (this.gameData.gameState.phase === GAME_PHASES.WAITING) {
          const roll = this.gameData.gameState.dice_rolls.find(r => r.playerId === p.id);
          statusElement.textContent = roll ? 
            `Initial Roll: ${roll.dice ? `${roll.dice[0]} + ${roll.dice[1]} = ${roll.roll}` : roll.roll}` : 
            'Waiting for roll...';
        } else {
          if (p.id === this.gameData.currentPlayerId) {
            const lastRoll = this.gameData.gameState.last_roll;
            const lastDice = this.gameData.gameState.last_dice;
            statusElement.textContent = lastRoll ? 
              `Current turn (Rolled: ${lastDice ? `${lastDice[0]} + ${lastDice[1]} = ${lastRoll}` : lastRoll})` : 
              'Current turn';
          } else {
            statusElement.textContent = 'Waiting for turn...';
          }
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
      
      // Update game state
      this.gameData.gameState = data.gameState;
      // Ensure last_roll is cleared for the next turn
      delete this.gameData.gameState.last_roll;
      delete this.gameData.gameState.last_position;
      
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
        const playerType = nextPlayer.is_bot ? '🤖' : '';
        await this.showMessageWithDelay(
          `${nextPlayer.username}${playerType}'s turn`,
          1000
        );

        // If next player is also a bot, process their turn after a short delay
        if (nextPlayer.is_bot) {
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

      // Update game state
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

      // Show roll message with movement details
      if (typeof bot.position === 'number' && typeof data.newPosition === 'number') {
        const fromSpace = BOARD_SPACES[bot.position];
        const toSpace = BOARD_SPACES[data.newPosition];
        await this.showMessageWithDelay(
          `${bot.username} rolled a ${data.roll}! Moving from ${fromSpace.name} to ${toSpace.name}`,
          1000
        );

        // Update bot position
        bot.position = data.newPosition;
        const botIndex = this.gameData.players.findIndex(p => p.id === bot.id);
        await this.board.updatePlayerPosition(bot.id, data.newPosition, botIndex);
      } else {
        await this.showMessageWithDelay(
          `${bot.username} rolled a ${data.roll}!`,
          1000
        );
      }

      // Handle space action if any
      if (data.spaceAction) {
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
      this.updatePropertiesPanel();

      // Show turn transition message
      const nextPlayer = this.gameData.players.find(p => p.id === data.nextPlayerId);
      if (nextPlayer) {
        const playerType = nextPlayer.is_bot ? '🤖' : '';
        await this.showMessageWithDelay(
          `${nextPlayer.username}${playerType}'s turn`,
          1000
        );

        // If next player is a bot, process their turn after a short delay
        if (nextPlayer.is_bot) {
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

  private showPurchaseDialog(propertyName: string, price: number | undefined, playerBalance: number): Promise<boolean> {
    return new Promise((resolve) => {
      if (price === undefined) {
        console.error('Property price is undefined');
        resolve(false);
        return;
      }

      console.log('Showing purchase dialog for:', propertyName, 'Price:', price, 'Balance:', playerBalance);
      
      // Create dialog elements
      const dialog = document.createElement('div');
      dialog.className = 'purchase-dialog';
      dialog.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: white;
        padding: 20px;
        border-radius: 8px;
        box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        z-index: 1000;
      `;
      
      dialog.innerHTML = `
        <h3>Purchase Property</h3>
        <p>Would you like to purchase ${propertyName} for $${price}?</p>
        <p>Your balance: $${playerBalance}</p>
        <div style="display: flex; gap: 10px; justify-content: flex-end; margin-top: 20px;">
          <button id="cancel-purchase" style="padding: 8px 16px;">No</button>
          <button id="confirm-purchase" style="padding: 8px 16px; background: #4CAF50; color: white; border: none;">Yes</button>
        </div>
      `;
      
      // Add dialog to document
      document.body.appendChild(dialog);
      
      // Add event listeners
      const confirmButton = dialog.querySelector('#confirm-purchase');
      const cancelButton = dialog.querySelector('#cancel-purchase');
      
      confirmButton?.addEventListener('click', () => {
        document.body.removeChild(dialog);
        resolve(true);
      });
      
      cancelButton?.addEventListener('click', () => {
        document.body.removeChild(dialog);
        resolve(false);
      });
    });
  }

  private async handleSpaceAction(spaceAction: any, currentPlayer: any): Promise<void> {
    console.log('\n=== Processing Space Action ===');
    console.log('Space action details:', spaceAction);
    
    if (spaceAction.type === 'card_drawn') {
      // Show card message
      await this.showMessageWithDelay(
        `${currentPlayer.username} drew a card: ${spaceAction.card.text}`,
        1500
      );
      
      // Show action result
      await this.showMessageWithDelay(spaceAction.message, 1500);
      
      // Update UI after card action
      this.updateBoard();
      this.updateGameStatus();
      this.updatePlayersStatus();
      this.updatePropertiesPanel();
    } else if (spaceAction.type === 'purchase_available') {
      const { property } = spaceAction;
      console.log('Property purchase opportunity:', {
        property,
        playerBalance: currentPlayer.balance,
        canAfford: currentPlayer.balance >= (property.price || 0)
      });
      
      // Show property landing message
      await this.showMessageWithDelay(
        `${currentPlayer.username} landed on ${property.name} - Available for purchase at $${property.price}`,
        1000
      );
      
      // Only show purchase dialog if it's the current player's turn and they're not a bot
      if (property.price !== undefined && 
          currentPlayer.id === this.gameData.currentPlayerId && 
          !currentPlayer.is_bot) {
        const purchaseConfirmed = await this.showPurchaseDialog(
          property.name,
          property.price,
          currentPlayer.balance
        );
        
        if (purchaseConfirmed) {
          console.log('User confirmed purchase, sending request...', {
            gameId: this.gameData.gameId,
            position: property.position,
            property
          });
          try {
            const purchaseResponse = await fetch(`/game/${this.gameData.gameId}/property/buy`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ position: property.position })
            });
            
            if (purchaseResponse.ok) {
              const result = await purchaseResponse.json();
              console.log('Purchase successful:', result);
              
              // Update game data
              if (result.players) {
                this.gameData.players = result.players;
                console.log('Updated players:', this.gameData.players);
              }
              if (result.properties) {
                this.gameData.properties = result.properties;
                console.log('Updated properties:', this.gameData.properties);
              }
              
              // Update UI
              this.updateBoard();
              this.updateGameStatus();
              this.updatePlayersStatus();
              this.updatePropertiesPanel();
              
              // Show success message
              await this.showMessageWithDelay(
                `${currentPlayer.username} purchased ${property.name} for $${property.price}`,
                1000
              );
            } else {
              const error = await purchaseResponse.json();
              console.error('Purchase failed:', error);
              await this.showMessage(error.error || 'Failed to buy property');
            }
          } catch (error) {
            console.error('Error during purchase:', error);
            await this.showMessage('Failed to buy property');
          }
        } else {
          await this.showMessageWithDelay(
            `${currentPlayer.username} declined to purchase ${property.name}`,
            1000
          );
        }
      }
    } else if (spaceAction.type === 'pay_rent') {
      const { property } = spaceAction;
      const owner = this.gameData.players.find(p => p.id === property.owner_id);
      if (owner) {
        // Show rent payment message
        await this.showMessageWithDelay(
          `${currentPlayer.username} landed on ${property.name} - Owned by ${owner.username}`,
          1000
        );
        await this.showMessageWithDelay(
          `Paying $${property.rentAmount} rent to ${owner.username}`,
          1000
        );

        // Update UI to reflect the rent payment
        this.updateBoard();
        this.updateGameStatus();
        this.updatePlayersStatus();
        this.updatePropertiesPanel();
      }
    } else if (spaceAction.type === 'pay_tax') {
      const { tax } = spaceAction;
      
      // Show tax payment message
      await this.showMessageWithDelay(
        `${currentPlayer.username} landed on ${tax.name}`,
        1000
      );
      await this.showMessageWithDelay(
        `Paying ${tax.amount} in taxes`,
        1000
      );

      // Update UI to reflect the tax payment
      this.updateBoard();
      this.updateGameStatus();
      this.updatePlayersStatus();
      this.updatePropertiesPanel();
    }
  }

  private updatePropertiesPanel(): void {
    const propertiesList = document.querySelector('.properties-list');
    if (!propertiesList) return;

    // Clear existing content
    propertiesList.innerHTML = '';

    // Create a document fragment to build the content
    const fragment = document.createDocumentFragment();

    // Group properties by owner
    const propertiesByOwner = new Map<number | null, Property[]>();
    this.gameData.properties.forEach(property => {
      const ownerId = property.ownerId || null;
      if (!propertiesByOwner.has(ownerId)) {
        propertiesByOwner.set(ownerId, []);
      }
      propertiesByOwner.get(ownerId)?.push(property);
    });

    // Create sections for each player's properties
    this.gameData.players.forEach((player, index) => {
      const playerProperties = propertiesByOwner.get(player.id) || [];
      if (playerProperties.length > 0) {
        const playerSection = document.createElement('div');
        playerSection.className = 'player-properties';
        
        const header = document.createElement('h3');
        header.style.color = this.board.getPlayerColor(index);
        header.textContent = `${player.username}'s Properties`;
        playerSection.appendChild(header);

        const propertyList = document.createElement('ul');
        
        // Group properties by color/type
        const groupedProperties = this.groupPropertiesByType(playerProperties);
        
        Object.entries(groupedProperties).forEach(([group, properties]) => {
          properties.forEach(property => {
            const listItem = document.createElement('li');
            const spaceData = BOARD_SPACES[property.position];
            
            // Add color coding class
            listItem.className = `property-color-${spaceData.color || spaceData.type}`;
            
            // Create property info
            const propertyInfo = document.createElement('div');
            propertyInfo.className = 'property-info';
            propertyInfo.innerHTML = `
              <span class="property-name">${property.name}</span>
              <span class="property-details">
                ($${property.price}) 
                ${property.houseCount > 0 ? 
                  `- ${property.houseCount === 5 ? '🏨' : '🏠'.repeat(property.houseCount)}` 
                  : ''}
                ${property.isMortgaged ? '📝 Mortgaged' : ''}
              </span>
            `;
            listItem.appendChild(propertyInfo);

            // Add controls if it's the current player's property
            if (player.id === this.gameData.currentPlayerId) {
              const controls = document.createElement('div');
              controls.className = 'property-controls';
              
              // House/Hotel controls
              if (!property.isMortgaged && (spaceData.type === 'property')) {
                const buildControls = document.createElement('div');
                buildControls.className = 'build-controls';
                
                // House button
                if (property.houseCount < 4) {
                  const buildHouseButton = document.createElement('button');
                  buildHouseButton.textContent = 'Build House';
                  buildHouseButton.className = 'btn btn-sm btn-secondary';
                  buildHouseButton.onclick = () => this.buildOnProperty(property, 'house');
                  buildControls.appendChild(buildHouseButton);
                }

                // Hotel button (only show if 4 houses)
                if (property.houseCount === 4) {
                  const buildHotelButton = document.createElement('button');
                  buildHotelButton.textContent = 'Build Hotel';
                  buildHotelButton.className = 'btn btn-sm btn-secondary';
                  buildHotelButton.onclick = () => this.buildOnProperty(property, 'hotel');
                  buildControls.appendChild(buildHotelButton);
                }

                controls.appendChild(buildControls);
              }

              // Mortgage controls
              const mortgageControls = document.createElement('div');
              mortgageControls.className = 'mortgage-controls';
              
              if (property.isMortgaged) {
                const unmortgageButton = document.createElement('button');
                unmortgageButton.textContent = 'Unmortgage';
                unmortgageButton.className = 'btn btn-sm btn-warning';
                unmortgageButton.onclick = () => this.toggleMortgage(property, 'unmortgage');
                mortgageControls.appendChild(unmortgageButton);
              } else if (property.houseCount === 0) {
                const mortgageButton = document.createElement('button');
                mortgageButton.textContent = 'Mortgage';
                mortgageButton.className = 'btn btn-sm btn-danger';
                mortgageButton.onclick = () => this.toggleMortgage(property, 'mortgage');
                mortgageControls.appendChild(mortgageButton);
              }

              controls.appendChild(mortgageControls);
              listItem.appendChild(controls);
            }

            propertyList.appendChild(listItem);
          });
        });

        playerSection.appendChild(propertyList);
        fragment.appendChild(playerSection);
      }
    });

    // Show unowned properties
    const unownedProperties = propertiesByOwner.get(null) || [];
    if (unownedProperties.length > 0) {
      const unownedSection = document.createElement('div');
      unownedSection.className = 'unowned-properties';
      
      const header = document.createElement('h3');
      header.textContent = 'Available Properties';
      unownedSection.appendChild(header);

      const propertyList = document.createElement('ul');
      
      // Group unowned properties by color/type
      const groupedUnowned = this.groupPropertiesByType(unownedProperties);
      
      Object.entries(groupedUnowned).forEach(([group, properties]) => {
        properties.forEach(property => {
          const listItem = document.createElement('li');
          const spaceData = BOARD_SPACES[property.position];
          
          // Add color coding class
          listItem.className = `property-color-${spaceData.color || spaceData.type}`;
          
          listItem.textContent = `${property.name} ($${property.price})`;
          propertyList.appendChild(listItem);
        });
      });

      unownedSection.appendChild(propertyList);
      fragment.appendChild(unownedSection);
    }

    // Add all content at once
    propertiesList.appendChild(fragment);
  }

  private groupPropertiesByType(properties: Property[]): { [key: string]: Property[] } {
    const groups: { [key: string]: Property[] } = {};
    
    properties.forEach(property => {
      const spaceData = BOARD_SPACES[property.position];
      const groupKey = spaceData.color || spaceData.type;
      
      if (!groups[groupKey]) {
        groups[groupKey] = [];
      }
      
      groups[groupKey].push(property);
    });
    
    // Sort groups by board order
    return Object.fromEntries(
      Object.entries(groups).sort(([a], [b]) => {
        const order = ['brown', 'light-blue', 'pink', 'orange', 'red', 'yellow', 'green', 'blue', 'railroad', 'utility'];
        return order.indexOf(a) - order.indexOf(b);
      })
    );
  }

  private async toggleMortgage(property: Property, action: 'mortgage' | 'unmortgage'): Promise<void> {
    try {
      const mortgageValue = property.price ? Math.floor(property.price / 2) : 0;
      if (mortgageValue === 0) {
        this.showMessage(`Cannot ${action} property - invalid price`);
        return;
      }

      const response = await fetch(`/game/${this.gameData.gameId}/property/mortgage`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          propertyId: property.id,
          action
        })
      });

      if (!response.ok) {
        const error = await response.json();
        this.showMessage(error.error || `Failed to ${action} property`);
        return;
      }

      const result = await response.json();
      
      // Update game data
      if (result.players) {
        this.gameData.players = result.players;
      }
      if (result.properties) {
        this.gameData.properties = result.properties;
      }

      // Update UI
      this.updateBoard();
      this.updateGameStatus();
      this.updatePlayersStatus();
      this.updatePropertiesPanel();

      // Show success message
      const message = action === 'mortgage'
        ? `Successfully mortgaged ${property.name} for $${mortgageValue}`
        : `Successfully unmortgaged ${property.name} for $${Math.floor(mortgageValue * 1.1)}`;
      this.showMessage(message);
    } catch (error) {
      console.error('Mortgage action error:', error);
      this.showMessage(`Failed to ${action} property`);
    }
  }

  private async buildOnProperty(property: Property, buildType: 'house' | 'hotel'): Promise<void> {
    try {
      const response = await fetch(`/game/${this.gameData.gameId}/property/build`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          propertyId: property.id,
          buildType
        })
      });

      if (!response.ok) {
        const error = await response.json();
        this.showMessage(error.error || `Failed to build ${buildType}`);
        return;
      }

      const result = await response.json();
      
      // Update game data
      if (result.players) {
        this.gameData.players = result.players;
      }
      if (result.properties) {
        this.gameData.properties = result.properties;
      }

      // Update UI
      this.updateBoard();
      this.updateGameStatus();
      this.updatePlayersStatus();
      this.updatePropertiesPanel();

      // Show success message
      this.showMessage(
        `Successfully built ${buildType} on ${property.name}`
      );
    } catch (error) {
      console.error('Build error:', error);
      this.showMessage(`Failed to build ${buildType}`);
    }
  }
}

// Initialize game service when the page loads
document.addEventListener('DOMContentLoaded', () => {
  new GameService(window.gameData);
}); 