import { Property } from '../../shared/types';
import { DatabaseService } from './databaseService';
import { PlayerService } from './playerService';

export class PropertyManager {
    private static instance: PropertyManager;
    private databaseService: DatabaseService;
    private playerService: PlayerService;

    private constructor() {
        this.databaseService = DatabaseService.getInstance();
        this.playerService = PlayerService.getInstance();
    }

    public static getInstance(): PropertyManager {
        if (!PropertyManager.instance) {
            PropertyManager.instance = new PropertyManager();
        }
        return PropertyManager.instance;
    }

    async getPropertyById(propertyId: number): Promise<Property | null> {
        return await this.databaseService.getProperty(propertyId);
    }

    async getPlayerProperties(gameId: number, playerId: number): Promise<Property[]> {
        const properties = await this.databaseService.getGameProperties(gameId);
        return properties.filter(p => p.ownerId === playerId);
    }

    async mortgageProperty(propertyId: number, playerId: number): Promise<boolean> {
        const property = await this.getPropertyById(propertyId);
        if (!property || property.ownerId !== playerId || property.mortgaged) {
            return false;
        }

        await this.databaseService.updateProperty(propertyId, { mortgaged: true });
        return true;
    }

    async unmortgageProperty(propertyId: number, playerId: number): Promise<boolean> {
        const property = await this.getPropertyById(propertyId);
        if (!property || property.ownerId !== playerId || !property.mortgaged) {
            return false;
        }

        await this.databaseService.updateProperty(propertyId, { mortgaged: false });
        return true;
    }

    async hasMonopoly(gameId: number, playerId: number, colorGroup: string): Promise<boolean> {
        const properties = await this.databaseService.getGameProperties(gameId);
        const colorProperties = properties.filter(p => p.colorGroup === colorGroup);
        return colorProperties.length > 0 && colorProperties.every(p => p.ownerId === playerId);
    }
}

export const propertyManager = PropertyManager.getInstance(); 