declare global {
    interface Window {
        GAME_ID: string;
        USER_TOKEN: string;
        INITIAL_STATE: any;
    }
}

import { Game } from './game';

// Wait for the DOM to be fully loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log('init: DOM loaded, starting game initialization');
    const gameId = parseInt(window.GAME_ID, 10);
    const token = window.USER_TOKEN;
    
    if (!gameId || !token) {
        console.error('init: Missing required game data');
        return;
    }
    
    console.log('init: Creating game instance');
    const game = new Game(gameId, token);
    console.log('init: Initializing game');
    game.initializeGame().catch(error => {
        console.error('init: Failed to initialize game:', error);
    });
}); 