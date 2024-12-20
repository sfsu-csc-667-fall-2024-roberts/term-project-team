import { Property } from '../../shared/types';
import { DatabaseService } from './databaseService';

export class PropertyService {
    private static instance: PropertyService;
    private databaseService: DatabaseService;

    private constructor() {
        this.databaseService = DatabaseService.getInstance();
    }

    static getInstance(): PropertyService {
        if (!PropertyService.instance) {
            PropertyService.instance = new PropertyService();
        }
        return PropertyService.instance;
    }

    async getProperties(): Promise<Property[]> {
        try {
            const properties = await this.databaseService.query('SELECT * FROM properties');
            return properties.rows.map(this.mapPropertyFromDb);
        } catch (error) {
            console.error('Error getting properties:', error);
            throw error;
        }
    }

    async getProperty(propertyId: number): Promise<Property | null> {
        try {
            const result = await this.databaseService.query('SELECT * FROM properties WHERE id = $1', [propertyId]);
            return result.rows.length > 0 ? this.mapPropertyFromDb(result.rows[0]) : null;
        } catch (error) {
            console.error('Error getting property:', error);
            throw error;
        }
    }

    async getPropertiesInGame(gameId: number): Promise<Property[]> {
        try {
            const result = await this.databaseService.query('SELECT * FROM game_properties WHERE game_id = $1', [gameId]);
            return result.rows.map(this.mapPropertyFromDb);
        } catch (error) {
            console.error('Error getting properties in game:', error);
            throw error;
        }
    }

    async purchaseProperty(propertyId: number, userId: number): Promise<boolean> {
        try {
            const property = await this.getProperty(propertyId);
            if (!property || property.ownerId !== null) {
                return false;
            }

            await this.databaseService.query(
                'UPDATE game_properties SET owner_id = $1 WHERE id = $2',
                [userId, propertyId]
            );
            return true;
        } catch (error) {
            console.error('Error purchasing property:', error);
            throw error;
        }
    }

    async sell(propertyId: number, userId: number): Promise<boolean> {
        try {
            const property = await this.getProperty(propertyId);
            if (!property || property.ownerId !== userId) {
                return false;
            }

            await this.databaseService.query(
                'UPDATE game_properties SET owner_id = NULL WHERE id = $1',
                [propertyId]
            );
            return true;
        } catch (error) {
            console.error('Error selling property:', error);
            throw error;
        }
    }

    async mortgage(propertyId: number, userId: number): Promise<boolean> {
        try {
            const property = await this.getProperty(propertyId);
            if (!property || property.ownerId !== userId || property.mortgaged) {
                return false;
            }

            await this.databaseService.query(
                'UPDATE game_properties SET mortgaged = true WHERE id = $1',
                [propertyId]
            );
            return true;
        } catch (error) {
            console.error('Error mortgaging property:', error);
            throw error;
        }
    }

    async unmortgage(propertyId: number, userId: number): Promise<boolean> {
        try {
            const property = await this.getProperty(propertyId);
            if (!property || property.ownerId !== userId || !property.mortgaged) {
                return false;
            }

            await this.databaseService.query(
                'UPDATE game_properties SET mortgaged = false WHERE id = $1',
                [propertyId]
            );
            return true;
        } catch (error) {
            console.error('Error unmortgaging property:', error);
            throw error;
        }
    }

    async updateProperty(propertyId: number, updates: Partial<Property>): Promise<void> {
        try {
            const setClause = Object.entries(updates)
                .map(([key], index) => `${this.snakeCaseKey(key)} = $${index + 2}`)
                .join(', ');

            await this.databaseService.query(
                `UPDATE game_properties SET ${setClause} WHERE id = $1`,
                [propertyId, ...Object.values(updates)]
            );
        } catch (error) {
            console.error('Error updating property:', error);
            throw error;
        }
    }

    private mapPropertyFromDb(dbProperty: any): Property {
        return {
            id: dbProperty.id,
            name: dbProperty.name,
            price: dbProperty.price,
            rent: dbProperty.rent,
            ownerId: dbProperty.owner_id,
            type: dbProperty.type,
            color: dbProperty.color,
            mortgaged: dbProperty.mortgaged,
            houses: dbProperty.houses || 0,
            hotels: dbProperty.hotels || 0,
            houseCost: dbProperty.house_cost,
            hotelCost: dbProperty.hotel_cost,
            rentLevels: dbProperty.rent_levels,
            currentRent: dbProperty.current_rent,
            canBeImproved: dbProperty.can_be_improved,
            maxHouses: dbProperty.max_houses || 4,
            maxHotels: dbProperty.max_hotels || 1,
            position: dbProperty.position,
            colorGroup: dbProperty.color_group,
            houseCount: dbProperty.house_count || 0,
            hotelCount: dbProperty.hotel_count || 0,
            gameId: dbProperty.game_id
        };
    }

    private snakeCaseKey(key: string): string {
        return key.replace(/([A-Z])/g, '_$1').toLowerCase();
    }
} 