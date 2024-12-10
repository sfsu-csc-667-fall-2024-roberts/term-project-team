import { BOARD_SPACES, BoardSpace } from '../../shared/boardData';
import { Property } from './types';

class MonopolyBoard {
  private boardElement: HTMLElement;
  private playerTokens: Map<number, HTMLElement> = new Map();
  private playerColors: string[] = ['#ff0000', '#00ff00', '#0000ff', '#ffff00'];

  constructor(elementId: string) {
    const element = document.getElementById(elementId);
    if (!element) {
      throw new Error(`Element with id ${elementId} not found`);
    }
    this.boardElement = element;
    this.initializeBoard();
  }

  private initializeBoard() {
    const orderedSpaces = [...BOARD_SPACES].sort((a, b) => a.position - b.position);
    orderedSpaces.forEach(space => {
      const spaceElement = this.createSpaceElement(space);
      this.boardElement.appendChild(spaceElement);
    });
  }

  private createSpaceElement(space: BoardSpace): HTMLElement {
    const spaceElement = document.createElement('div');
    spaceElement.className = `board-space pos-${space.position}`;
    spaceElement.dataset.position = space.position.toString();

    const content = document.createElement('div');
    content.className = 'space-content';

    if (space.type === 'property') {
      content.innerHTML = this.createPropertyContent(space);
    } else {
      content.innerHTML = `<div class="space-name">${space.name}</div>`;
    }

    spaceElement.appendChild(content);
    return spaceElement;
  }

  private createPropertyContent(space: BoardSpace): string {
    return `
      <div class="property-color-bar ${space.color ? `color-${space.color}` : ''}"></div>
      <div class="property-info">
        <div class="property-name">${space.name}</div>
        <div class="property-price">$${space.price || ''}</div>
      </div>
      <div class="property-details">
        <h4>${space.name}</h4>
        <p>Price: $${space.price || ''}</p>
        ${space.rent ? `<p>Rent: $${space.rent[0]}</p>` : ''}
      </div>
    `;
  }

  public updatePropertyOwnership(property: Property, playerIndex: number): void {
    const spaceElement = this.boardElement.querySelector(`.pos-${property.position}`);
    if (!spaceElement) return;

    // Remove any existing ownership indicators
    const existingIndicator = spaceElement.querySelector('.property-owner-indicator');
    if (existingIndicator) {
      existingIndicator.remove();
    }

    // Create new ownership indicator
    const ownerIndicator = document.createElement('div');
    ownerIndicator.className = `property-owner-indicator owner-${playerIndex}`;
    spaceElement.appendChild(ownerIndicator);

    // Update mortgaged status if needed
    if (property.mortgaged) {
      spaceElement.classList.add('property-mortgaged');
    } else {
      spaceElement.classList.remove('property-mortgaged');
    }

    // Update house count if any
    this.updateHouseCount(property);
  }

  private updateHouseCount(property: Property): void {
    const spaceElement = this.boardElement.querySelector(`.pos-${property.position}`);
    if (!spaceElement) return;

    const existingHouses = spaceElement.querySelector('.house-count');
    if (existingHouses) {
      existingHouses.remove();
    }

    if (property.house_count > 0) {
      const houseContainer = document.createElement('div');
      houseContainer.className = 'house-count';

      if (property.house_count === 5) {
        // Show hotel
        const hotel = document.createElement('div');
        hotel.className = 'hotel';
        houseContainer.appendChild(hotel);
      } else {
        // Show houses
        for (let i = 0; i < property.house_count; i++) {
          const house = document.createElement('div');
          house.className = 'house';
          houseContainer.appendChild(house);
        }
      }

      spaceElement.appendChild(houseContainer);
    }
  }

  public updatePlayerPosition(playerId: number, position: number, playerIndex: number): Promise<void> {
    return new Promise((resolve) => {
      let token = this.playerTokens.get(playerId);
      
      if (!token) {
        // Create new token if it doesn't exist
        token = document.createElement('div');
        token.classList.add('player-token');
        token.style.backgroundColor = this.playerColors[playerIndex % this.playerColors.length];
        this.boardElement.appendChild(token);
        this.playerTokens.set(playerId, token);
      }

      // Find the target space element
      const spaceElement = this.boardElement.querySelector(`.pos-${position}`);
      if (spaceElement instanceof HTMLElement) {
        const rect = spaceElement.getBoundingClientRect();
        const boardRect = this.boardElement.getBoundingClientRect();
        
        // Calculate relative position within the board
        const relativeTop = rect.top - boardRect.top;
        const relativeLeft = rect.left - boardRect.left;

        // Calculate offset for multiple players on same space
        const tokenCount = Array.from(this.playerTokens.values())
          .filter(t => t.style.top === `${relativeTop}px` && t.style.left === `${relativeLeft}px`)
          .length;
        
        const offset = 12 * tokenCount;

        // Animate the token to new position
        token.style.transition = 'all 0.5s ease-in-out';
        token.style.top = `${relativeTop + 30 + Math.floor(offset / 2)}px`;
        token.style.left = `${relativeLeft + 30 + (offset % 24)}px`;

        // Listen for the transition end to resolve the promise
        token.addEventListener('transitionend', () => resolve(), { once: true });
      } else {
        // If space not found, resolve immediately
        resolve();
      }
    });
  }
}

export default MonopolyBoard; 