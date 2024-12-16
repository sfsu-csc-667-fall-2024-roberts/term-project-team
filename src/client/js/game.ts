import { 
  GameState, 
  Player, 
  Property, 
  TradeProposal, 
  SpaceAction,
  GameData,
  RollResponse
} from '../../shared/types';
import { BOARD_SPACES } from '../../shared/boardData';
import MonopolyBoard from './board';

// Declare MonopolyBoard on Window interface
declare global {
  interface Window {
    monopolyBoard?: MonopolyBoard;
  }
}

// Global state
let gameData: GameData;
let currentGameState: GameState;
let currentPlayers: Player[];
let currentProperties: Property[];
let currentPlayerId: number | null = -1; // Default to -1 when no player is selected

// WebSocket connection
let socket: WebSocket;

// Add utility functions at the top of the file
function showError(message: string) {
  const errorDiv = document.getElementById('error-message');
  if (errorDiv && message) {
    errorDiv.textContent = message;
    errorDiv.style.display = 'block';
    setTimeout(() => {
      errorDiv.style.display = 'none';
    }, 3000);
  }
}

function animateDiceRoll(dice: [number, number]) {
  const diceContainer = document.getElementById('dice-container');
  if (diceContainer) {
    diceContainer.innerHTML = `
      <div class="dice">${dice[0]}</div>
      <div class="dice">${dice[1]}</div>
    `;
    diceContainer.classList.add('rolling');
    setTimeout(() => {
      diceContainer.classList.remove('rolling');
    }, 1000);
  }
}

function handleSpaceAction(spaceAction: SpaceAction) {
  if (!spaceAction) return;

  const actionContainer = document.getElementById('action-container');
  if (actionContainer) {
    actionContainer.innerHTML = `
      <div class="action-message">${spaceAction.message}</div>
    `;
    actionContainer.style.display = 'block';
    setTimeout(() => {
      actionContainer.style.display = 'none';
    }, 3000);
  }
}

// Convert trade offer to proposal
function convertTradeOfferToProposal(offer: any): TradeProposal | null {
  if (gameData.currentPlayerId === null) {
    showError('Cannot create trade proposal: No current player');
    return null;
  }
  return {
    fromPlayerId: gameData.currentPlayerId,
    toPlayerId: offer.toPlayerId,
    offeredProperties: offer.offeredProperties,
    requestedProperties: offer.requestedProperties,
    offeredMoney: offer.offeredMoney,
    requestedMoney: offer.requestedMoney,
    status: 'pending',
    timestamp: new Date().toISOString()
  };
}

// Add this function to safely get the next player
function getNextPlayer(currentPlayerId: number, players: Player[]): Player | null {
  if (!players || !Array.isArray(players) || players.length === 0) {
    return null;
  }

  const currentPlayerIndex = players.findIndex(p => p.id === currentPlayerId);
  if (currentPlayerIndex === -1) {
    return players[0]; // If current player not found, return first player
  }

  const nextIndex = (currentPlayerIndex + 1) % players.length;
  return players[nextIndex];
}

// Add these functions before updateGameState
function checkBotTurn() {
  if (!currentGameState || !currentPlayers) return;
  
  const currentPlayer = currentPlayers.find(p => p.id === currentGameState.currentPlayerId);
  if (currentPlayer?.isBot) {
    // Implement bot logic here
    console.log('Bot turn detected:', currentPlayer.username);
    // For now, just auto-roll and end turn for bots
    setTimeout(async () => {
      if (!currentGameState.lastRoll) {
        await handleRollDice();
      }
      if (currentGameState.lastRoll) {
        await handleEndTurn();
      }
    }, 2000);
  }
}

function updatePropertiesPanel() {
  // Update properties panel UI
  const propertiesSection = document.querySelector('.properties-section');
  if (!propertiesSection) return;

  // Update available properties
  const availableProps = currentProperties.filter(p => !p.ownerId);
  const availableTab = document.getElementById('available');
  if (availableTab) {
    // Update available properties UI
  }

  // Update your properties
  const yourProps = currentProperties.filter(p => p.ownerId === currentPlayerId);
  const yourTab = document.getElementById('yours');
  if (yourTab) {
    // Update your properties UI
  }

  // Update other players' properties
  const otherProps = currentProperties.filter(p => p.ownerId && p.ownerId !== currentPlayerId);
  const ownedTab = document.getElementById('owned');
  if (ownedTab) {
    // Update other players' properties UI
  }
}

