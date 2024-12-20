import { Player, RollResponse, GameState } from '../../shared/types';
import { DatabaseService } from './databaseService';
import { GameStateManager } from './gameStateManager';

export class PlayerManager {
    private static instance: PlayerManager;
    private databaseService: DatabaseService;
    private gameStateManager: GameStateManager;

    private constructor() {
        this.databaseService = DatabaseService.getInstance();
        this.gameStateManager = GameStateManager.getInstance();
    }

    static getInstance(): PlayerManager {
        if (!PlayerManager.instance) {
            PlayerManager.instance = new PlayerManager();
        }
        return PlayerManager.instance;
    }

    async updatePlayerPosition(playerId: number, position: number, gameId: number): Promise<boolean> {
        try {
            await this.databaseService.updatePlayerPosition(gameId, playerId, position);
            return true;
        } catch (error) {
            console.error('Error updating player position:', error);
            return false;
        }
    }

    async updatePlayerMoney(playerId: number, amount: number, gameId: number): Promise<boolean> {
        try {
            await this.databaseService.updatePlayer(playerId, { money: amount }, gameId);
            return true;
        } catch (error) {
            console.error('Error updating player money:', error);
            return false;
        }
    }

    async getPlayersInGame(gameId: number): Promise<Player[]> {
        return await this.databaseService.getPlayersInGame(gameId);
    }

    async sendToJail(gameId: number, playerId: number): Promise<boolean> {
        try {
            await this.databaseService.updatePlayer(playerId, {
                position: 10,
                isJailed: true,
                turnsInJail: 0
            }, gameId);
            return true;
        } catch (error) {
            console.error('Error sending player to jail:', error);
            return false;
        }
    }

    async rollDice(playerId: number, gameId: number): Promise<RollResponse> {
        const dice: [number, number] = [
            Math.floor(Math.random() * 6) + 1,
            Math.floor(Math.random() * 6) + 1
        ];
        const roll = dice[0] + dice[1];
        const isDoubles = dice[0] === dice[1];

        const player = await this.databaseService.getPlayerById(playerId);
        if (!player) {
            throw new Error('Player not found');
        }

        const gameState = await this.getGameState(gameId);
        const newPosition = (player.position + roll) % 40;

        return {
            success: true,
            dice,
            isDoubles,
            newPosition,
            currentPlayer: player,
            gameState
        };
    }

    async getGameState(gameId: number): Promise<GameState> {
        const gameState = await this.databaseService.getGameState(gameId);
        if (!gameState) {
            throw new Error('Game not found');
        }
        return gameState;
    }

    async updatePlayer(playerId: number, updates: Partial<Player>, gameId: number): Promise<void> {
        if (!playerId) {
            throw new Error('Player ID is required');
        }
        await this.databaseService.updatePlayer(playerId, updates, gameId);
    }

    async payRent(fromPlayerId: number, toPlayerId: number, amount: number, gameId: number): Promise<boolean> {
        try {
            const [payer, owner] = await Promise.all([
                this.databaseService.getPlayerById(fromPlayerId),
                this.databaseService.getPlayerById(toPlayerId)
            ]);

            if (!payer || !owner) {
                throw new Error('Player not found');
            }

            if (payer.money < amount) {
                return false;
            }

            await Promise.all([
                this.databaseService.updatePlayer(fromPlayerId, { money: payer.money - amount }, gameId),
                this.databaseService.updatePlayer(toPlayerId, { money: owner.money + amount }, gameId)
            ]);

            return true;
        } catch (error) {
            console.error('Error paying rent:', error);
            return false;
        }
    }

    async releaseFromJail(playerId: number, gameId: number): Promise<void> {
        const player = await this.databaseService.getPlayerById(playerId);
        if (!player) {
            throw new Error('Player not found');
        }

        await this.databaseService.updatePlayer(playerId, {
            isJailed: false,
            turnsInJail: 0
        }, gameId);
    }

    async declareBankruptcy(playerId: number, gameId: number, creditorId?: number): Promise<void> {
        const player = await this.databaseService.getPlayerById(playerId);
        if (!player) {
            throw new Error('Player not found');
        }

        // Update player status
        await this.databaseService.updatePlayer(playerId, {
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

        // Update game state
        const gameState = await this.getGameState(gameId);
        if (!gameState.bankruptPlayers) {
            gameState.bankruptPlayers = [];
        }
        gameState.bankruptPlayers.push(playerId);
        await this.gameStateManager.updateGameState(gameId, gameState);
    }

    async canPayAmount(playerId: number, amount: number): Promise<boolean> {
        const player = await this.databaseService.getPlayerById(playerId);
        return player ? player.money >= amount : false;
    }

    async getPlayerPosition(playerId: number): Promise<number> {
        const player = await this.databaseService.getPlayerById(playerId);
        return player ? player.position : 0;
    }

    async isInJail(playerId: number): Promise<boolean> {
        const player = await this.databaseService.getPlayerById(playerId);
        return player ? player.isJailed : false;
    }

    async getJailTurns(playerId: number): Promise<number> {
        const player = await this.databaseService.getPlayerById(playerId);
        return player ? player.turnsInJail : 0;
    }

    async hasJailFreeCard(playerId: number): Promise<boolean> {
        const player = await this.databaseService.getPlayerById(playerId);
        return player ? player.jailFreeCards > 0 : false;
    }

    async getPlayerById(playerId: number): Promise<Player | null> {
        return await this.databaseService.getPlayer(playerId);
    }
}

export const playerManager = PlayerManager.getInstance(); 