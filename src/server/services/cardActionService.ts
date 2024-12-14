import { Card, Player, GameState, Property } from '../../shared/types';
import { BOARD_SPACES } from '../../shared/boardData';
import { updatePlayerState, updateGameState } from '../db/services/dbService';

export class CardActionService {
  private gameId: number;
  private players: Player[];
  private gameState: GameState;
  private properties: Property[];

  constructor(gameId: number, players: Player[], gameState: GameState, properties: Property[]) {
    this.gameId = gameId;
    this.players = players;
    this.gameState = gameState;
    this.properties = properties;
  }

  public async executeCardAction(card: Card, player: Player): Promise<{
    gameState: GameState;
    players: Player[];
    message: string;
  }> {
    console.log(`Executing card action for player ${player.username}:`, card);
    
    switch (card.action.type) {
      case 'move':
        return await this.handleMoveAction(card, player);
      case 'collect':
        return await this.handleCollectAction(card, player);
      case 'pay':
        return await this.handlePayAction(card, player);
      case 'jail':
        return await this.handleJailAction(player);
      case 'repair':
        return await this.handleRepairAction(card, player);
      case 'move_nearest':
        return await this.handleMoveNearestAction(card, player);
      case 'get_out_of_jail':
        return await this.handleGetOutOfJailAction(card, player);
      case 'collect_from_players':
        return await this.handleCollectFromPlayersAction(card, player);
      default:
        throw new Error('Unknown card action type');
    }
  }

  private async handleMoveAction(card: Card, player: Player): Promise<any> {
    const oldPosition = player.position;
    let newPosition: number;
    
    if (card.action.destination !== undefined) {
      newPosition = card.action.destination;
    } else if (card.action.value !== undefined) {
      newPosition = (oldPosition + card.action.value + BOARD_SPACES.length) % BOARD_SPACES.length;
    } else {
      throw new Error('Invalid move action: no destination or value specified');
    }

    // Check if passing GO
    const passedGo = (newPosition < oldPosition && card.action.value !== -3) || newPosition === 0;
    if (passedGo) {
      player.balance += 200;
    }

    player.position = newPosition;
    await updatePlayerState(player.id, {
      position: newPosition,
      balance: player.balance
    });

    return {
      gameState: this.gameState,
      players: this.players,
      message: `${player.username} moved to ${BOARD_SPACES[newPosition].name}${passedGo ? ' and collected $200 for passing GO' : ''}`
    };
  }

  private async handleCollectAction(card: Card, player: Player): Promise<any> {
    if (!card.action.value) throw new Error('Collect action missing value');
    
    player.balance += card.action.value;
    await updatePlayerState(player.id, {
      balance: player.balance
    });

    return {
      gameState: this.gameState,
      players: this.players,
      message: `${player.username} collected $${card.action.value}`
    };
  }

  private async handlePayAction(card: Card, player: Player): Promise<any> {
    if (!card.action.value) throw new Error('Pay action missing value');
    
    player.balance -= card.action.value;
    await updatePlayerState(player.id, {
      balance: player.balance
    });

    return {
      gameState: this.gameState,
      players: this.players,
      message: `${player.username} paid $${card.action.value}`
    };
  }

  private async handleJailAction(player: Player): Promise<any> {
    player.position = 10; // Jail position
    player.jailed = true;
    await updatePlayerState(player.id, {
      position: player.position,
      jailed: player.jailed
    });

    return {
      gameState: this.gameState,
      players: this.players,
      message: `${player.username} was sent to Jail`
    };
  }

  private async handleRepairAction(card: Card, player: Player): Promise<any> {
    if (!card.action.value || !card.action.hotelValue) {
      throw new Error('Repair action missing house or hotel value');
    }

    const playerProperties = this.properties.filter(p => p.owner_id === player.id);
    let totalCost = 0;

    playerProperties.forEach(property => {
      if (property.house_count === 5) { // Hotel
        totalCost += card.action.hotelValue!;
      } else {
        totalCost += property.house_count * card.action.value!;
      }
    });

    player.balance -= totalCost;
    await updatePlayerState(player.id, {
      balance: player.balance
    });

    return {
      gameState: this.gameState,
      players: this.players,
      message: `${player.username} paid $${totalCost} for repairs`
    };
  }

  private async handleMoveNearestAction(card: Card, player: Player): Promise<any> {
    if (!card.action.propertyType) throw new Error('Move nearest action missing property type');

    const currentPos = player.position;
    const propertyType = card.action.propertyType;
    
    // Find next property of specified type
    let nearestPosition = -1;
    let passedGo = false;

    for (let i = (currentPos + 1) % BOARD_SPACES.length; i !== currentPos; i = (i + 1) % BOARD_SPACES.length) {
      if (BOARD_SPACES[i].type === propertyType) {
        nearestPosition = i;
        passedGo = i < currentPos;
        break;
      }
    }

    if (nearestPosition === -1) throw new Error(`No ${propertyType} found`);

    // Move player
    player.position = nearestPosition;
    if (passedGo) player.balance += 200;
    
    await updatePlayerState(player.id, {
      position: player.position,
      balance: player.balance
    });

    return {
      gameState: this.gameState,
      players: this.players,
      message: `${player.username} moved to ${BOARD_SPACES[nearestPosition].name}${passedGo ? ' and collected $200 for passing GO' : ''}`
    };
  }

  private async handleGetOutOfJailAction(card: Card, player: Player): Promise<any> {
    if (!this.gameState.jail_free_cards) {
      this.gameState.jail_free_cards = {};
    }
    
    this.gameState.jail_free_cards[player.id] = (this.gameState.jail_free_cards[player.id] || 0) + 1;
    await updateGameState(this.gameId, this.gameState);

    return {
      gameState: this.gameState,
      players: this.players,
      message: `${player.username} received a Get Out of Jail Free card`
    };
  }

  private async handleCollectFromPlayersAction(card: Card, player: Player): Promise<any> {
    if (!card.action.value) throw new Error('Collect from players action missing value');
    
    const amount = card.action.value;
    let totalCollected = 0;

    // Collect from each other player
    for (const otherPlayer of this.players) {
      if (otherPlayer.id !== player.id) {
        otherPlayer.balance -= amount;
        totalCollected += amount;
        await updatePlayerState(otherPlayer.id, {
          balance: otherPlayer.balance
        });
      }
    }

    player.balance += totalCollected;
    await updatePlayerState(player.id, {
      balance: player.balance
    });

    return {
      gameState: this.gameState,
      players: this.players,
      message: `${player.username} collected $${amount} from each player (total: $${totalCollected})`
    };
  }
} 