// Update game state
function updateGameState(data: GameData) {
  if (!data) {
    console.error('Invalid game data received');
    return;
  }

  console.log('=== Updating Game Status ===');
  console.log('Received game data:', data);

  gameData = data;
  
  currentGameState = {
    id: data.gameId,
    currentPlayerId: data.currentPlayerId || -1,
    phase: data.gameState?.phase || 'waiting',
    currentPlayerIndex: data.gameState?.currentPlayerIndex || 0,
    diceRolls: data.gameState?.diceRolls || [],
    turnOrder: data.gameState?.turnOrder || [],
    players: data.players || [],
    properties: data.properties || [],
    doublesCount: data.gameState?.doublesCount || 0,
    jailTurns: data.gameState?.jailTurns || {},
    bankruptPlayers: data.gameState?.bankruptPlayers || [],
    jailFreeCards: data.gameState?.jailFreeCards || {},
    turnCount: data.gameState?.turnCount || 0,
    freeParkingPot: data.gameState?.freeParkingPot || 0,
    lastRoll: data.gameState?.lastRoll,
    lastDice: data.gameState?.lastDice,
    lastDoubles: data.gameState?.lastDoubles,
    lastPosition: data.gameState?.lastPosition,
    drawnCard: data.gameState?.drawnCard,
    currentPropertyDecision: data.gameState?.currentPropertyDecision,
    currentRentOwed: data.gameState?.currentRentOwed,
    winner: data.gameState?.winner,
    pendingTrades: data.gameState?.pendingTrades || [],
    auction: data.gameState?.auction,
    lastAction: data.gameState?.lastAction,
    lastActionTimestamp: data.gameState?.lastActionTimestamp,
    gameLog: data.gameState?.gameLog || []
  };
  
  currentPlayers = data.players || [];
  currentProperties = data.properties || [];
  currentPlayerId = data.currentPlayerId || -1;
  
  console.log('Updated game state:', currentGameState);
  console.log('Current player ID:', currentPlayerId);

  // Update the UI
  updateUI();

  // Update the board
  if (window.monopolyBoard) {
    window.monopolyBoard.update();
  }

  // Check for bot turn
  checkBotTurn();
}

// Handle roll response
async function handleRollResponse(data: RollResponse) {
  if (!data.success) {
    showError(data.message || 'Roll failed');
    return;
  }

  const { dice, isDoubles, gameState, players, spaceAction } = data;
  
  // Update game state
  if (gameState) {
    currentGameState = {
      ...gameState,
      players: players || currentPlayers,
      properties: currentProperties
    };
  }
  if (players) {
    currentPlayers = players;
  }

  // Animate dice roll
  if (Array.isArray(dice) && dice.length === 2) {
    animateDiceRoll(dice);
  }

  // Handle space action if any
  if (spaceAction) {
    await handleSpaceAction(spaceAction);
  }
}

// Get space color
function getSpaceColor(space: typeof BOARD_SPACES[0]): string {
  return space.colorGroup ?? '';
}

function initializeWebSocket(gameId: number) {
  console.log('Initializing WebSocket connection for game:', gameId);
  
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${protocol}//${window.location.host}/games/${gameId}/ws`;
  
  console.log('WebSocket URL:', wsUrl);
  
  socket = new WebSocket(wsUrl);
  
  socket.onopen = () => {
    console.log('WebSocket connection established');
  };
  
  socket.onmessage = (event) => {
    console.log('WebSocket message received:', event.data);
    try {
      const message = JSON.parse(event.data);
      handleWebSocketMessage(message);
    } catch (error) {
      console.error('Error parsing WebSocket message:', error);
    }
  };

  socket.onerror = (error) => {
    console.error('WebSocket error:', error);
  };

  socket.onclose = (event) => {
    console.log('WebSocket connection closed:', event.code, event.reason);
    // Try to reconnect after 5 seconds
    setTimeout(() => {
      console.log('Attempting to reconnect WebSocket...');
      initializeWebSocket(gameId);
    }, 5000);
  };
}

function handleWebSocketMessage(message: any) {
  console.log('Handling WebSocket message:', message);
  
  switch (message.type) {
    case 'state_update':
      console.log('Received state update:', message);
      updateGameState({
        gameId: gameData.gameId,
        currentUserId: gameData.currentUserId,
        currentPlayerId: gameData.currentPlayerId,
        gameState: message.state || currentGameState,
        players: message.players || currentPlayers,
        properties: message.properties || currentProperties
      });
      break;
      
    case 'roll_update':
      console.log('Received roll update:', message);
      handleRollResponse(message.data);
      break;
      
    case 'error':
      console.error('Received error message:', message);
      showError(message.message);
      break;
      
    default:
      console.warn('Unknown message type:', message.type);
  }
}

