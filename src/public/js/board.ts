import { ExtendedBoardSpace, Player, Property } from '../../shared/types';
import { BOARD_SPACES } from '../../shared/boardData';

export default class MonopolyBoard {
  private container!: HTMLElement;
  private playerTokens: Map<number, HTMLElement> = new Map();
  private propertyOwnership: Map<number, HTMLElement> = new Map();
  private playerColors = {
    base: [
      '#E53935', // Red
      '#43A047', // Green
      '#1E88E5', // Blue
      '#FDD835', // Yellow
      '#8E24AA', // Purple
      '#00ACC1', // Cyan
      '#FB8C00', // Orange
      '#6D4C41'  // Brown
    ],
    highlight: [
      '#FFCDD2', // Light Red
      '#C8E6C9', // Light Green
      '#BBDEFB', // Light Blue
      '#FFF9C4', // Light Yellow
      '#E1BEE7', // Light Purple
      '#B2EBF2', // Light Cyan
      '#FFE0B2', // Light Orange
      '#D7CCC8'  // Light Brown
    ]
  };
  private currentPlayerId: number = -1;
  private static instance: MonopolyBoard | null = null;

  constructor(containerId: string) {
    console.log('MonopolyBoard constructor called', { containerId });
    
    // If an instance exists and it's for the same container, return it
    if (MonopolyBoard.instance) {
      console.log('Existing board instance found');
      if (MonopolyBoard.instance.container.id === containerId) {
        console.log('Returning existing instance for same container');
        return MonopolyBoard.instance;
      }
      // If it's for a different container, clean up the old instance
      console.log('Cleaning up old instance for different container');
      MonopolyBoard.instance.cleanup();
    }

    const element = document.getElementById(containerId);
    if (!element) {
      throw new Error(`Element with id ${containerId} not found`);
    }
    console.log('Found board container:', element);

    this.container = element;
    this.initializeBoard();
    MonopolyBoard.instance = this;
  }

  private cleanup(): void {
    console.log('Cleaning up board instance');
    // Remove all player tokens
    this.playerTokens.forEach(token => token.remove());
    this.playerTokens.clear();

    // Remove all property ownership markers
    this.propertyOwnership.forEach(marker => marker.remove());
    this.propertyOwnership.clear();

    // Clear the container
    if (this.container) {
      this.container.innerHTML = '';
    }
  }

  private initializeBoard(): void {
    console.log('Initializing board');
    this.cleanup(); // Clean up any existing content
    
    // Create board wrapper
    const boardWrapper = document.createElement('div');
    boardWrapper.className = 'board-wrapper';
    this.container.appendChild(boardWrapper);

    // Add board spaces
    BOARD_SPACES.forEach((space: ExtendedBoardSpace) => {
      const spaceElement = this.createBoardSpace(space);
      boardWrapper.appendChild(spaceElement);
      console.log(`Created space: ${space.name} at position ${space.position}`);
    });

    // Add center area
    const centerArea = document.createElement('div');
    centerArea.className = 'board-center';
    centerArea.innerHTML = '<div class="board-center-monopoly">MONOPOLY</div>';
    boardWrapper.appendChild(centerArea);

    // Place player tokens
    if (window.monopolyGameData && window.monopolyGameData.players) {
      window.monopolyGameData.players.forEach((player: Player, index: number) => {
        this.updatePlayerPosition(player.id, player.position || 0, index);
      });

      // Update property ownership
      if (window.monopolyGameData.properties) {
        window.monopolyGameData.properties.forEach((property: Property) => {
          if (property.ownerId) {
            const ownerIndex = window.monopolyGameData.players.findIndex((p: Player) => p.id === property.ownerId);
            if (ownerIndex !== -1) {
              this.updatePropertyOwnership(property, ownerIndex);
            }
          }
        });
      }
    }

    console.log('Board initialization complete');
  }

