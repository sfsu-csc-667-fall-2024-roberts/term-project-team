import { Player, Property, GameState } from '../db/models/types';
import { BOARD_SPACES } from '../../shared/boardData';
import * as dbService from '../db/services/dbService';

interface BotDecision {
  action: 'buy' | 'pass' | 'pay_rent' | 'end_turn';
  property?: Property;
}

export class BotService {
  private static async getOwnedProperties(bot: Player): Promise<Property[]> {
    return await dbService.getPropertiesByOwnerId(bot.id);
  }

  private static shouldBotBuyProperty(bot: Player, price: number, ownedProperties: Property[]): boolean {
    // Get bot's strategy and difficulty
    const strategy = bot.bot_strategy || 'balanced';
    const difficulty = bot.bot_difficulty || 'medium';

    // Define thresholds based on strategy and difficulty
    let buyThreshold = 0.3; // Default threshold
    let maxOwnershipPercentage = 0.5; // Default max ownership

    // Adjust thresholds based on strategy
    switch (strategy) {
      case 'aggressive':
        buyThreshold = 0.5;
        maxOwnershipPercentage = 0.8;
        break;
      case 'conservative':
        buyThreshold = 0.2;
        maxOwnershipPercentage = 0.3;
        break;
      case 'balanced':
        buyThreshold = 0.3;
        maxOwnershipPercentage = 0.5;
        break;
    }

    // Adjust thresholds based on difficulty
    switch (difficulty) {
      case 'easy':
        buyThreshold *= 0.8;
        maxOwnershipPercentage *= 0.8;
        break;
      case 'hard':
        buyThreshold *= 1.2;
        maxOwnershipPercentage *= 1.2;
        break;
    }

    // Count total purchasable properties
    const totalProperties = BOARD_SPACES.filter(
      space => space.type === 'property' || space.type === 'railroad' || space.type === 'utility'
    ).length;

    // Calculate current ownership percentage
    const currentOwnershipPercentage = ownedProperties.length / totalProperties;

    // Check both price threshold and ownership percentage
    return price <= bot.balance * buyThreshold && 
           currentOwnershipPercentage < maxOwnershipPercentage;
  }

  public static async makeDecision(
    bot: Player,
    gameState: GameState,
    currentProperty: Property | null,
    properties: Property[]
  ): Promise<BotDecision> {
    // Get bot's owned properties
    const ownedProperties = await this.getOwnedProperties(bot);

    if (currentProperty && !currentProperty.ownerId) {
      // Decision to buy property
      if (this.shouldBotBuyProperty(bot, currentProperty.price, ownedProperties)) {
        return {
          action: 'buy',
          property: currentProperty
        };
      }
    }

    // Default to ending turn if no other action is needed
    return { action: 'end_turn' };
  }

  public static generateBotName(strategy: string, difficulty: string): string {
    const strategyNames = {
      aggressive: ['Risky', 'Bold', 'Daring'],
      conservative: ['Careful', 'Prudent', 'Wise'],
      balanced: ['Smart', 'Balanced', 'Steady']
    };

    const difficultyNames = {
      easy: ['Rookie', 'Novice', 'Beginner'],
      medium: ['Player', 'Trader', 'Dealer'],
      hard: ['Expert', 'Master', 'Pro']
    };

    const strategyList = strategyNames[strategy as keyof typeof strategyNames] || strategyNames.balanced;
    const difficultyList = difficultyNames[difficulty as keyof typeof difficultyNames] || difficultyNames.medium;

    const strategyName = strategyList[Math.floor(Math.random() * strategyList.length)];
    const difficultyName = difficultyList[Math.floor(Math.random() * difficultyList.length)];

    return `${strategyName} ${difficultyName}`;
  }
} 