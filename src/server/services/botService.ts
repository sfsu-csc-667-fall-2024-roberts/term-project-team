import { Player, Property, GameState } from '../db/models/types';
import { BOARD_SPACES } from '../../shared/boardData';

interface BotDecision {
  action: 'buy' | 'pass' | 'pay_rent' | 'end_turn';
  property?: Property;
}

export class BotService {
  private static readonly PROPERTY_VALUE_THRESHOLD = 0.4;

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

    // If property is owned by another player, pay rent
    if (currentProperty.owner_id && currentProperty.owner_id !== bot.id) {
      return { action: 'pay_rent', property: currentProperty };
    }

    // If property is unowned, decide whether to buy
    if (!currentProperty.owner_id) {
      const shouldBuy = this.shouldBuyProperty(bot, currentProperty, allProperties);
      return {
        action: shouldBuy ? 'buy' : 'pass',
        property: currentProperty
      };
    }

    return { action: 'end_turn' };
  }

  private static shouldBuyProperty(
    bot: Player,
    property: Property,
    allProperties: Property[]
  ): boolean {
    const boardSpace = BOARD_SPACES[property.position];
    if (!boardSpace || boardSpace.type !== 'property') return false;

    // Get property price from board data
    const price = boardSpace.price || 0;

    // Basic strategy checks
    const canAfford = bot.balance >= price;
    const isGoodValue = price <= bot.balance * this.PROPERTY_VALUE_THRESHOLD;

    // Strategy-specific logic
    const strategy = bot.bot_strategy ?? 'balanced';
    switch (strategy) {
      case 'aggressive':
        // Buy if can afford and has less than 70% of properties
        const ownedCount = allProperties.filter(p => p.owner_id === bot.id).length;
        return canAfford && (ownedCount / allProperties.length < 0.7);

      case 'conservative':
        // Only buy if it's a really good deal and bot has lots of money
        return canAfford && (price <= bot.balance * 0.25);

      case 'balanced':
      default:
        // Default balanced strategy
        return canAfford && isGoodValue;
    }
  }

  static generateBotName(strategy: string, difficulty: string): string {
    const strategyNames = {
      aggressive: ['Risky', 'Bold', 'Daring'],
      conservative: ['Careful', 'Prudent', 'Wise'],
      balanced: ['Steady', 'Balanced', 'Smart']
    };
    
    const difficultyNames = {
      easy: ['Rookie', 'Novice', 'Beginner'],
      medium: ['Player', 'Trader', 'Dealer'],
      hard: ['Pro', 'Expert', 'Master']
    };

    const strategyName = strategyNames[strategy as keyof typeof strategyNames]?.[Math.floor(Math.random() * 3)] || 'Bot';
    const difficultyName = difficultyNames[difficulty as keyof typeof difficultyNames]?.[Math.floor(Math.random() * 3)] || '';
    
    return `${strategyName} ${difficultyName}`;
  }
} 