  private createBoardSpace(space: ExtendedBoardSpace): HTMLElement {
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
    } else if (space.type === 'tax') {
      spaceElement.classList.add('space-tax');
    } else if (space.type === 'chance') {
      spaceElement.classList.add('space-chance');
    } else if (space.type === 'chest') {
      spaceElement.classList.add('space-chest');
    } else if (space.type === 'corner') {
      spaceElement.classList.add('space-corner');
      if (space.position === 0) {
        spaceElement.classList.add('bottom-right');
        const content = document.createElement('div');
        content.className = 'space-content';
        content.innerHTML = `
          <div class="space-name">${space.name}</div>
          <div class="space-action">COLLECT $200</div>
        `;
        spaceElement.appendChild(content);
        return spaceElement;
      }
      if (space.position === 10) spaceElement.classList.add('bottom-left');
      if (space.position === 20) spaceElement.classList.add('top-left');
      if (space.position === 30) spaceElement.classList.add('top-right');
    }

    // Create space content container
    const content = document.createElement('div');
    content.className = 'space-content';

    // Add color bar for properties
    if (space.type === 'property' && space.colorGroup) {
      const colorBar = document.createElement('div');
      colorBar.className = `property-color-bar ${space.colorGroup}`;
      console.log(`Creating color bar for ${space.name} with class ${space.colorGroup}`);
      content.appendChild(colorBar);
    }

    // Create info container
    const infoContainer = document.createElement('div');
    infoContainer.className = 'property-info';

    // Add name
    const nameDiv = document.createElement('div');
    nameDiv.className = 'property-name';
    nameDiv.textContent = space.name;
    infoContainer.appendChild(nameDiv);

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
    console.log(`Updating player ${playerId} to position ${position}`);
    let token = this.playerTokens.get(playerId);
    
    // Create token if it doesn't exist
    if (!token) {
      token = document.createElement('div');
      token.className = 'player-token';
      token.setAttribute('data-player-id', playerId.toString());
      token.style.backgroundColor = this.playerColors.base[playerIndex % this.playerColors.base.length];
      token.style.width = '24px';
      token.style.height = '24px';
      token.style.borderRadius = '50%';
      token.style.position = 'absolute';
      token.style.zIndex = '100';
      token.style.transition = 'all 0.5s ease-in-out';
      token.style.border = '2px solid white';
      token.style.boxShadow = '0 0 5px rgba(0,0,0,0.3)';
      this.container.appendChild(token);
      this.playerTokens.set(playerId, token);
    }

    // Update token position
    const space = this.container.querySelector(`[data-position="${position}"]`) as HTMLElement;
    if (!space) {
      console.error(`Space not found for position ${position}`);
      return;
    }

    const spaceRect = space.getBoundingClientRect();
    const boardRect = this.container.getBoundingClientRect();

    // Calculate relative position within the board
    let relativeX = spaceRect.left - boardRect.left + (spaceRect.width / 2) - 12;
    let relativeY = spaceRect.top - boardRect.top + (spaceRect.height / 2) - 12;

    // Add offset based on player index to prevent overlap
    const offset = playerIndex * 15;
    const isCorner = position % 10 === 0;
    
    if (isCorner) {
      // For corner spaces (including GO), arrange tokens in a grid
      const row = Math.floor(playerIndex / 2);
      const col = playerIndex % 2;
      
      // Special handling for GO space (position 0)
      if (position === 0) {
        relativeX = spaceRect.left - boardRect.left + spaceRect.width - 30 + (col * 25);
        relativeY = spaceRect.top - boardRect.top + spaceRect.height - 30 + (row * 25);
      } else {
        relativeX += (col * 25);
        relativeY += (row * 25);
      }
    } else {
      // For regular spaces, arrange tokens with offset
      const side = Math.floor(position / 10); // 0: bottom, 1: left, 2: top, 3: right
      
      switch (side) {
        case 0: // Bottom row
          relativeX += offset;
          break;
        case 1: // Left column
          relativeY += offset;
          break;
        case 2: // Top row
          relativeX += offset;
          break;
        case 3: // Right column
          relativeY += offset;
          break;
      }
    }
    
    // Set token position
    token.style.left = `${relativeX}px`;
    token.style.top = `${relativeY}px`;

