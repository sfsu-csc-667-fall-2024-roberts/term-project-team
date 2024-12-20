import { Property, Player, GameState } from '../../shared/types';
import { BOARD_SPACES } from '../../shared/boardData';

export class PropertyManager {
    private properties: Property[];
    private players: Player[];

    constructor(gameState: GameState) {
        this.properties = gameState.properties;
        this.players = gameState.players;
    }

    updateState(gameState: GameState): void {
        this.properties = gameState.properties;
        this.players = gameState.players;
    }

    getPropertyByPosition(position: number): Property | undefined {
        return this.properties.find(p => p.position === position);
    }

    getPropertyById(id: number): Property | undefined {
        return this.properties.find(p => p.id === id);
    }

    getPropertiesByOwner(ownerId: number): Property[] {
        return this.properties.filter(p => p.ownerId === ownerId);
    }

    getAvailableProperties(): Property[] {
        return this.properties.filter(p => !p.ownerId);
    }

    async purchaseProperty(gameId: number, propertyId: number): Promise<boolean> {
        try {
            const response = await fetch(`/game/${gameId}/properties/${propertyId}/purchase`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${window.monopolyGameData.token}`,
                    'Content-Type': 'application/json',
                },
            });

            if (!response.ok) {
                throw new Error('Failed to purchase property');
            }

            const result = await response.json();
            return result.success;
        } catch (error) {
            console.error('Error purchasing property:', error);
            return false;
        }
    }

    async payRent(gameId: number, fromPlayerId: number, toPlayerId: number, amount: number): Promise<boolean> {
        try {
            const response = await fetch(`/api/game/${gameId}/rent/pay`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    fromPlayerId,
                    toPlayerId,
                    amount,
                }),
            });

            if (!response.ok) {
                throw new Error('Failed to pay rent');
            }

            const result = await response.json();
            return result.success;
        } catch (error) {
            console.error('Error paying rent:', error);
            return false;
        }
    }

    getPropertyRent(property: Property): number {
        if (property.mortgaged) return 0;

        let rent = property.rent;

        switch (property.type) {
            case 'property':
                // Check if owner has monopoly
                if (this.hasMonopoly(property)) {
                    rent *= 2;
                }
                // Add rent for houses/hotels
                if (property.hotelCount > 0) {
                    rent = this.getHotelRent(property);
                } else if (property.houseCount > 0) {
                    rent = this.getHouseRent(property, property.houseCount);
                }
                break;

            case 'railroad':
                // Rent increases based on number of railroads owned
                const railroadCount = this.getOwnedRailroadCount(property.ownerId!);
                rent = 25 * Math.pow(2, railroadCount - 1);
                break;

            case 'utility':
                // Rent is based on dice roll and utility ownership
                const utilityCount = this.getOwnedUtilityCount(property.ownerId!);
                rent = utilityCount === 1 ? 4 : 10;
                break;
        }

        return rent;
    }

    private hasMonopoly(property: Property): boolean {
        if (!property.ownerId || property.type !== 'property' || !property.colorGroup) return false;

        const propertiesInGroup = this.properties.filter(
            p => p.type === 'property' && p.colorGroup === property.colorGroup
        );
        return propertiesInGroup.every(p => p.ownerId === property.ownerId);
    }

    private getHouseRent(property: Property, houseCount: number): number {
        const space = BOARD_SPACES.find(s => s.position === property.position);
        if (!space || !('rentWithHouses' in space)) return property.rent;

        const rentLevels = (space as any).rentWithHouses;
        return rentLevels[houseCount - 1] || property.rent;
    }

    private getHotelRent(property: Property): number {
        const space = BOARD_SPACES.find(s => s.position === property.position);
        if (!space || !('hotelRent' in space)) return property.rent * 5;

        return (space as any).hotelRent;
    }

    private getOwnedRailroadCount(ownerId: number): number {
        return this.properties.filter(
            p => p.type === 'railroad' && p.ownerId === ownerId
        ).length;
    }

    private getOwnedUtilityCount(ownerId: number): number {
        return this.properties.filter(
            p => p.type === 'utility' && p.ownerId === ownerId
        ).length;
    }
} 