// Update UI elements
function updateUI() {
  console.log('=== Updating Players Status ===');
  
  // Update player cards
  const playersList = document.querySelector('.players-list');
  if (playersList) {
    currentPlayers.forEach(player => {
      console.log('Updating player:', player);
      const playerCard = playersList.querySelector(`[data-player-id="${player.id}"]`);
      if (playerCard) {
        // Update money
        const moneyElement = playerCard.querySelector('.player-balance');
        if (moneyElement) {
          moneyElement.textContent = `$${player.money}`;
        }

        // Update position if in playing phase
        const positionElement = playerCard.querySelector('.player-position');
        if (positionElement && currentGameState.phase === 'playing') {
          positionElement.textContent = `Position: ${player.position}`;
        }

        // Update controls visibility
        const controls = playerCard.querySelector('.player-controls');
        if (controls) {
          const rollButton = controls.querySelector('#roll-dice') as HTMLButtonElement;
          const endTurnButton = controls.querySelector('#end-turn') as HTMLButtonElement;

          if (rollButton) {
            const canRoll = (currentGameState.phase === 'waiting' && !currentGameState.diceRolls.find(r => r.id === player.id)) ||
                          (currentGameState.phase === 'playing' && currentGameState.currentPlayerId === player.id && !currentGameState.lastRoll);
            rollButton.disabled = !canRoll;
            rollButton.classList.toggle('active', Boolean(canRoll));
          }

          if (endTurnButton) {
            const canEndTurn = currentGameState.phase === 'playing' && 
                             currentGameState.currentPlayerId === player.id && 
                             currentGameState.lastRoll;
            endTurnButton.disabled = !canEndTurn;
            endTurnButton.classList.toggle('active', Boolean(canEndTurn));
          }
        }
      }
    });
  }

  // Update game status
  const gameStatus = document.querySelector('.game-status');
  if (gameStatus) {
    if (currentGameState.phase === 'waiting') {
      gameStatus.textContent = `Initial Roll Phase - Roll to determine turn order (${currentGameState.diceRolls.length}/${currentPlayers.length} players rolled)`;
    } else if (currentGameState.phase === 'playing') {
      const currentPlayer = currentPlayers.find(p => p.id === currentGameState.currentPlayerId);
      if (currentPlayer) {
        gameStatus.textContent = `${currentPlayer.username}'s Turn${currentPlayer.id === currentPlayerId ? ' - Your turn!' : ''}`;
      }
    }
  }

  // Update properties panel
  updatePropertiesPanel();
}

function getRollStatus(player: Player): string {
  if (currentGameState.phase === 'waiting') {
    // Try both property names for backward compatibility
    const playerRoll = (currentGameState.diceRolls || currentGameState.dice_rolls || [])
      .find((r: { id: number }) => r.id === player.id);
    return playerRoll ? `Rolled: ${playerRoll.roll}` : 'Waiting for roll...';
  } else {
    return currentGameState.turnOrder[currentGameState.currentPlayerIndex] === player.id
      ? 'Current turn'
      : 'Waiting...';
  }
}

function getPlayerName(playerId: number): string {
  const player = currentPlayers.find(p => p.id === playerId);
  return player ? player.username : 'Unknown';
}

