import { GameState, Card, Player, Property } from '../../shared/types';
import { DatabaseService } from './databaseService';
import { PlayerService } from './playerService';

class CardActionService {
    private databaseService: DatabaseService;
    private playerService: PlayerService;

    constructor() {
        this.databaseService = DatabaseService.getInstance();
        this.playerService = PlayerService.getInstance();
    }

    async executeCardAction(
        gameState: GameState,
        card: Card,
        player: Player,
        properties: Property[]
    ): Promise<void> {
        if (!card.action) return;

        switch (card.action.type) {
            case 'move':
                if (card.action.destination !== undefined) {
                    await this.playerService.updatePlayerPosition(player.id, card.action.destination, gameState.id);
                    if (card.action.amount) {
                        await this.playerService.updatePlayerMoney(player.id, player.money + card.action.amount, gameState.id);
                    }
                }
                break;

            case 'move_to_nearest':
                if (card.action.propertyType) {
                    const nearestPosition = this.findNearestPropertyPosition(
                        player.position,
                        properties,
                        card.action.propertyType
                    );
                    if (nearestPosition !== null) {
                        await this.playerService.updatePlayerPosition(player.id, nearestPosition, gameState.id);
                    }
                }
                break;

            case 'collect':
                if (card.action.amount) {
                    await this.playerService.updatePlayerMoney(player.id, player.money + card.action.amount, gameState.id);
                }
                break;

            case 'pay':
                if (card.action.amount) {
                    await this.playerService.updatePlayerMoney(player.id, player.money - card.action.amount, gameState.id);
                }
                break;

            case 'repairs':
                if (card.action.houseFee && card.action.hotelFee) {
                    const playerProperties = properties.filter(p => p.ownerId === player.id);
                    const totalCost = this.calculateRepairsCost(
                        playerProperties,
                        card.action.houseFee,
                        card.action.hotelFee
                    );
                    await this.playerService.updatePlayerMoney(player.id, player.money - totalCost, gameState.id);
                }
                break;

            case 'collect_from_each':
                if (card.action.collectFromEach) {
                    const otherPlayers = gameState.players.filter(p => p.id !== player.id);
                    const totalCollected = card.action.collectFromEach * otherPlayers.length;
                    await this.playerService.updatePlayerMoney(player.id, player.money + totalCollected, gameState.id);
                    for (const otherPlayer of otherPlayers) {
                        await this.playerService.updatePlayerMoney(otherPlayer.id, otherPlayer.money - card.action.collectFromEach, gameState.id);
                    }
                }
                break;

            case 'jail':
                if (card.action.goToJail) {
                    await this.playerService.sendToJail(gameState.id, player.id);
                }
                break;

            case 'jail_free':
                // Add jail free card to player's inventory
                await this.playerService.updatePlayer(player.id, {
                    jailFreeCards: (player.jailFreeCards || 0) + 1
                }, gameState.id);
                break;

            case 'move_relative':
                if (card.action.value) {
                    const relativeMove = typeof card.action.value === 'number' ? card.action.value : parseInt(card.action.value);
                    const newPosition = (player.position + relativeMove + 40) % 40;
                    await this.playerService.updatePlayerPosition(player.id, newPosition, gameState.id);
                }
                break;
        }
    }

    private findNearestPropertyPosition(
        currentPosition: number,
        properties: Property[],
        propertyType: 'railroad' | 'utility'
    ): number | null {
        const typeProperties = properties.filter(p => p.type === propertyType);
        if (typeProperties.length === 0) return null;

        let nearestPosition = typeProperties[0].position;
        let minDistance = this.calculateDistance(currentPosition, nearestPosition);

        for (const property of typeProperties) {
            const distance = this.calculateDistance(currentPosition, property.position);
            if (distance < minDistance) {
                minDistance = distance;
                nearestPosition = property.position;
            }
        }

        return nearestPosition;
    }

    private calculateDistance(from: number, to: number): number {
        const forward = (to - from + 40) % 40;
        const backward = (from - to + 40) % 40;
        return Math.min(forward, backward);
    }

    private calculateRepairsCost(
        properties: Property[],
        houseCost: number,
        hotelCost: number
    ): number {
        return properties.reduce((total, property) => {
            if (property.hotels && property.hotels > 0) {
                return total + hotelCost;
            }
            return total + (property.houseCount * houseCost);
        }, 0);
    }
}

export const cardActionService = new CardActionService(); 