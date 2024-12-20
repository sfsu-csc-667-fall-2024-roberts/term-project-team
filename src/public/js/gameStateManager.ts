import { GameState, Player, GameEvent, DiceRoll, SpaceAction } from '../../shared/types';

export class GameStateManager {
    private gameState: GameState;

    constructor(initialState: GameState) {
        this.gameState = initialState;
    }

    updateGameState(newState: Partial<GameState>): void {
        this.gameState = {
            ...this.gameState,
            ...newState,
            gamePhase: newState.gamePhase ?? this.gameState.gamePhase,
            diceRoll: newState.diceRoll ?? this.gameState.diceRoll,
            currentPlayerId: newState.currentPlayerId ?? this.gameState.currentPlayerId,
            players: newState.players ?? this.gameState.players,
            properties: newState.properties ?? this.gameState.properties,
            turnCount: newState.turnCount ?? this.gameState.turnCount,
            doublesCount: newState.doublesCount ?? this.gameState.doublesCount,
            bankruptPlayers: newState.bankruptPlayers ?? this.gameState.bankruptPlayers,
            jailFreeCards: newState.jailFreeCards ?? this.gameState.jailFreeCards,
            gameLog: newState.gameLog ?? this.gameState.gameLog,
            turnOrder: newState.turnOrder ?? this.gameState.turnOrder,
            pendingTrades: newState.pendingTrades ?? this.gameState.pendingTrades
        };
    }

    getCurrentPlayer(): Player | undefined {
        return this.gameState.players.find(p => p.id === this.gameState.currentPlayerId);
    }

    isPlayerInJail(playerId: number): boolean {
        const player = this.gameState.players.find(p => p.id === playerId);
        return player?.isJailed ?? false;
    }

    getPlayerJailTurns(playerId: number): number {
        const player = this.gameState.players.find(p => p.id === playerId);
        return player?.turnsInJail ?? 0;
    }

    addGameEvent(event: GameEvent): void {
        this.gameState.gameLog.push(event);
    }

    async getCurrentState(gameId: number): Promise<GameState | null> {
        try {
            const response = await fetch(`/game/${gameId}/state`, {
                headers: {
                    'Authorization': `Bearer ${window.monopolyGameData.token}`,
                    'Content-Type': 'application/json'
                }
            });
            if (!response.ok) {
                throw new Error('Failed to fetch game state');
            }
            return await response.json();
        } catch (error) {
            console.error('Error fetching game state:', error);
            return null;
        }
    }

    async rollDice(gameId: number): Promise<DiceRoll | null> {
        try {
            const response = await fetch(`/game/${gameId}/roll`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${window.monopolyGameData.token}`,
                    'Content-Type': 'application/json'
                }
            });
            if (!response.ok) {
                throw new Error('Failed to roll dice');
            }
            return await response.json();
        } catch (error) {
            console.error('Error rolling dice:', error);
            return null;
        }
    }

    async endTurn(gameId: number): Promise<boolean> {
        try {
            const response = await fetch(`/game/${gameId}/end-turn`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${window.monopolyGameData.token}`,
                    'Content-Type': 'application/json'
                }
            });
            return response.ok;
        } catch (error) {
            console.error('Error ending turn:', error);
            return false;
        }
    }
} 