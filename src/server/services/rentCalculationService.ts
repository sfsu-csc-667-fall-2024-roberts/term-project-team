import { Property } from '../../shared/types';
import { DatabaseService } from './databaseService';

export class RentCalculationService {
    private static instance: RentCalculationService;
    private databaseService: DatabaseService;

    private constructor() {
        this.databaseService = DatabaseService.getInstance();
    }

    public static getInstance(): RentCalculationService {
        if (!RentCalculationService.instance) {
            RentCalculationService.instance = new RentCalculationService();
        }
        return RentCalculationService.instance;
    }

    async calculateRent(property: Property): Promise<number> {
        if (property.mortgaged) {
            return 0;
        }

        let rent = property.rent;

        switch (property.type) {
            case 'property':
                rent = await this.calculatePropertyRent(property);
                break;
            case 'railroad':
                rent = await this.calculateRailroadRent(property);
                break;
            case 'utility':
                rent = await this.calculateUtilityRent(property);
                break;
        }

        return rent;
    }

    private async calculatePropertyRent(property: Property): Promise<number> {
        let rent = property.rent;

        // Get all properties in the same color group
        const colorGroupProperties = await this.databaseService.getPropertiesByColor(property.gameId, property.colorGroup || '');
        const ownerProperties = colorGroupProperties.filter((p: Property) => p.ownerId === property.ownerId);

        // Check for monopoly
        const hasMonopoly = ownerProperties.length === colorGroupProperties.length;
        if (hasMonopoly) {
            rent *= 2;
        }

        // Add rent for houses and hotels
        if (property.houses > 0) {
            rent = property.rentLevels[property.houses];
        } else if (property.hotels > 0) {
            rent = property.rentLevels[5]; // Hotel rent is typically the last rent level
        }

        return rent;
    }

    private async calculateRailroadRent(property: Property): Promise<number> {
        const baseRent = 25;
        const railroads = await this.databaseService.getPropertiesByType('railroad');
        const ownedRailroads = railroads.filter((r: Property) => r.ownerId === property.ownerId).length;

        // Railroad rent doubles for each railroad owned
        return baseRent * Math.pow(2, ownedRailroads - 1);
    }

    private async calculateUtilityRent(property: Property): Promise<number> {
        const utilities = await this.databaseService.getPropertiesByType('utility');
        const ownedUtilities = utilities.filter((u: Property) => u.ownerId === property.ownerId).length;

        // Get the last dice roll from the game state
        const gameState = await this.databaseService.getGame(property.id);
        const diceRoll = gameState?.lastRoll || 0;

        // Rent is 4x dice roll if owner has one utility, 10x if they have both
        return diceRoll * (ownedUtilities === 2 ? 10 : 4);
    }
}

export const rentCalculationService = RentCalculationService.getInstance(); 