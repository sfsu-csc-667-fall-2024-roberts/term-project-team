import { GameState, Player, Property, BotDecision } from '../../shared/types';

class BotService {
  makeDecision(
    bot: Player,
    gameState: GameState,
    currentProperty?: Property,
    properties?: Property[]
  ): BotDecision {
    if (!bot.isBot) {
      throw new Error('Player is not a bot');
    }

    // Default decision
    const decision: BotDecision = {
      type: 'PASS',
      playerId: bot.id,
      action: 'pass',
      data: {}
    };

    // If there's a property to buy
    if (currentProperty && !currentProperty.ownerId) {
      const shouldBuy = this.shouldBuyProperty(bot, currentProperty, properties || []);
      if (shouldBuy) {
        return {
          type: 'BUY',
          playerId: bot.id,
          action: 'buy_property',
          data: { propertyId: currentProperty.id },
          property: currentProperty
        };
      }
    }

    return decision;
  }

  private shouldBuyProperty(bot: Player, property: Property, properties: Property[]): boolean {
    // Basic strategy: Buy if can afford and don't own too many properties
    if (bot.money < property.price) {
      return false;
    }

    const ownedProperties = properties.filter(p => p.ownerId === bot.id);
    const ownedInGroup = ownedProperties.filter(p => p.colorGroup === property.colorGroup);

    switch (bot.botStrategy) {
      case 'aggressive':
        // Buy if can afford and would complete a color group
        return ownedInGroup.length > 0;

      case 'conservative':
        // Only buy if have plenty of money and property is cheap
        return bot.money > property.price * 3;

      case 'balanced':
      default:
        // Buy if can afford and don't own too many properties
        return ownedProperties.length < 8;
    }
  }

  calculateBotBid(bot: Player, property: Property, currentBid: number): number {
    const maxBid = this.getMaxBidAmount(bot, property);
    if (currentBid >= maxBid) {
      return 0; // Bot won't bid
    }

    // Calculate bid increment based on strategy
    let bidIncrement = 10; // Default increment
    switch (bot.botStrategy) {
      case 'aggressive':
        bidIncrement = 50;
        break;
      case 'conservative':
        bidIncrement = 5;
        break;
      case 'balanced':
        bidIncrement = 25;
        break;
    }

    return Math.min(currentBid + bidIncrement, maxBid);
  }

  private getMaxBidAmount(bot: Player, property: Property): number {
    // Calculate max bid based on strategy and available money
    let maxPercentage = 0.5; // Default to 50% of available money

    switch (bot.botStrategy) {
      case 'aggressive':
        maxPercentage = 0.8; // Willing to spend up to 80% of money
        break;
      case 'conservative':
        maxPercentage = 0.3; // Only willing to spend up to 30% of money
        break;
      case 'balanced':
        maxPercentage = 0.5; // Willing to spend up to 50% of money
        break;
    }

    return Math.floor(bot.money * maxPercentage);
  }
}

export const botService = new BotService(); 