    // Highlight current player's token
    if (this.currentPlayerId === playerId) {
      token.style.transform = 'scale(1.2)';
      token.style.boxShadow = `0 0 10px ${this.playerColors.highlight[playerIndex % this.playerColors.highlight.length]}`;
    } else {
      token.style.transform = 'scale(1)';
      token.style.boxShadow = '0 0 5px rgba(0,0,0,0.3)';
    }
  }

  private createTokensContainer(space: Element): Element {
    const container = document.createElement('div');
    container.className = 'tokens-container';
    space.appendChild(container);
    return container;
  }

  public updatePropertyOwnership(property: Property, ownerIndex: number): void {
    // Remove existing ownership marker if any
    const existingMarker = this.propertyOwnership.get(property.position);
    if (existingMarker) {
      existingMarker.remove();
    }

    // Create new ownership marker
    const marker = document.createElement('div');
    marker.className = 'property-ownership-marker';
    marker.style.backgroundColor = this.playerColors.base[ownerIndex % this.playerColors.base.length];
    marker.style.width = '10px';
    marker.style.height = '10px';
    marker.style.borderRadius = '50%';
    marker.style.position = 'absolute';
    marker.style.zIndex = '50';
    marker.style.border = '1px solid #000';
    marker.style.boxShadow = '0 0 2px rgba(0,0,0,0.3)';

    // Find the space element
    const spaceElement = this.container.querySelector(`[data-position="${property.position}"]`) as HTMLElement;
    if (!spaceElement) {
      console.error(`Space element not found for position ${property.position}`);
      return;
    }

    // Position the marker
    const spaceRect = spaceElement.getBoundingClientRect();
    const boardRect = this.container.getBoundingClientRect();
    const side = Math.floor(property.position / 10); // 0: bottom, 1: left, 2: top, 3: right

    // Calculate marker position based on the side of the board
    let left: number;
    let top: number;

    switch (side) {
      case 0: // Bottom row
        left = spaceRect.left - boardRect.left + 5;
        top = spaceRect.top - boardRect.top + 5;
        break;
      case 1: // Left column
        left = spaceRect.right - boardRect.left - 15;
        top = spaceRect.top - boardRect.top + 5;
        break;
      case 2: // Top row
        left = spaceRect.left - boardRect.left + 5;
        top = spaceRect.bottom - boardRect.top - 15;
        break;
      case 3: // Right column
        left = spaceRect.left - boardRect.left + 5;
        top = spaceRect.top - boardRect.top + 5;
        break;
      default:
        left = spaceRect.left - boardRect.left + 5;
        top = spaceRect.top - boardRect.top + 5;
    }

    marker.style.left = `${left}px`;
    marker.style.top = `${top}px`;

    // Add marker to the board and store reference
    this.container.appendChild(marker);
    this.propertyOwnership.set(property.position, marker);
  }

  public setCurrentPlayer(playerId: number): void {
    this.currentPlayerId = playerId;
    // Update token highlighting for all players
    this.playerTokens.forEach((token, tokenPlayerId) => {
      const playerIndex = Array.from(this.playerTokens.keys()).indexOf(tokenPlayerId);
      if (tokenPlayerId === playerId) {
        token.style.transform = 'scale(1.2)';
        token.style.boxShadow = `0 0 10px ${this.playerColors.highlight[playerIndex % this.playerColors.highlight.length]}`;
      } else {
        token.style.transform = 'scale(1)';
        token.style.boxShadow = '0 0 5px rgba(0,0,0,0.3)';
      }
    });
  }

  public getPlayerColor(playerIndex: number): string {
    const colors = [
        '#FF0000', // Red
        '#00FF00', // Green
        '#0000FF', // Blue
        '#FFFF00', // Yellow
        '#FF00FF', // Magenta
        '#00FFFF', // Cyan
        '#FFA500', // Orange
        '#800080'  // Purple
    ];
    return colors[playerIndex % colors.length];
  }

  public getPlayerHighlightColor(index: number): string {
    return this.playerColors.highlight[index % this.playerColors.highlight.length];
  }

  private getColorForProperty(color: string): string {
    const colorMap: { [key: string]: string } = {
      'brown': '#955436',
      'lightblue': '#AAE0FA',
      'pink': '#D93A96',
      'orange': '#F7941D',
      'red': '#ED1B24',
      'yellow': '#FEF200',
      'green': '#1FB25A',
      'blue': '#0072BB'
    };
    return colorMap[color] || '#ffffff';
  }
} 