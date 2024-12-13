import { Player, Property, GameState } from '../db/models/types';
import { BOARD_SPACES } from '../../shared/boardData';

interface BotDecision {
  action: 'buy' | 'pass' | 'pay_rent' | 'end_turn';
  property?: Property;
}

export class BotService {
  static generateBotName(strategy: string, difficulty: string): string {
    const strategyAdjectives = {
      aggressive: ['Bold', 'Fierce', 'Daring'],
      conservative: ['Steady', 'Careful', 'Prudent'],
      balanced: ['Smart', 'Balanced', 'Wise']
    };

    const difficultyNouns = {
      easy: ['Novice', 'Beginner', 'Rookie'],
      medium: ['Player', 'Trader', 'Investor'],
      hard: ['Expert', 'Master', 'Pro']
    };

    const adjectives = strategyAdjectives[strategy as keyof typeof strategyAdjectives] || strategyAdjectives.balanced;
    const nouns = difficultyNouns[difficulty as keyof typeof difficultyNouns] || difficultyNouns.medium;

    const adjective = adjectives[Math.floor(Math.random() * adjectives.length)];
    const noun = nouns[Math.floor(Math.random() * nouns.length)];

    return `${adjective} ${noun}`;
  }

  static async makeDecision(
    bot: Player,
    gameState: GameState,
    currentProperty: Property | null,
    allProperties: Property[]
  ): Promise<BotDecision> {
    // If no property to act on, end turn
    if (!currentProperty) {
      return { action: 'end_turn' };
    }

    // If property is owned by someone else, pay rent
    if (currentProperty.owner_id && currentProperty.owner_id !== bot.id) {
      return {
        action: 'pay_rent',
        property: currentProperty
      };
    }

    // If property is unowned, decide whether to buy based on strategy
    if (!currentProperty.owner_id) {
      const propertyData = BOARD_SPACES.find(space => space.position === currentProperty.position);
      if (!propertyData || !('price' in propertyData)) {
        return { action: 'pass' };
      }

      const price = propertyData.price as number;
      const shouldBuy = this.shouldBotBuyProperty(bot, price);

      if (shouldBuy && bot.balance >= price) {
        return {
          action: 'buy',
          property: currentProperty
        };
      }
    }

    // Default to ending turn
    return { action: 'end_turn' };
  }

  private static shouldBotBuyProperty(bot: Player, price: number): boolean {
    // Default to balanced strategy
    let buyThreshold = 0.3; // Will buy if price is less than 30% of balance

    switch (bot.bot_strategy) {
      case 'aggressive':
        buyThreshold = 0.5; // Will buy if price is less than 50% of balance
        break;
      case 'conservative':
        buyThreshold = 0.2; // Will buy if price is less than 20% of balance
        break;
      case 'balanced':
      default:
        buyThreshold = 0.3;
    }

    // Adjust threshold based on difficulty
    switch (bot.bot_difficulty) {
      case 'easy':
        buyThreshold *= 0.8; // 20% less likely to buy
        break;
      case 'hard':
        buyThreshold *= 1.2; // 20% more likely to buy
        break;
    }

    return price <= bot.balance * buyThreshold;
  }
} 