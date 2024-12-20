import { DatabaseService } from './databaseService';
import { Card, CardAction } from '../../shared/types';
import { PlayerService } from './playerService';

export class CardService {
    private static instance: CardService | null = null;
    private db: DatabaseService;
    private playerService: PlayerService;

    private constructor() {
        this.db = DatabaseService.getInstance();
        this.playerService = PlayerService.getInstance();
    }

    public static getInstance(): CardService {
        if (!CardService.instance) {
            CardService.instance = new CardService();
        }
        return CardService.instance;
    }

    async drawCard(gameId: number, playerId: number, type: 'chance' | 'community_chest'): Promise<Card> {
        const result = await this.db.query(
            'SELECT id, type, text, action_type as "actionType", action_value as "actionValue" FROM cards WHERE type = $1 ORDER BY RANDOM() LIMIT 1',
            [type]
        );

        if (result.rows.length === 0) {
            throw new Error(`No ${type} cards available`);
        }

        const cardData = result.rows[0];
        await this.db.query(
            'INSERT INTO game_cards (game_id, card_id, drawn_by) VALUES ($1, $2, $3)',
            [gameId, cardData.id, playerId]
        );

        return {
            type: cardData.type,
            text: cardData.text,
            action: {
                type: cardData.actionType,
                ...(typeof cardData.actionValue === 'object' ? cardData.actionValue : {})
            }
        };
    }

    async executeCardAction(gameId: number, playerId: number, card: Card): Promise<void> {
        const player = await this.playerService.getPlayer(playerId);
        if (!player) return;

        switch (card.action.type) {
            case 'move':
            case 'move_relative':
            case 'move_to_nearest':
                await this.handleMoveAction(playerId, player.position, card.action, gameId);
                break;
            case 'collect':
            case 'collect_from_each':
                await this.handleCollectAction(gameId, playerId, player.money, card.action);
                break;
            case 'pay':
                await this.handlePayAction(playerId, player.money, card.action, gameId);
                break;
            case 'repairs':
                await this.handleRepairsAction(gameId, playerId, player.money, card.action);
                break;
            case 'jail_free':
                await this.handleJailFreeAction(playerId, player.jailFreeCards || 0, gameId);
                break;
            case 'jail':
                await this.handleJailAction(playerId, gameId);
                break;
            default:
                throw new Error(`Unknown card action type: ${card.action.type}`);
        }
    }

    private async handleMoveAction(playerId: number, currentPosition: number, action: CardAction, gameId: number): Promise<void> {
        let newPosition: number;

        switch (action.type) {
            case 'move':
                newPosition = action.destination || 0;
                break;
            case 'move_relative':
                const moveValue = action.value ? parseInt(action.value.toString()) : 0;
                newPosition = (currentPosition + moveValue + 40) % 40;
                break;
            case 'move_to_nearest':
                const nearestPositions = action.propertyType === 'railroad' ? [5, 15, 25, 35] : [12, 28];
                newPosition = this.findNearestPosition(currentPosition, nearestPositions);
                break;
            default:
                return;
        }

        await this.playerService.updatePlayerPosition(playerId, newPosition, gameId);

        if (newPosition < currentPosition && newPosition !== 0) {
            const player = await this.playerService.getPlayer(playerId);
            if (player) {
                await this.playerService.updatePlayerMoney(playerId, player.money + 200, gameId);
            }
        }
    }

    private findNearestPosition(currentPosition: number, positions: number[]): number {
        if (positions.length === 0) return currentPosition;
        
        return positions.reduce((nearest, pos) => {
            const currentDist = (pos - currentPosition + 40) % 40;
            const nearestDist = (nearest - currentPosition + 40) % 40;
            return currentDist < nearestDist ? pos : nearest;
        }, positions[0]);
    }

    private async handleCollectAction(gameId: number, playerId: number, currentMoney: number, action: CardAction): Promise<void> {
        if (action.type === 'collect_from_each') {
            const players = await this.playerService.getPlayersInGame(gameId);
            const amount = action.amount || 0;
            let totalCollected = 0;

            for (const otherPlayer of players) {
                if (otherPlayer.id !== playerId) {
                    await this.playerService.updatePlayerMoney(otherPlayer.id, otherPlayer.money - amount, gameId);
                    totalCollected += amount;
                }
            }

            await this.playerService.updatePlayerMoney(playerId, currentMoney + totalCollected, gameId);
        } else {
            await this.playerService.updatePlayerMoney(playerId, currentMoney + (action.amount || 0), gameId);
        }
    }

    private async handlePayAction(playerId: number, currentMoney: number, action: CardAction, gameId: number): Promise<void> {
        const amount = action.amount || 0;
        await this.playerService.updatePlayerMoney(playerId, currentMoney - amount, gameId);
    }

    private async handleRepairsAction(gameId: number, playerId: number, currentMoney: number, action: CardAction): Promise<void> {
        const properties = await this.db.getGameProperties(gameId);
        const playerProperties = properties.filter(p => p.ownerId === playerId);
        const houseFee = action.houseFee || 0;
        const hotelFee = action.hotelFee || 0;

        const totalCost = playerProperties.reduce((cost, property) => {
            return cost + 
                (property.hotels * hotelFee) +
                (property.houses * houseFee);
        }, 0);

        await this.playerService.updatePlayerMoney(playerId, currentMoney - totalCost, gameId);
    }

    private async handleJailFreeAction(playerId: number, currentCards: number, gameId: number): Promise<void> {
        await this.playerService.updatePlayer(playerId, {
            jailFreeCards: currentCards + 1
        }, gameId);
    }

    private async handleJailAction(playerId: number, gameId: number): Promise<void> {
        await this.playerService.jailPlayer(playerId, gameId);
    }

    async hasJailFreeCard(playerId: number): Promise<boolean> {
        const player = await this.playerService.getPlayer(playerId);
        return Boolean(player?.jailFreeCards && player.jailFreeCards > 0);
    }

    async useJailFreeCard(playerId: number, gameId: number): Promise<boolean> {
        const player = await this.playerService.getPlayer(playerId);
        if (!player || !player.jailFreeCards || player.jailFreeCards <= 0) {
            return false;
        }

        await this.playerService.updatePlayer(playerId, {
            jailFreeCards: player.jailFreeCards - 1,
            isJailed: false,
            turnsInJail: 0
        }, gameId);
        return true;
    }
}

// Export the singleton instance
export const cardService = CardService.getInstance(); 