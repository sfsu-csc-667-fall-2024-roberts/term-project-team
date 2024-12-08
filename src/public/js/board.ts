import { BOARD_SPACES, calculateSpacePosition, BoardSpace } from '@shared/boardData';

class MonopolyBoard {
  private boardElement: HTMLElement;
  private playerTokens: Map<number, HTMLElement> = new Map();

  constructor(elementId: string) {
    const element = document.getElementById(elementId);
    if (!element) {
      throw new Error(`Element with id ${elementId} not found`);
    }
    this.boardElement = element;
    this.initializeBoard();
  }

  private initializeBoard() {
    // Create spaces in order to maintain proper DOM structure
    const orderedSpaces = [...BOARD_SPACES].sort((a, b) => a.position - b.position);
    orderedSpaces.forEach(space => {
      const spaceElement = this.createSpaceElement(space);
      this.boardElement.appendChild(spaceElement);
    });
  }

  private getSideClass(position: number): string {
    if (position >= 0 && position <= 9) return 'bottom-row';
    if (position >= 10 && position <= 19) return 'left-column';
    if (position >= 20 && position <= 29) return 'top-row';
    if (position >= 30 && position <= 39) return 'right-column';
    return '';
  }

  private getCornerClass(position: number): string {
    switch (position) {
      case 0: return 'corner bottom-right';
      case 10: return 'corner bottom-left';
      case 20: return 'corner top-left';
      case 30: return 'corner top-right';
      default: return '';
    }
  }

  private isCorner(position: number): boolean {
    return position === 0 || position === 10 || position === 20 || position === 30;
  }

  private createSpaceElement(space: BoardSpace): HTMLElement {
    const spaceElement = document.createElement('div');
    const isCorner = this.isCorner(space.position);

    // Add base classes
    spaceElement.classList.add('board-space');
    spaceElement.classList.add(`pos-${space.position}`);

    // Add side class if not a corner
    if (!isCorner) {
      spaceElement.classList.add(this.getSideClass(space.position));
    } else {
      spaceElement.classList.add(this.getCornerClass(space.position));
    }

    // Add type-specific class
    spaceElement.classList.add(`space-${space.type}`);

    // Create content wrapper
    const contentWrapper = document.createElement('div');
    contentWrapper.classList.add('space-content');

    // Add color bar for properties
    if (space.type === 'property' && space.color) {
      const colorBar = document.createElement('div');
      colorBar.classList.add('property-color-bar', `color-${space.color.toLowerCase()}`);
      contentWrapper.appendChild(colorBar);
    }

    // Add info div
    const infoDiv = document.createElement('div');
    infoDiv.classList.add('property-info');

    // Add name
    const nameDiv = document.createElement('div');
    nameDiv.classList.add('property-name');
    nameDiv.textContent = space.name;
    infoDiv.appendChild(nameDiv);

    // Add price if exists
    if (space.price) {
      const priceDiv = document.createElement('div');
      priceDiv.classList.add('property-price');
      priceDiv.textContent = `$${space.price}`;
      infoDiv.appendChild(priceDiv);
    }

    contentWrapper.appendChild(infoDiv);
    spaceElement.appendChild(contentWrapper);
    return spaceElement;
  }

  public updatePlayerPosition(playerId: number, position: number, color: string) {
    let token = this.playerTokens.get(playerId);
    
    if (!token) {
      token = document.createElement('div');
      token.classList.add('player-token');
      token.style.backgroundColor = color;
      this.boardElement.appendChild(token);
      this.playerTokens.set(playerId, token);
    }

    const spaceElement = this.boardElement.querySelector(`.pos-${position}`);
    if (spaceElement) {
      const rect = spaceElement.getBoundingClientRect();
      const boardRect = this.boardElement.getBoundingClientRect();
      
      // Calculate position relative to board
      const relativeTop = rect.top - boardRect.top;
      const relativeLeft = rect.left - boardRect.left;
      
      // Add offset for multiple tokens
      const offset = 12 * (this.playerTokens.size % 4);
      
      token.style.top = `${relativeTop + 30 + Math.floor(offset / 24)}px`;
      token.style.left = `${relativeLeft + 30 + (offset % 24)}px`;
    }
  }
}

export default MonopolyBoard; 