// Initialize game when document is ready
document.addEventListener('DOMContentLoaded', () => {
  console.log('=== Game Initialization ===');
  
  // Initialize WebSocket connection
  const gameIdElement = document.querySelector('[data-game-id]');
  if (gameIdElement) {
    const gameId = parseInt(gameIdElement.getAttribute('data-game-id') || '0', 10);
    if (gameId) {
      console.log('Initializing WebSocket for game:', gameId);
      initializeWebSocket(gameId);
    }
  }

  // Initialize the game board
  window.monopolyBoard = new MonopolyBoard('monopoly-board');

  // Get initial game data from the window object
  if (window.monopolyGameData) {
    console.log('Initial game data found:', window.monopolyGameData);
    
    // Initialize game state from window data
    gameData = window.monopolyGameData;
    currentPlayerId = window.monopolyGameData.currentPlayerId ?? -1;
    currentPlayers = window.monopolyGameData.players || [];
    currentProperties = window.monopolyGameData.properties || [];
    
    // Initialize game state
    currentGameState = {
      id: window.monopolyGameData.gameId,
      phase: window.monopolyGameData.gameState?.phase || 'waiting',
      currentPlayerId: window.monopolyGameData.currentPlayerId || -1,
      currentPlayerIndex: window.monopolyGameData.gameState?.currentPlayerIndex || 0,
      players: window.monopolyGameData.players || [],
      properties: window.monopolyGameData.properties || [],
      diceRolls: window.monopolyGameData.gameState?.diceRolls || [],
      turnOrder: window.monopolyGameData.gameState?.turnOrder || [],
      doublesCount: window.monopolyGameData.gameState?.doublesCount || 0,
      jailTurns: window.monopolyGameData.gameState?.jailTurns || {},
      bankruptPlayers: window.monopolyGameData.gameState?.bankruptPlayers || [],
      jailFreeCards: window.monopolyGameData.gameState?.jailFreeCards || {},
      turnCount: window.monopolyGameData.gameState?.turnCount || 0,
      freeParkingPot: window.monopolyGameData.gameState?.freeParkingPot || 0,
      lastRoll: window.monopolyGameData.gameState?.lastRoll,
      lastDice: window.monopolyGameData.gameState?.lastDice,
      lastDoubles: window.monopolyGameData.gameState?.lastDoubles,
      lastPosition: window.monopolyGameData.gameState?.lastPosition,
      drawnCard: window.monopolyGameData.gameState?.drawnCard,
      currentPropertyDecision: window.monopolyGameData.gameState?.currentPropertyDecision,
      currentRentOwed: window.monopolyGameData.gameState?.currentRentOwed,
      winner: window.monopolyGameData.gameState?.winner,
      pendingTrades: window.monopolyGameData.gameState?.pendingTrades || [],
      auction: window.monopolyGameData.gameState?.auction,
      lastAction: window.monopolyGameData.gameState?.lastAction,
      lastActionTimestamp: window.monopolyGameData.gameState?.lastActionTimestamp,
      gameLog: window.monopolyGameData.gameState?.gameLog || []
    };

    console.log('Game state initialized:', currentGameState);
    console.log('Current player ID:', currentPlayerId);

    // Initialize event listeners for player controls
    initializeEventListeners();

    // Update UI with initial state
    updateUI();
  } else {
    console.error('No initial game data found in window.monopolyGameData');
  }
});

// Initialize event listeners
function initializeEventListeners() {
  console.log('=== Initializing Event Listeners ===');
  
  // Add event listeners to roll dice buttons
  document.querySelectorAll('#roll-dice').forEach(button => {
    button.addEventListener('click', handleRollDice);
    console.log('Added roll dice event listener');
  });

  // Add event listeners to end turn buttons
  document.querySelectorAll('#end-turn').forEach(button => {
    button.addEventListener('click', handleEndTurn);
    console.log('Added end turn event listener');
  });

  console.log('Event listeners initialized');
}

async function handleRollDice() {
  if (!currentPlayerId || !gameData) return;

  try {
    const rollDiceButton = document.getElementById('roll-dice') as HTMLButtonElement;
    if (rollDiceButton) rollDiceButton.disabled = true;

    const response = await fetch(`/games/${gameData.gameId}/roll`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ playerId: currentPlayerId })
    });

    const data = await response.json();
    if (data.success) {
      handleRollResponse(data);
    } else {
      showError(data.message || 'Roll failed');
      if (rollDiceButton) rollDiceButton.disabled = false;
    }
  } catch (error) {
    console.error('Error rolling dice:', error);
    showError('Failed to roll dice');
    const rollDiceButton = document.getElementById('roll-dice') as HTMLButtonElement;
    if (rollDiceButton) rollDiceButton.disabled = false;
  }
}

async function handleEndTurn() {
  if (!currentPlayerId || !gameData) return;

  try {
    const endTurnButton = document.getElementById('end-turn') as HTMLButtonElement;
    if (endTurnButton) endTurnButton.disabled = true;

    const response = await fetch(`/games/${gameData.gameId}/end-turn`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ playerId: currentPlayerId })
    });

    const data = await response.json();
    if (data.success) {
      updateGameState(data.gameData);
    } else {
      showError(data.message || 'Failed to end turn');
      if (endTurnButton) endTurnButton.disabled = false;
    }
  } catch (error) {
    console.error('Error ending turn:', error);
    showError('Failed to end turn');
    const endTurnButton = document.getElementById('end-turn') as HTMLButtonElement;
    if (endTurnButton) endTurnButton.disabled = false;
  }
}

// ... rest of the file ...