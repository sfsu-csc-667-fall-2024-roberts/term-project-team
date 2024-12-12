import { BOARD_SPACES, BoardSpace } from '../../shared/boardData';
import { ApiError, Player, Property, PurchaseResponse } from './types';

class MonopolyBoard {
  private container: HTMLElement;
  private centerArea: HTMLDivElement;
  private playerTokens: Map<number, HTMLElement>;
  private propertyOwnership: Map<number, number>;
  private promptBuying: boolean;

  constructor(containerId: string) {
    const element = document.getElementById(containerId);
    if (!element) {
      throw new Error(`Element with id ${containerId} not found`);
    }
    this.container = element;
    this.centerArea = document.createElement('div');
    this.playerTokens = new Map();
    this.propertyOwnership = new Map();
    this.promptBuying = false;
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
    this.resetCenter();
    this.centerArea.className = 'board-center';
    this.container.appendChild(this.centerArea);
  }

  private createBoardSpace(space: BoardSpace): HTMLElement {
    const spaceElement = document.createElement('div');
    spaceElement.className = `board-space pos-${space.position}`;
    
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

    spaceElement.addEventListener('mouseover', () => {
      if (!this.promptBuying) {
        const element = spaceElement.cloneNode(true) as HTMLDivElement;
        element.classList.remove(`pos-${space.position}`);
        element.classList.add('board-center-card');
        element.getElementsByClassName('player-token')[0]?.remove();
        this.setCenter(element);
      }
    })

    spaceElement.addEventListener('mouseleave', () => {
      if (!this.promptBuying) {
        this.resetCenter();
      }
    })

    return spaceElement;
  }

  public updatePlayerPosition(playerId: number, position: number, playerIndex: number): Promise<void> {
    return new Promise(resolve => {
      // Remove existing token if any
      const existingToken = this.playerTokens.get(playerId);
      if (existingToken) {
        existingToken.remove();
      }

      // Create new token
      const token = document.createElement('div');
      token.className = 'player-token';
      token.classList.add(`player-${playerIndex}`);

      // Find the target space
      const targetSpace = this.container.querySelector(`.pos-${position}`) as HTMLElement;
      if (targetSpace) {
        // Calculate center position of the space
        const rect = targetSpace.getBoundingClientRect();
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;
        
        token.style.left = `${centerX}px`;
        token.style.top = `${centerY}px`;
        
        targetSpace.appendChild(token);
        this.playerTokens.set(playerId, token);
      }

      // Add animation class for movement
      token.classList.add('token-move');

      // Remove animation class after animation completes
      setTimeout(() => {
        token.classList.remove('token-move');
        resolve();
      }, 500);
    });
  }

  public updatePropertyOwnership(property: Property, playerIndex: number): void {
    const spaceElement = this.container.querySelector(`.pos-${property.position}`) as HTMLElement;
    if (spaceElement) {
      // Remove any existing ownership indicators
      const existingIndicator = spaceElement.querySelector('.property-owner-indicator');
      if (existingIndicator) {
        existingIndicator.remove();
      }

      if (property.owner_id !== null && property.owner_id !== undefined) {
        const indicator = document.createElement('div');
        indicator.className = `property-owner-indicator owner-${playerIndex}`;
        spaceElement.appendChild(indicator);
      }

      this.propertyOwnership.set(property.position, property.owner_id || -1);
    }
  }

  public showBuyOption(player: Player, cb: () => void): void {
    const position = player.position;
    const ownedProperty = this.propertyOwnership.get(position);
    const property = BOARD_SPACES[position];
    if (ownedProperty !== undefined) {
      // TODO: Implement rent logic
      cb();
    } else if (property.price && player.balance >= property.price) {
      this.promptBuying = true;

      const container = document.createElement('div');
      container.className = 'board-center-prompt';

      // board card
      const targetSpace = this.container.querySelector(`.pos-${position}`) as HTMLElement;
      const element = targetSpace.cloneNode(true) as HTMLDivElement;
      element.classList.remove(`pos-${position}`);
      element.classList.add('board-center-card');
      element.getElementsByClassName('player-token')[0]?.remove();
      const card = document.createElement('div');
      card.className = 'board-center-card-wrapper';
      card.appendChild(element);
      container.appendChild(card);

      // buttons
      const buttons = document.createElement('div');
      buttons.className = 'board-center-options';
      const buy = document.createElement('button');
      buy.className = 'btn btn-primary';
      buy.innerText = 'Buy'
      const skip = document.createElement('button');
      skip.className = 'btn btn-secondary';
      skip.innerText = 'Skip'
      buttons.appendChild(buy);
      buttons.appendChild(skip)
      container.appendChild(buttons);
  
      // FIXME: Not working at the moment
      buy.addEventListener('click', async () => {
        try {
          const response = await fetch(`/game/${window.gameData.gameId}/properties/${position}/buy`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            }
          });

          const data = await response.json();

          if (!response.ok) {
            const errorData = data as ApiError;
            throw new Error(errorData.error || 'Failed to purchase property');
          }

          const purchaseData = data as PurchaseResponse;

          // Update player's balance
          player.balance = purchaseData.playerBalance;

          // Update property ownership display
          this.updatePropertyOwnership(purchaseData.property, player.id);
        } catch (error) {
          console.error('Purchase error:', error);
        } finally {
          this.resetCenter();
          cb();
        }
      });

      skip.addEventListener('click', () => {
        this.promptBuying = false;
        this.resetCenter();
        cb();
      });
  
      this.setCenter(container);
    } else {
      this.resetCenter();
      cb();
    }
  }

  public setCenter(content: HTMLElement): void {
    this.centerArea.innerHTML = "";
    this.centerArea.appendChild(content);
  }

  public resetCenter(): void {
    this.centerArea.innerHTML = "<div class='board-center-monopoly'>MONOPOLY</div>";
  }
}

export default MonopolyBoard; 