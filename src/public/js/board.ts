import { BOARD_SPACES, BoardSpace } from '../../shared/boardData';

class MonopolyBoard {
  private boardElement: HTMLElement;

  constructor(elementId: string) {
    console.log('MonopolyBoard constructor called with id:', elementId);
    const element = document.getElementById(elementId);
    if (!element) {
      throw new Error(`Element with id ${elementId} not found`);
    }
    this.boardElement = element;
    console.log('Board element found:', element);
    this.initializeBoard();
  }

  private initializeBoard() {
    console.log('Initializing board with spaces:', BOARD_SPACES.length);
    // Create spaces in order to maintain proper DOM structure
    const orderedSpaces = [...BOARD_SPACES].sort((a, b) => a.position - b.position);
    console.log('Ordered spaces:', orderedSpaces);
    orderedSpaces.forEach(space => {
      const spaceElement = this.createSpaceElement(space);
      this.boardElement.appendChild(spaceElement);
      console.log(`Added space ${space.name} at position ${space.position}`);
    });
  }

  private createSpaceElement(space: BoardSpace): HTMLElement {
    const spaceElement = document.createElement('div');
    
    // Add base class and position class
    spaceElement.classList.add('board-space');
    spaceElement.classList.add(`pos-${space.position}`);
    spaceElement.classList.add(`space-${space.type}`);

    // Add side class for rotation
    if (space.position >= 0 && space.position <= 9) {
      spaceElement.classList.add('bottom-row');
    } else if (space.position >= 10 && space.position <= 19) {
      spaceElement.classList.add('left-column');
    } else if (space.position >= 20 && space.position <= 29) {
      spaceElement.classList.add('top-row');
    } else if (space.position >= 30 && space.position <= 39) {
      spaceElement.classList.add('right-column');
    }

    // Create content wrapper
    const contentWrapper = document.createElement('div');
    contentWrapper.classList.add('space-content');

    if (space.type === 'property') {
      // Handle property spaces
      if (space.color) {
        const colorBar = document.createElement('div');
        colorBar.classList.add('property-color-bar');
        colorBar.classList.add(`color-${space.color.toLowerCase()}`);
        contentWrapper.appendChild(colorBar);
      }

      const infoDiv = document.createElement('div');
      infoDiv.classList.add('property-info');

      const nameDiv = document.createElement('div');
      nameDiv.classList.add('property-name');
      nameDiv.textContent = space.name;
      infoDiv.appendChild(nameDiv);

      if (space.price) {
        const priceDiv = document.createElement('div');
        priceDiv.classList.add('property-price');
        priceDiv.textContent = `$${space.price}`;
        infoDiv.appendChild(priceDiv);
      }

      contentWrapper.appendChild(infoDiv);
    } else {
      // Handle non-property spaces
      const nameDiv = document.createElement('div');
      nameDiv.classList.add('space-name');
      nameDiv.textContent = space.name;
      contentWrapper.appendChild(nameDiv);

      if (space.price) {
        const priceDiv = document.createElement('div');
        priceDiv.classList.add('space-price');
        priceDiv.textContent = `$${space.price}`;
        contentWrapper.appendChild(priceDiv);
      }
    }

    spaceElement.appendChild(contentWrapper);
    return spaceElement;
  }
}

export default MonopolyBoard; 