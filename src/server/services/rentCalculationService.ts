import { Property, Player } from '../../shared/types';

export class RentCalculationService {
  private properties: Property[];
  private players: Player[];

  constructor(properties: Property[], players: Player[]) {
    this.properties = properties;
    this.players = players;
  }

  public calculateRent(property: Property): number {
    if (property.isMortgaged) {
      return 0;
    }

    switch (property.type) {
      case 'property':
        return this.calculatePropertyRent(property);
      case 'railroad':
        return this.calculateRailroadRent(property);
      case 'utility':
        return this.calculateUtilityRent(property);
      default:
        return 0;
    }
  }

  private calculatePropertyRent(property: Property): number {
    if (!property.ownerId || property.isMortgaged) {
      return 0;
    }

    // Get base rent based on development level
    let rent = property.rentLevels[property.houseCount];

    // If no houses but owns all in color group, double rent
    if (property.houseCount === 0 && !property.hasHotel && this.ownsAllInColorGroup(property)) {
      rent *= 2;
    }

    return rent;
  }

  private calculateRailroadRent(property: Property): number {
    if (!property.ownerId || property.isMortgaged) {
      return 0;
    }

    // Count how many railroads the owner has
    const railroadCount = this.properties.filter(p => 
      p.type === 'railroad' && 
      p.ownerId === property.ownerId &&
      !p.isMortgaged
    ).length;

    // Railroad rent is 25 * 2^(n-1) where n is the number of railroads owned
    return 25 * Math.pow(2, railroadCount - 1);
  }

  private calculateUtilityRent(property: Property): number {
    if (!property.ownerId || property.isMortgaged) {
      return 0;
    }

    // Count how many utilities the owner has
    const utilityCount = this.properties.filter(p => 
      p.type === 'utility' && 
      p.ownerId === property.ownerId &&
      !p.isMortgaged
    ).length;

    // Get the last dice roll from the game state
    // This should be passed in from the game state when calculating utility rent
    const diceRoll = property.rentAmount || 0;

    // If owner has both utilities, rent is 10 times dice roll
    // If owner has one utility, rent is 4 times dice roll
    return diceRoll * (utilityCount === 2 ? 10 : 4);
  }

  private ownsAllInColorGroup(property: Property): boolean {
    const propertiesInGroup = this.properties.filter(p => 
      p.colorGroup === property.colorGroup
    );

    return propertiesInGroup.every(p => 
      p.ownerId === property.ownerId && !p.isMortgaged
    );
  }

  public canBuildHouse(property: Property): boolean {
    if (property.type !== 'property' || !property.ownerId || property.isMortgaged) {
      return false;
    }

    // Must own all properties in color group
    if (!this.ownsAllInColorGroup(property)) {
      return false;
    }

    // Check even building rule
    const propertiesInGroup = this.properties.filter(p => 
      p.colorGroup === property.colorGroup
    );

    const minHouses = Math.min(...propertiesInGroup.map(p => p.houseCount));
    
    // Can't build if this property has more houses than others in the group
    if (property.houseCount > minHouses) {
      return false;
    }

    // Maximum 4 houses before hotel
    if (property.houseCount >= 4) {
      return false;
    }

    return true;
  }

  public canBuildHotel(property: Property): boolean {
    if (property.type !== 'property' || !property.ownerId || property.isMortgaged) {
      return false;
    }

    // Must own all properties in color group
    if (!this.ownsAllInColorGroup(property)) {
      return false;
    }

    // Must have 4 houses before building hotel
    if (property.houseCount !== 4) {
      return false;
    }

    // Can't already have a hotel
    if (property.hasHotel) {
      return false;
    }

    return true;
  }

  public canMortgage(property: Property): boolean {
    if (!property.ownerId || property.isMortgaged) {
      return false;
    }

    // Can't mortgage if there are buildings on any property in the color group
    if (property.type === 'property') {
      const propertiesInGroup = this.properties.filter(p => 
        p.colorGroup === property.colorGroup
      );

      if (propertiesInGroup.some(p => p.houseCount > 0 || p.hasHotel)) {
        return false;
      }
    }

    return true;
  }

  public canUnmortgage(property: Property, playerMoney: number): boolean {
    if (!property.ownerId || !property.isMortgaged) {
      return false;
    }

    // Calculate unmortgage cost (mortgage value plus 10% interest)
    const unmortgageCost = Math.ceil(property.mortgageValue * 1.1);

    // Check if player can afford it
    return playerMoney >= unmortgageCost;
  }
} 