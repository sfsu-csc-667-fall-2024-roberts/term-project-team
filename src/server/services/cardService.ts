import { Card, CardAction } from '../../shared/types';

class CardService {
  private chanceCards: Card[];
  private communityChestCards: Card[];
  private gameId: number;

  constructor(gameId: number) {
    this.gameId = gameId;
    this.chanceCards = this.initializeChanceCards();
    this.communityChestCards = this.initializeCommunityChestCards();
  }

  drawChanceCard(): Card {
    if (this.chanceCards.length === 0) {
      this.chanceCards = this.initializeChanceCards();
    }
    const index = Math.floor(Math.random() * this.chanceCards.length);
    const [card] = this.chanceCards.splice(index, 1);
    return card;
  }

  drawCommunityChestCard(): Card {
    if (this.communityChestCards.length === 0) {
      this.communityChestCards = this.initializeCommunityChestCards();
    }
    const index = Math.floor(Math.random() * this.communityChestCards.length);
    const [card] = this.communityChestCards.splice(index, 1);
    return card;
  }

  private initializeChanceCards(): Card[] {
    return [
      {
        type: 'chance',
        text: 'Advance to GO',
        action: {
          type: 'move',
          destination: 0
        }
      },
      {
        type: 'chance',
        text: 'Advance to Illinois Avenue',
        action: {
          type: 'move',
          destination: 24
        }
      },
      {
        type: 'chance',
        text: 'Advance to nearest Railroad',
        action: {
          type: 'move_to_nearest',
          propertyType: 'railroad'
        }
      },
      {
        type: 'chance',
        text: 'Bank pays you dividend of $50',
        action: {
          type: 'collect',
          value: 50
        }
      },
      {
        type: 'chance',
        text: 'Go to Jail',
        action: {
          type: 'jail'
        }
      }
    ];
  }

  private initializeCommunityChestCards(): Card[] {
    return [
      {
        type: 'community_chest',
        text: 'Advance to GO',
        action: {
          type: 'move',
          destination: 0
        }
      },
      {
        type: 'community_chest',
        text: 'Bank error in your favor. Collect $200',
        action: {
          type: 'collect',
          value: 200
        }
      },
      {
        type: 'community_chest',
        text: 'Doctor\'s fee. Pay $50',
        action: {
          type: 'pay',
          value: 50
        }
      },
      {
        type: 'community_chest',
        text: 'Get Out of Jail Free',
        action: {
          type: 'jail_free'
        }
      },
      {
        type: 'community_chest',
        text: 'Go to Jail',
        action: {
          type: 'jail'
        }
      }
    ];
  }
}

export const cardService = new CardService(0); 