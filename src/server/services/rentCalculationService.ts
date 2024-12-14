import { Property, Player } from '../../shared/types';

export class RentCalculationService {
  private properties: Property[];
  private players: Player[];

  constructor(properties: Property[], players: Player[]) {
    this.properties = properties;
    this.players = players;
  }

  calculateRent(property: Property): number {
    if (property.isMortgaged) return 0;

    let rent = property.rentLevels[0]; // Base rent with no houses

    if (property.hasHotel || property.houseCount === 5) {
      rent = property.rentLevels[5];
    } else if (property.houseCount > 0) {
      rent = property.rentLevels[property.houseCount];
    }

    // Handle railroads
    if (property.type === 'railroad') {
      const owner = this.players.find(p => p.id === property.ownerId);
      if (owner) {
        const railroadCount = this.properties.filter(p => 
          p.type === 'railroad' && p.ownerId === owner.id
        ).length;
        rent = property.rentLevels[railroadCount - 1];
      }
    }

    // Handle utilities
    if (property.type === 'utility') {
      const owner = this.players.find(p => p.id === property.ownerId);
      if (owner) {
        const utilityCount = this.properties.filter(p => 
          p.type === 'utility' && p.ownerId === owner.id
        ).length;
        // Rent will be 4x or 10x dice roll, handled elsewhere
        rent = utilityCount === 2 ? 10 : 4;
      }
    }

    // Double rent for complete color set (only for regular properties)
    if (property.type === 'property' && this.isColorSetComplete(property)) {
      rent *= 2;
    }

    return rent;
  }

  isColorSetComplete(property: Property): boolean {
    const propertiesInSet = this.getPropertiesInColorSet(property.colorGroup);
    return propertiesInSet.every(p => 
      p.ownerId === property.ownerId && !p.isMortgaged
    );
  }

  getPropertiesInColorSet(colorGroup: string): Property[] {
    return this.properties.filter(p => p.colorGroup === colorGroup);
  }

  canBuildHouse(property: Property): boolean {
    if (property.type !== 'property' || property.isMortgaged) return false;
    if (property.houseCount >= 4) return false;
    
    // Must own all properties in color set
    if (!this.isColorSetComplete(property)) return false;
    
    // Must build evenly
    const propertiesInSet = this.getPropertiesInColorSet(property.colorGroup);
    const minHouses = Math.min(...propertiesInSet.map(p => p.houseCount));
    return property.houseCount <= minHouses;
  }

  canBuildHotel(property: Property): boolean {
    if (property.type !== 'property' || property.isMortgaged) return false;
    if (property.houseCount !== 4 || property.hasHotel) return false;
    
    // Must own all properties in color set
    if (!this.isColorSetComplete(property)) return false;
    
    // All properties in set must have 4 houses
    const propertiesInSet = this.getPropertiesInColorSet(property.colorGroup);
    return propertiesInSet.every(p => p.houseCount === 4);
  }
} 