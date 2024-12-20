import { Player } from '../../shared/types';
import { DatabaseService } from './databaseService';

export class PlayerService {
    private static instance: PlayerService;
    private databaseService: DatabaseService;

    private constructor() {
        this.databaseService = DatabaseService.getInstance();
    }

    public static getInstance(): PlayerService {
        if (!PlayerService.instance) {
            PlayerService.instance = new PlayerService();
        }
        return PlayerService.instance;
    }

    async getPlayer(playerId: number): Promise<Player | null> {
        return await this.databaseService.getPlayer(playerId);
    }

    async getPlayerByUserId(userId: number): Promise<Player | null> {
        const result = await this.databaseService.query(
            'SELECT p.* FROM players p WHERE p.user_id = $1',
            [userId]
        );
        return result.rows[0] || null;
    }

    async getPlayersInGame(gameId: number): Promise<Player[]> {
        return await this.databaseService.getGamePlayers(gameId);
    }

    async updatePlayer(playerId: number, updates: Partial<Player>, gameId?: number): Promise<void> {
        await this.databaseService.updatePlayer(playerId, updates, gameId);
    }

    async updatePlayerPosition(playerId: number, position: number, gameId: number): Promise<void> {
        await this.databaseService.updatePlayerPosition(gameId, playerId, position);
    }

    async updatePlayerMoney(playerId: number, money: number, gameId: number): Promise<void> {
        await this.databaseService.updatePlayer(playerId, { money }, gameId);
    }

    async sendToJail(gameId: number, playerId: number): Promise<void> {
        await this.updatePlayer(playerId, {
            isJailed: true,
            position: 10, // Jail position
            turnsInJail: 0
        }, gameId);
    }

    async releaseFromJail(playerId: number, gameId: number): Promise<void> {
        await this.updatePlayer(playerId, {
            isJailed: false,
            turnsInJail: 0
        }, gameId);
    }

    async payRent(fromPlayerId: number, toPlayerId: number, amount: number, gameId: number): Promise<boolean> {
        const fromPlayer = await this.getPlayer(fromPlayerId);
        const toPlayer = await this.getPlayer(toPlayerId);

        if (!fromPlayer || !toPlayer || fromPlayer.money < amount) {
            return false;
        }

        await this.updatePlayerMoney(fromPlayerId, fromPlayer.money - amount, gameId);
        await this.updatePlayerMoney(toPlayerId, toPlayer.money + amount, gameId);
        return true;
    }

    async jailPlayer(playerId: number, gameId: number): Promise<void> {
        await this.sendToJail(gameId, playerId);
    }

    async declareBankruptcy(playerId: number, gameId: number, creditorId?: number): Promise<void> {
        const player = await this.getPlayer(playerId);
        if (!player) return;

        // Update player status
        await this.updatePlayer(playerId, {
            isBankrupt: true,
            money: 0
        }, gameId);

        // If there's a creditor, transfer all properties
        if (creditorId) {
            const properties = await this.databaseService.getGameProperties(gameId);
            const playerProperties = properties.filter(p => p.ownerId === playerId);

            for (const property of playerProperties) {
                await this.databaseService.updateProperty(property.id, {
                    ownerId: creditorId
                });
            }
        }
    }

    async getPlayerById(playerId: number): Promise<Player | null> {
        return await this.databaseService.getPlayer(playerId);
    }
}

export const playerService = PlayerService.getInstance(); 