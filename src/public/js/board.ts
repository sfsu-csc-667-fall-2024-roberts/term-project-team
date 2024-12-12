import { BOARD_SPACES, BoardSpace } from '../../shared/boardData';
import { Property } from './types';

class MonopolyBoard {
  private container: HTMLElement;
  private playerTokens: Map<number, HTMLElement>;
  private propertyOwnership: Map<number, number>;
  private playerColors = ['#90EE90', '#FFB6C1', '#87CEEB', '#DDA0DD'];

  constructor(containerId: string) {
    const element = document.getElementById(containerId);
    if (!element) {
      throw new Error(`Element with id ${containerId} not found`);
    }
    this.container = element;
    this.playerTokens = new Map();
    this.propertyOwnership = new Map();
    this.initializeBoard();
  }

  private initializeBoard(): void {
    // Clear existing content
    this.container.innerHTML = '';

    // Add board spaces
    BOARD_SPACES.forEach(space => {
      const spaceElement = this.createBoardSpace(space);
      this.container.appendChild(spaceElement);
    });

    // Add center area
    const centerArea = document.createElement('div');
    centerArea.className = 'board-center';
    centerArea.textContent = 'MONOPOLY';
    this.container.appendChild(centerArea);
  }

  private createBoardSpace(space: BoardSpace): HTMLElement {
    const spaceElement = document.createElement('div');
    spaceElement.className = `board-space pos-${space.position}`;
    spaceElement.setAttribute('data-position', space.position.toString());
    
    // Add type-specific classes
    if (space.type === 'property') {
      spaceElement.classList.add('space-property');
    } else if (space.type === 'railroad') {
      spaceElement.classList.add('space-railroad');
    } else if (space.type === 'utility') {
      spaceElement.classList.add('space-utility');
      if (space.name.includes('Water')) {
        spaceElement.classList.add('water-works');
      } else if (space.name.includes('Electric')) {
        spaceElement.classList.add('electric-company');
      }
    } else if (space.type === 'tax') {
      spaceElement.classList.add('space-tax');
    } else if (space.type === 'chance') {
      spaceElement.classList.add('space-chance');
    } else if (space.type === 'chest') {
      spaceElement.classList.add('space-chest');
    } else if (space.type === 'corner') {
      spaceElement.classList.add('space-corner');
      // Add corner-specific classes
      if (space.position === 0) spaceElement.classList.add('bottom-right');
      if (space.position === 10) spaceElement.classList.add('bottom-left');
      if (space.position === 20) spaceElement.classList.add('top-left');
      if (space.position === 30) spaceElement.classList.add('top-right');
    }

    // Add space content
    const content = document.createElement('div');
    content.className = 'space-content';

    // Add color bar for properties
    if (space.type === 'property' && space.color) {
      const colorBar = document.createElement('div');
      colorBar.className = `property-color-bar color-${space.color}`;
      content.appendChild(colorBar);
    }

    // Add property info container
    const infoContainer = document.createElement('div');
    infoContainer.className = 'property-info';

    // Add name
    const nameDiv = document.createElement('div');
    nameDiv.className = 'property-name';
    nameDiv.textContent = space.name;
    infoContainer.appendChild(nameDiv);

    // Add icon for special spaces
    if (space.type === 'railroad' || space.type === 'utility' || 
        space.type === 'chance' || space.type === 'chest') {
      const iconDiv = document.createElement('div');
      iconDiv.className = 'space-icon';
      infoContainer.appendChild(iconDiv);
    }

    // Add price if applicable
    if (space.price) {
      const priceDiv = document.createElement('div');
      priceDiv.className = 'property-price';
      priceDiv.textContent = `$${space.price}`;
      infoContainer.appendChild(priceDiv);
    }

    content.appendChild(infoContainer);
    spaceElement.appendChild(content);

    return spaceElement;
  }

  public updatePlayerPosition(playerId: number, position: number, playerIndex: number): void {
    let token = this.playerTokens.get(playerId);
    
    // Create token if it doesn't exist
    if (!token) {
      token = document.createElement('div');
      token.className = 'player-token';
      token.style.backgroundColor = this.playerColors[playerIndex % this.playerColors.length];
      token.style.width = '20px';
      token.style.height = '20px';
      token.style.borderRadius = '50%';
      token.style.position = 'absolute';
      token.style.zIndex = '100';
      token.style.transition = 'all 0.5s ease-in-out';
      this.container.appendChild(token);
      this.playerTokens.set(playerId, token);
    }

    const space = this.container.querySelector(`[data-position="${position}"]`) as HTMLElement;
    if (!space) return;

    const spaceRect = space.getBoundingClientRect();
    const boardRect = this.container.getBoundingClientRect();

    // Calculate relative position within the board
    const relativeX = spaceRect.left - boardRect.left + (spaceRect.width / 2) - 10;
    const relativeY = spaceRect.top - boardRect.top + (spaceRect.height / 2) - 10;

    // Add offset based on player index to prevent overlap
    const offset = playerIndex * 15;
    const isCorner = position % 10 === 0;
    
    if (isCorner) {
      // For corner spaces, arrange tokens in a 2x2 grid
      const row = Math.floor(playerIndex / 2);
      const col = playerIndex % 2;
      token.style.left = `${relativeX + (col * 20)}px`;
      token.style.top = `${relativeY + (row * 20)}px`;
    } else {
      // For regular spaces, arrange tokens horizontally
      token.style.left = `${relativeX + offset}px`;
      token.style.top = `${relativeY}px`;
    }
  }

  public updatePropertyOwnership(property: Property, ownerIndex: number): void {
    const spaceElement = this.container.querySelector(`.pos-${property.position}`) as HTMLElement;
    if (spaceElement) {
      // Remove any existing ownership indicators
      const existingIndicator = spaceElement.querySelector('.property-owner-indicator');
      if (existingIndicator) {
        existingIndicator.remove();
      }

      if (property.owner_id !== null && property.owner_id !== undefined) {
        const indicator = document.createElement('div');
        indicator.className = `property-owner-indicator owner-${ownerIndex}`;
        spaceElement.appendChild(indicator);
      }

      this.propertyOwnership.set(property.position, property.owner_id || -1);
    }
  }
}

export default MonopolyBoard; 