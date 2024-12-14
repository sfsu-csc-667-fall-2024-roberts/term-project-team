import { Property, Player } from '../db/models/types';
import { BOARD_SPACES } from '../../shared/boardData';
import { BoardSpace } from '../../shared/types';

export class RentCalculationService {
  private properties: Property[];
  private players: Player[];

  constructor(properties: Property[], players: Player[]) {
    this.properties = properties;
    this.players = players;
  }

  calculateRent(property: Property): number {
    const spaceData = BOARD_SPACES[property.position] as BoardSpace;
    
    if (!spaceData || property.mortgaged) {
      return 0;
    }

    switch (spaceData.type) {
      case 'railroad':
        return this.calculateRailroadRent(property);
      case 'utility':
        return this.calculateUtilityRent(property);
      case 'property':
        return this.calculatePropertyRent(property, spaceData);
      default:
        return 0;
    }
  }

  private calculatePropertyRent(property: Property, spaceData: BoardSpace): number {
    if (!spaceData.rentLevels || !spaceData.price) {
      return 0;
    }

    // Base rent is first level rent or 10% of property price
    let baseRent = spaceData.rentLevels[0] || Math.floor(spaceData.price * 0.1);

    // If property has houses/hotel, use the corresponding rent level
    if (property.house_count > 0 && property.house_count <= spaceData.rentLevels.length) {
      baseRent = spaceData.rentLevels[property.house_count - 1];
    }

    // Double rent if player owns all properties in color group
    if (this.ownsAllInColorGroup(property.owner_id, spaceData.colorGroup)) {
      baseRent *= 2;
    }

    return baseRent;
  }

  private calculateRailroadRent(property: Property): number {
    const baseRent = 25; // Base railroad rent
    const ownedRailroads = this.properties.filter(p => 
      p.owner_id === property.owner_id && 
      BOARD_SPACES[p.position].type === 'railroad'
    ).length;

    return baseRent * Math.pow(2, ownedRailroads - 1);
  }

  private calculateUtilityRent(property: Property): number {
    const ownedUtilities = this.properties.filter(p => 
      p.owner_id === property.owner_id && 
      BOARD_SPACES[p.position].type === 'utility'
    ).length;

    return ownedUtilities === 2 ? 10 : 4;
  }

  private ownsAllInColorGroup(ownerId: number | null, colorGroup: string | undefined): boolean {
    if (!ownerId || !colorGroup) {
      return false;
    }

    const colorGroupProperties = this.properties.filter(p => {
      const space = BOARD_SPACES[p.position] as BoardSpace;
      return space.colorGroup === colorGroup;
    });

    return colorGroupProperties.every(p => p.owner_id === ownerId);
  }

  canBuildHouse(property: Property): boolean {
    const spaceData = BOARD_SPACES[property.position] as BoardSpace;
    
    if (!spaceData || spaceData.type !== 'property' || !spaceData.colorGroup) {
      return false;
    }

    // Must own all properties in color group
    if (!this.ownsAllInColorGroup(property.owner_id, spaceData.colorGroup)) {
      return false;
    }

    // Can't build on mortgaged property
    if (property.mortgaged) {
      return false;
    }

    // Can't build more than 4 houses
    if (property.house_count >= 4) {
      return false;
    }

    // Must build evenly
    const colorGroupProperties = this.properties.filter(p => {
      const space = BOARD_SPACES[p.position] as BoardSpace;
      return space.colorGroup === spaceData.colorGroup;
    });

    const minHouses = Math.min(...colorGroupProperties.map(p => p.house_count));
    return property.house_count === minHouses;
  }

  canBuildHotel(property: Property): boolean {
    const spaceData = BOARD_SPACES[property.position] as BoardSpace;
    
    if (!spaceData || spaceData.type !== 'property' || !spaceData.colorGroup) {
      return false;
    }

    // Must own all properties in color group
    if (!this.ownsAllInColorGroup(property.owner_id, spaceData.colorGroup)) {
      return false;
    }

    // Can't build on mortgaged property
    if (property.mortgaged) {
      return false;
    }

    // Must have exactly 4 houses to build hotel
    if (property.house_count !== 4) {
      return false;
    }

    // All properties in color group must have 4 houses
    const colorGroupProperties = this.properties.filter(p => {
      const space = BOARD_SPACES[p.position] as BoardSpace;
      return space.colorGroup === spaceData.colorGroup;
    });

    return colorGroupProperties.every(p => p.house_count === 4);
  }
} 