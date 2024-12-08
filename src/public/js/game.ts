import MonopolyBoard from './board';

interface Player {
  user_id: number;
  username: string;
  position: number;
  balance: number;
  jailed: boolean;
}

declare global {
  interface Window {
    gameData: {
      players: Player[];
      currentUserId: number;
    };
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const board = new MonopolyBoard('monopoly-board');
  
  // Initialize player positions
  window.gameData.players.forEach((player, index) => {
    board.updatePlayerPosition(
      player.user_id,
      player.position,
      getPlayerColor(index)
    );
  });

  // Set up game controls
  const rollDiceButton = document.getElementById('roll-dice');
  const endTurnButton = document.getElementById('end-turn');

  if (rollDiceButton) {
    rollDiceButton.addEventListener('click', () => {
      // TODO: Implement dice rolling
      console.log('Rolling dice...');
    });
  }

  if (endTurnButton) {
    endTurnButton.addEventListener('click', () => {
      // TODO: Implement end turn
      console.log('Ending turn...');
    });
  }
});

function getPlayerColor(index: number): string {
  const colors = [
    '#ff0000', // red
    '#00ff00', // green
    '#0000ff', // blue
    '#ffff00', // yellow
    '#ff00ff', // magenta
    '#00ffff', // cyan
    '#ff8800', // orange
    '#8800ff'  // purple
  ];
  return colors[index % colors.length];
} 