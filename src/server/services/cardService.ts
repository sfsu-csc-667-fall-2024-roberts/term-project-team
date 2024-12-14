import { Card } from '../../shared/types';
import { CHANCE_CARDS, COMMUNITY_CHEST_CARDS } from '../../shared/cardData';

export class CardService {
  private chanceCards: Card[];
  private communityChestCards: Card[];
  private gameId: number;

  constructor(gameId: number) {
    this.gameId = gameId;
    this.chanceCards = this.shuffleArray([...CHANCE_CARDS]);
    this.communityChestCards = this.shuffleArray([...COMMUNITY_CHEST_CARDS]);
  }

  public drawChanceCard(): Card {
    if (this.chanceCards.length === 0) {
      // Reshuffle when deck is empty
      this.chanceCards = this.shuffleArray([...CHANCE_CARDS]);
    }
    return this.chanceCards.pop()!;
  }

  public drawCommunityChestCard(): Card {
    if (this.communityChestCards.length === 0) {
      // Reshuffle when deck is empty
      this.communityChestCards = this.shuffleArray([...COMMUNITY_CHEST_CARDS]);
    }
    return this.communityChestCards.pop()!;
  }

  public returnCardToDeck(card: Card): void {
    if (card.type === 'chance') {
      this.chanceCards.unshift(card);
    } else {
      this.communityChestCards.unshift(card);
    }
  }

  private shuffleArray<T>(array: T[]): T[] {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }

  public getJailFreeCard(type: 'chance' | 'chest'): Card | undefined {
    const deck = type === 'chance' ? this.chanceCards : this.communityChestCards;
    const index = deck.findIndex(card => card.action.type === 'get_out_of_jail');
    if (index !== -1) {
      return deck.splice(index, 1)[0];
    }
    return undefined;
  }
} 