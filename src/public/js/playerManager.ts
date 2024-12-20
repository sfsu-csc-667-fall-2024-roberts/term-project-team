import { Player, GameState } from '../../shared/types';

export class PlayerManager {
    private players: Player[];
    private currentPlayerId: number;
    private turnOrder: number[];
    private bankruptPlayers: number[];
    private jailFreeCards: Record<number, number>;

    constructor(gameState: GameState) {
        this.players = gameState.players;
        this.currentPlayerId = gameState.currentPlayerId;
        this.turnOrder = gameState.turnOrder;
        this.bankruptPlayers = gameState.bankruptPlayers;
        this.jailFreeCards = gameState.jailFreeCards;
    }

    updateState(gameState: GameState): void {
        this.players = gameState.players;
        this.currentPlayerId = gameState.currentPlayerId;
        this.turnOrder = gameState.turnOrder;
        this.bankruptPlayers = gameState.bankruptPlayers;
        this.jailFreeCards = gameState.jailFreeCards;
    }

    getCurrentPlayer(): Player | undefined {
        return this.players.find(p => p.id === this.currentPlayerId);
    }

    getPlayerById(playerId: number): Player | undefined {
        return this.players.find(p => p.id === playerId);
    }

    getNextPlayer(): Player | undefined {
        const currentIndex = this.turnOrder.indexOf(this.currentPlayerId);
        const nextIndex = (currentIndex + 1) % this.turnOrder.length;
        const nextPlayerId = this.turnOrder[nextIndex];
        return this.players.find(p => p.id === nextPlayerId);
    }

    canPlayerAct(playerId: number): boolean {
        const player = this.getPlayerById(playerId);
        if (!player) return false;

        return (
            playerId === this.currentPlayerId &&
            !player.isBankrupt &&
            !this.bankruptPlayers.includes(playerId)
        );
    }

    canRoll(playerId: number, gamePhase: string, lastRoll?: number): boolean {
        if (!this.canPlayerAct(playerId)) return false;

        const player = this.getPlayerById(playerId)!;
        
        if (gamePhase === 'initial_roll') {
            return true;
        }

        if (gamePhase === 'playing') {
            if (player.isJailed) {
                return !lastRoll; // Can only roll once while in jail
            }
            return !lastRoll; // Can only roll once per turn
        }

        return false;
    }

    canEndTurn(playerId: number, gamePhase: string, lastRoll?: number): boolean {
        if (!this.canPlayerAct(playerId)) return false;

        const player = this.getPlayerById(playerId)!;
        
        if (gamePhase === 'playing') {
            if (player.isJailed) {
                return !!lastRoll; // Must have rolled to end turn in jail
            }
            return !!lastRoll; // Must have rolled to end turn
        }

        return false;
    }

    canUseJailFreeCard(playerId: number): boolean {
        const player = this.getPlayerById(playerId);
        if (!player || !player.isJailed) return false;

        return player.jailFreeCards > 0;
    }

    canPayJailFine(playerId: number): boolean {
        const player = this.getPlayerById(playerId);
        if (!player || !player.isJailed) return false;

        return player.money >= 50;
    }

    async setPlayerPosition(playerId: number, position: number): Promise<boolean> {
        try {
            const response = await fetch(`/api/game/player/${playerId}/position`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ position }),
            });

            if (!response.ok) {
                throw new Error('Failed to update player position');
            }

            const result = await response.json();
            return result.success;
        } catch (error) {
            console.error('Error updating player position:', error);
            return false;
        }
    }

    getPlayerPosition(playerId: number): number {
        const player = this.getPlayerById(playerId);
        return player?.position || 0;
    }

    hasPassedGo(oldPosition: number, newPosition: number): boolean {
        return newPosition < oldPosition;
    }

    sortPlayersByNetWorth(): Player[] {
        return [...this.players].sort((a, b) => b.money - a.money);
    }

    getWinningPlayer(): Player | undefined {
        const activePlayers = this.players.filter(p => !this.bankruptPlayers.includes(p.id));
        if (activePlayers.length === 1) {
            return activePlayers[0];
        }
        return undefined;
    }
} 