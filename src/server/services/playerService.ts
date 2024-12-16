import { Player } from '../../shared/types';
import { Pool } from 'pg';

export class PlayerService {
  private pool: Pool;
  private gameId: number;

  constructor(gameId: number) {
    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL
    });
    this.gameId = gameId;
  }

  public async getPlayers(): Promise<Player[]> {
    const players = await this.pool.query(
      'SELECT * FROM players WHERE game_id = $1 ORDER BY turn_order',
      [this.gameId]
    );
    return players.rows;
  }

  public async getActivePlayers(): Promise<Player[]> {
    const players = await this.pool.query(
      'SELECT * FROM players WHERE game_id = $1 AND is_bankrupt = false ORDER BY turn_order',
      [this.gameId]
    );
    return players.rows;
  }

  public async updatePlayerPosition(playerId: number, position: number): Promise<void> {
    await this.pool.query(
      'UPDATE players SET position = $1 WHERE id = $2 AND game_id = $3',
      [position, playerId, this.gameId]
    );
  }

  public async updatePlayerMoney(playerId: number, amount: number): Promise<void> {
    await this.pool.query(
      'UPDATE players SET money = money + $1 WHERE id = $2 AND game_id = $3',
      [amount, playerId, this.gameId]
    );
  }

  public async getPlayerById(playerId: number): Promise<Player | null> {
    const result = await this.pool.query(
      'SELECT * FROM players WHERE id = $1 AND game_id = $2',
      [playerId, this.gameId]
    );
    return result.rows[0] || null;
  }

  public async setPlayerJailStatus(playerId: number, inJail: boolean): Promise<void> {
    await this.pool.query(
      'UPDATE players SET in_jail = $1 WHERE id = $2 AND game_id = $3',
      [inJail, playerId, this.gameId]
    );
  }

  public async updatePlayerTurn(currentPlayerId: number): Promise<number> {
    const players = await this.getActivePlayers();
    const currentIndex = players.findIndex(p => p.id === currentPlayerId);
    const nextIndex = (currentIndex + 1) % players.length;
    const nextPlayerId = players[nextIndex].id;

    await this.pool.query(
      'UPDATE games SET current_player_id = $1 WHERE id = $2',
      [nextPlayerId, this.gameId]
    );

    return nextPlayerId;
  }

  public async isPlayerTurn(playerId: number): Promise<boolean> {
    const game = await this.pool.query(
      'SELECT current_player_id FROM games WHERE id = $1',
      [this.gameId]
    );
    return game.rows[0].current_player_id === playerId;
  }
} 