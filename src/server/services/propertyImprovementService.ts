import { Property } from '../../shared/types';
import { DatabaseService } from './databaseService';
import { PropertyService } from './propertyService';
import { PlayerService } from './playerService';

export class PropertyImprovementService {
    private static instance: PropertyImprovementService;
    private databaseService: DatabaseService;
    private propertyService: PropertyService;
    private playerService: PlayerService;

    private constructor() {
        this.databaseService = DatabaseService.getInstance();
        this.propertyService = PropertyService.getInstance();
        this.playerService = PlayerService.getInstance();
    }

    public static getInstance(): PropertyImprovementService {
        if (!PropertyImprovementService.instance) {
            PropertyImprovementService.instance = new PropertyImprovementService();
        }
        return PropertyImprovementService.instance;
    }

    async buyHouse(propertyId: number, playerId: number, gameId: number): Promise<boolean> {
        const property = await this.propertyService.getProperty(propertyId);
        const player = await this.playerService.getPlayer(playerId);

        if (!property || !player) {
            return false;
        }

        if (property.ownerId !== playerId || property.mortgaged || property.houses >= 4) {
            return false;
        }

        const houseCost = property.houseCost || 0;
        if (player.money < houseCost) {
            return false;
        }

        await this.propertyService.updateProperty(propertyId, {
            houses: (property.houses || 0) + 1,
            houseCount: (property.houseCount || 0) + 1
        });
        await this.playerService.updatePlayerMoney(playerId, player.money - houseCost, gameId);
        return true;
    }

    async sellHouse(propertyId: number, playerId: number, gameId: number): Promise<boolean> {
        const property = await this.propertyService.getProperty(propertyId);
        const player = await this.playerService.getPlayer(playerId);

        if (!property || !player) {
            return false;
        }

        if (property.ownerId !== playerId || property.houses <= 0) {
            return false;
        }

        const houseSellPrice = Math.floor((property.houseCost || 0) / 2);
        await this.propertyService.updateProperty(propertyId, {
            houses: property.houses - 1,
            houseCount: (property.houseCount || 1) - 1
        });
        await this.playerService.updatePlayerMoney(playerId, player.money + houseSellPrice, gameId);
        return true;
    }

    async buyHotel(propertyId: number, playerId: number, gameId: number): Promise<boolean> {
        const property = await this.propertyService.getProperty(propertyId);
        const player = await this.playerService.getPlayer(playerId);

        if (!property || !player) {
            return false;
        }

        if (property.ownerId !== playerId || property.mortgaged || property.houses !== 4 || property.hotels >= 1) {
            return false;
        }

        const hotelCost = property.hotelCost || 0;
        if (player.money < hotelCost) {
            return false;
        }

        await this.propertyService.updateProperty(propertyId, {
            houses: 0,
            hotels: 1,
            houseCount: 0,
            hotelCount: 1
        });
        await this.playerService.updatePlayerMoney(playerId, player.money - hotelCost, gameId);
        return true;
    }

    async sellHotel(propertyId: number, playerId: number, gameId: number): Promise<boolean> {
        const property = await this.propertyService.getProperty(propertyId);
        const player = await this.playerService.getPlayer(playerId);

        if (!property || !player) {
            return false;
        }

        if (property.ownerId !== playerId || property.hotels <= 0) {
            return false;
        }

        const hotelSellPrice = Math.floor((property.hotelCost || 0) / 2);
        await this.propertyService.updateProperty(propertyId, {
            hotels: 0,
            hotelCount: 0
        });
        await this.playerService.updatePlayerMoney(playerId, player.money + hotelSellPrice, gameId);
        return true;
    }

    async addImprovement(propertyId: number, playerId: number, gameId: number): Promise<boolean> {
        const property = await this.propertyService.getProperty(propertyId);
        const player = await this.playerService.getPlayer(playerId);

        if (!property || !player) {
            return false;
        }

        // If property has less than 4 houses, buy a house
        if (property.houses < 4) {
            return this.buyHouse(propertyId, playerId, gameId);
        }
        // If property has 4 houses and no hotel, buy a hotel
        else if (property.houses === 4 && property.hotels === 0) {
            return this.buyHotel(propertyId, playerId, gameId);
        }

        return false;
    }

    async sellImprovement(propertyId: number, playerId: number, gameId: number): Promise<boolean> {
        const property = await this.propertyService.getProperty(propertyId);
        const player = await this.playerService.getPlayer(playerId);

        if (!property || !player) {
            return false;
        }

        // If property has a hotel, sell it first
        if (property.hotels > 0) {
            return this.sellHotel(propertyId, playerId, gameId);
        }
        // If property has houses, sell one
        else if (property.houses > 0) {
            return this.sellHouse(propertyId, playerId, gameId);
        }

        return false;
    }
}

export const propertyImprovementService = PropertyImprovementService.getInstance(); 