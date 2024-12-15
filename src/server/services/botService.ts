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

  private static shouldBotBuyProperty(bot: Player, propertyPrice: number | undefined, ownedProperties: Property[]): boolean {
    if (!propertyPrice) return false;
    
    // Don't buy if it would leave less than $200 in reserve
    const reserveAmount = 200;
    if (bot.balance - propertyPrice < reserveAmount) return false;

    // More likely to buy if bot has more money
    const wealthFactor = bot.balance / propertyPrice;
    if (wealthFactor > 3) return true; // Definitely buy if bot has 3x the property price

    // More likely to buy if bot owns few properties
    const propertyCountFactor = ownedProperties.length < 3;
    
    // Combined decision based on multiple factors
    return wealthFactor > 2 || propertyCountFactor;
  }

  private static shouldPayRent(bot: Player, rentAmount: number): boolean {
    // Bot must pay rent if possible
    return bot.balance >= rentAmount;
  }

  private static calculatePropertyValue(property: Property, ownedProperties: Property[]): number {
    let value = property.price || 0;
    
    // Check if bot owns properties of the same color
    const sameColorProperties = ownedProperties.filter(p => 
      BOARD_SPACES[p.position].color === BOARD_SPACES[property.position].color
    );
    
    // Properties become more valuable if bot owns others in the same color group
    if (sameColorProperties.length > 0) {
      value *= (1 + (sameColorProperties.length * 0.5));
    }
    
    return value;
  }

  public static async makeDecision(
    bot: Player,
    gameState: GameState,
    currentProperty: Property | null,
    properties: Property[]
  ): Promise<BotDecision> {
    console.log('Bot making decision:', {
      botName: bot.username,
      position: bot.position,
      balance: bot.balance,
      currentProperty
    });

    // Get bot's owned properties
    const ownedProperties = await this.getOwnedProperties(bot);
    console.log('Bot owned properties:', ownedProperties);

    // Handle property purchase decision
    if (currentProperty && !currentProperty.ownerId) {
      const propertyValue = this.calculatePropertyValue(currentProperty, ownedProperties);
      const shouldBuy = this.shouldBotBuyProperty(bot, propertyValue, ownedProperties);
      
      console.log('Bot purchase decision:', {
        property: currentProperty.name,
        propertyValue,
        shouldBuy
      });

      if (shouldBuy) {
        return {
          action: 'buy',
          property: currentProperty
        };
      }
    }

    // Handle rent payment
    if (currentProperty && currentProperty.ownerId && currentProperty.ownerId !== bot.id) {
      const rentAmount = currentProperty.rentAmount || 0;
      const shouldPay = this.shouldPayRent(bot, rentAmount);
      
      console.log('Bot rent decision:', {
        property: currentProperty.name,
        rentAmount,
        shouldPay
      });

      if (shouldPay) {
        return {
          action: 'pay_rent',
          property: currentProperty
        };
      }
    }

    // Default to ending turn if no other action is needed
    console.log('Bot ending turn - no actions available');
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