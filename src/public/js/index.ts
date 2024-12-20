import { Game } from './game';
import { GameState, Player, Property, MonopolyGameData } from '../../shared/types';

declare global {
    interface Window {
        GAME_ID: string;
        USER_TOKEN: string;
        INITIAL_STATE: any;
        monopolyGameData: MonopolyGameData;
    }
}

// Initialize the game when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log('Index: DOM loaded, starting game initialization');
    const gameId = parseInt(window.GAME_ID, 10);
    const token = window.USER_TOKEN;
    
    if (!gameId || !token) {
        console.error('Index: Missing required game data');
        return;
    }
    
    console.log('Index: Creating game instance');
    const game = new Game(gameId, token);
    console.log('Index: Initializing game');
    game.initializeGame().catch(error => {
        console.error('Index: Failed to initialize game:', error);
    });
}); 