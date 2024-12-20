import { BOARD_SPACES } from '../../shared/boardData';
import { GameState, Player } from '../../shared/types';

export class MonopolyBoard {
    private boardElement: HTMLElement | null;
    private spaces: HTMLElement[];

    constructor() {
        console.log('MonopolyBoard: Initializing...');
        this.boardElement = document.querySelector('#monopoly-board');
        console.log('MonopolyBoard: Board element found:', this.boardElement);
        this.spaces = [];
        this.initializeBoard();
    }

    public initializeBoard(): void {
        console.log('MonopolyBoard: Starting board initialization');
        if (!this.boardElement) {
            console.error('MonopolyBoard: Board element not found');
            return;
        }

        // Clear existing board
        this.boardElement.innerHTML = '';
        console.log('MonopolyBoard: Cleared existing board content');

        // Initialize spaces
        console.log('MonopolyBoard: Starting space initialization with', BOARD_SPACES.length, 'spaces');
        BOARD_SPACES.forEach((space, index) => {
            console.log(`MonopolyBoard: Creating space ${index}:`, space.name);
            const spaceElement = document.createElement('div');
            const isCorner = space.type === 'corner';
            
            spaceElement.className = `board-space pos-${index}`;
            spaceElement.id = `space-${index}`;
            if (isCorner) {
                spaceElement.classList.add('space-corner');
            } else {
                spaceElement.classList.add(`space-type-${space.type}`);
            }
            spaceElement.setAttribute('data-position', index.toString());
            
            // Add space content
            const spaceContent = document.createElement('div');
            spaceContent.className = 'space-content';
            
            if (isCorner) {
                // Special handling for corner spaces
                if (index === 0) { // GO
                    spaceContent.innerHTML = `
                        <div class="space-name">GO</div>
                        <div class="space-action">COLLECT $200</div>
                    `;
                } else if (index === 10) { // Jail
                    spaceContent.innerHTML = `
                        <div class="space-name">IN JAIL</div>
                        <div class="space-action">JUST VISITING</div>
                    `;
                } else if (index === 20) { // Free Parking
                    spaceContent.innerHTML = `
                        <div class="space-name">FREE</div>
                        <div class="space-action">PARKING</div>
                    `;
                } else if (index === 30) { // Go To Jail
                    spaceContent.innerHTML = `
                        <div class="space-name">GO TO</div>
                        <div class="space-action">JAIL</div>
                    `;
                }
            } else {
                // Create property info container
                const propertyInfo = document.createElement('div');
                propertyInfo.className = 'property-info';

                // Add color bar for properties
                if (space.type === 'property' && space.colorGroup) {
                    const colorBar = document.createElement('div');
                    const colorClass = space.colorGroup === 'lightblue' ? 'light-blue' : space.colorGroup;
                    colorBar.className = `property-color-bar ${colorClass}`;
                    spaceContent.appendChild(colorBar);
                }
                
                // Add name
                const nameDiv = document.createElement('div');
                nameDiv.className = 'property-name';
                nameDiv.textContent = space.name;
                propertyInfo.appendChild(nameDiv);
                
                // Add price for purchasable spaces
                if ('price' in space) {
                    const priceDiv = document.createElement('div');
                    priceDiv.className = 'property-price';
                    priceDiv.textContent = `$${space.price}`;
                    propertyInfo.appendChild(priceDiv);
                }

                spaceContent.appendChild(propertyInfo);
            }
            
            spaceElement.appendChild(spaceContent);
            this.spaces[index] = spaceElement;
            this.boardElement!.appendChild(spaceElement);
        });

        // Add center logo
        const centerArea = document.createElement('div');
        centerArea.className = 'board-center';
        centerArea.innerHTML = '<div class="board-center-monopoly">MONOPOLY</div>';
        this.boardElement.appendChild(centerArea);

        console.log('MonopolyBoard: Board initialization completed');
    }

    public updateBoard(gameState: GameState): void {
        console.log('MonopolyBoard: Updating board with game state:', gameState);
        
        if (!gameState || !gameState.players) {
            console.error('MonopolyBoard: Invalid game state');
            return;
        }

        // Update player positions
        gameState.players.forEach((player, index) => {
            if (typeof player.id !== 'undefined' && typeof player.position !== 'undefined') {
                this.updatePlayerPosition(player.id, player.position, index);
            } else {
                console.error('MonopolyBoard: Invalid player data:', player);
            }
        });

        // Update property ownership
        if (gameState.properties) {
            gameState.properties.forEach(property => {
                if (property.id !== undefined) {
                    const spaceElement = document.getElementById(`space-${property.id}`);
                    if (spaceElement) {
                        // Remove existing ownership classes
                        spaceElement.classList.remove('owned', 'owned-by-current-player');
                        
                        if (property.ownerId) {
                            spaceElement.classList.add('owned');
                            if (property.ownerId === window.monopolyGameData.currentPlayerId) {
                                spaceElement.classList.add('owned-by-current-player');
                            }
                        }
                    }
                }
            });
        }
    }

    public updatePlayerPosition(playerId: number, position: number, playerIndex: number): void {
        console.log('MonopolyBoard: Updating player position:', { playerId, position });
        
        // First, try to find existing token
        let token = document.getElementById(`player-token-${playerId}`);
        
        // If token doesn't exist, create it
        if (!token) {
            console.log('MonopolyBoard: Creating new token for player:', playerId);
            token = document.createElement('div');
            token.id = `player-token-${playerId}`;
            token.className = `player-token player-${playerId}`;
            token.innerHTML = `<div class="token-content">${playerId}</div>`;
        }

        // Find the target space
        const space = document.getElementById(`space-${position}`);
        if (!space) {
            console.error('MonopolyBoard: Space not found for position:', position);
            return;
        }

        // Remove token from its current parent if it exists
        if (token.parentElement) {
            token.parentElement.removeChild(token);
        }

        // Add token to the new space
        console.log('MonopolyBoard: Moving token to space:', position);
        space.appendChild(token);
    }

    public updatePropertyOwnership(position: number, ownerIndex: number): void {
        const space = this.spaces[position];
        if (!space) {
            console.error('Space not found', { position });
            return;
        }

        // Remove existing ownership marker
        const existingMarker = space.querySelector('.property-ownership-marker');
        if (existingMarker) {
            existingMarker.remove();
        }

        // Add new ownership marker
        const marker = document.createElement('div');
        marker.className = 'property-ownership-marker';
        marker.style.backgroundColor = `var(--player-color-${ownerIndex})`;
        space.appendChild(marker);
    }
} 