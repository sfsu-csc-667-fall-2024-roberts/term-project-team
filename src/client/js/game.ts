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
let currentPlayerId: number = -1; // Default to -1 when no player is selected

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

// Update game state
function updateGameState(data: GameData) {
  if (!data) {
    console.error('Invalid game data received');
    return;
  }

  gameData = {
    ...data,
    gameState: {
      ...data.gameState,
      players: data.players || [],
      properties: data.properties || []
    }
  };
  
  currentGameState = gameData.gameState || {
    phase: 'waiting',
    players: [],
    dice_rolls: [],
    jailTurns: {},
    turnCount: 0,
    turnOrder: [],
    properties: [],
    doublesCount: 0,
    jailFreeCards: {},
    freeParkingPot: 0,
    bankruptPlayers: [],
    currentPlayerIndex: 0
  };
  
  currentPlayers = data.players || [];
  currentProperties = data.properties || [];
  
  // Ensure currentPlayerId is a number
  currentPlayerId = data.currentPlayerId !== null ? data.currentPlayerId : -1;

  // Update the board
  if (window.monopolyBoard) {
    window.monopolyBoard.update();
  }
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
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${protocol}//${window.location.host}/games/${gameId}/ws`;
  
  socket = new WebSocket(wsUrl);
  
  socket.onmessage = (event) => {
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

  socket.onclose = () => {
    console.log('WebSocket connection closed');
    // Try to reconnect after 5 seconds
    setTimeout(() => initializeWebSocket(gameId), 5000);
  };
}

function handleWebSocketMessage(message: any) {
  switch (message.type) {
    case 'state_update':
      updateGameState({
        gameId: gameData.gameId,
        currentUserId: gameData.currentUserId,
        currentPlayerId: gameData.currentPlayerId,
        gameState: message.state || currentGameState,
        players: message.players || currentPlayers,
        properties: message.properties || currentProperties
      });
      updateUI();
      break;
      
    case 'roll_update':
      handleRollResponse(message.data);
      break;
      
    case 'error':
      showError(message.message);
      break;
      
    default:
      console.warn('Unknown message type:', message.type);
  }
}

function updateUI() {
  // Update players panel
  const playersList = document.querySelector('.players-list');
  if (playersList && currentPlayers) {
    playersList.innerHTML = currentPlayers.map(player => `
      <div class="player-card ${player.id === currentPlayerId ? 'current-player' : ''}"
           data-player-id="${player.id}">
        <div class="player-avatar">
          ${player.isBot ? '🤖' : '👤'}
        </div>
        <div class="player-info">
          <div class="player-name">
            ${player.username}
            ${player.id === currentPlayerId ? '<span class="player-you">(You)</span>' : ''}
          </div>
          <div class="player-stats">
            <div class="player-balance">$${player.money}</div>
            <div class="player-position">${player.position}</div>
            <div class="roll-status">
              ${getRollStatus(player)}
            </div>
          </div>
        </div>
      </div>
    `).join('');
  }

  // Update properties panel
  const propertiesList = document.querySelector('.properties-list');
  if (propertiesList && currentProperties) {
    const groupedProperties = currentProperties.reduce((acc, prop) => {
      if (prop.colorGroup) {
        if (!acc[prop.colorGroup]) {
          acc[prop.colorGroup] = [];
        }
        acc[prop.colorGroup].push(prop);
      }
      return acc;
    }, {} as Record<string, Property[]>);

    propertiesList.innerHTML = Object.entries(groupedProperties)
      .map(([colorGroup, props]) => `
        <div class="property-group" data-color-group="${colorGroup}">
          <h3 class="group-title">${colorGroup.charAt(0).toUpperCase() + colorGroup.slice(1)}</h3>
          <div class="group-properties">
            ${props.map(property => `
              <div class="property-card" data-property-id="${property.id}">
                <div class="color-strip" style="background-color: ${property.colorGroup}"></div>
                <div class="property-name">${property.name}</div>
                <div class="property-price">$${property.price}</div>
                ${property.ownerId ? `
                  <div class="property-owner">
                    Owner: ${getPlayerName(property.ownerId)}
                  </div>
                ` : ''}
                <div class="property-stats">
                  ${property.houseCount > 0 ? `
                    <div class="house-count">Houses: ${property.houseCount}</div>
                  ` : ''}
                  ${property.hasHotel ? `
                    <div class="hotel-indicator">Hotel</div>
                  ` : ''}
                  ${property.isMortgaged ? `
                    <div class="mortgaged-indicator">Mortgaged</div>
                  ` : ''}
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      `).join('');
  }

  // Update game controls
  const rollDiceButton = document.getElementById('roll-dice') as HTMLButtonElement;
  const endTurnButton = document.getElementById('end-turn') as HTMLButtonElement;

  if (rollDiceButton && endTurnButton) {
    const isCurrentPlayer = currentGameState.turnOrder[currentGameState.currentPlayerIndex] === currentPlayerId;
    const canRoll = isCurrentPlayer && (
      currentGameState.phase === 'waiting' ||
      (currentGameState.phase === 'playing' && !currentGameState.lastRoll)
    );
    const canEndTurn = isCurrentPlayer && currentGameState.phase === 'playing' && currentGameState.lastRoll;

    rollDiceButton.disabled = !canRoll;
    endTurnButton.disabled = !canEndTurn;
  }

  // Update board
  if (window.monopolyBoard) {
    window.monopolyBoard.update();
    
    // Update current player highlight
    if (currentGameState.turnOrder[currentGameState.currentPlayerIndex]) {
      window.monopolyBoard.setCurrentPlayer(currentGameState.turnOrder[currentGameState.currentPlayerIndex]);
    }
  }
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
  // Initialize tab system
  const tabButtons = document.querySelectorAll('.tab-button');
  const tabPanes = document.querySelectorAll('.tab-pane');

  tabButtons.forEach(button => {
    button.addEventListener('click', () => {
      const targetTab = button.getAttribute('data-tab');
      
      // Update active states
      tabButtons.forEach(btn => btn.classList.remove('active'));
      tabPanes.forEach(pane => pane.classList.remove('active'));
      
      button.classList.add('active');
      document.getElementById(targetTab!)?.classList.add('active');
    });
  });

  // Initialize game controls
  const gameControls = document.createElement('div');
  gameControls.className = 'game-controls';
  gameControls.innerHTML = `
    <button id="roll-dice" class="btn btn-primary" disabled>Roll Dice</button>
    <button id="end-turn" class="btn btn-secondary" disabled>End Turn</button>
  `;
  document.body.appendChild(gameControls);

  // Initialize WebSocket connection
  const gameIdElement = document.querySelector('[data-game-id]');
  if (gameIdElement) {
    const gameId = parseInt(gameIdElement.getAttribute('data-game-id') || '0', 10);
    if (gameId) {
      initializeWebSocket(gameId);
    }
  }

  // Initialize the game board
  window.monopolyBoard = new MonopolyBoard('monopoly-board');

  // Add event listeners for game controls
  const rollDiceButton = document.getElementById('roll-dice');
  const endTurnButton = document.getElementById('end-turn');

  rollDiceButton?.addEventListener('click', async () => {
    if (!currentPlayerId || !gameData) return;

    try {
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
      }
    } catch (error) {
      console.error('Error rolling dice:', error);
      showError('Failed to roll dice');
    }
  });

  endTurnButton?.addEventListener('click', async () => {
    if (!currentPlayerId || !gameData) return;

    try {
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
      }
    } catch (error) {
      console.error('Error ending turn:', error);
      showError('Failed to end turn');
    }
  });

  // Update UI with initial game state
  if (window.gameData) {
    updateGameState(window.gameData);
  }
});

// ... rest of the file ...