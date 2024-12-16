import { Pool } from 'pg';
import { GameEvent, GameStatistics } from '../../shared/types';

class GameHistoryService {
  private pool: Pool;

  constructor() {
    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL
    });
  }

  async addEvent(gameId: number, event: GameEvent): Promise<void> {
    await this.pool.query(
      'INSERT INTO game_events (game_id, type, player_id, related_player_id, property_id, amount, position, description, metadata) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)',
      [
        gameId,
        event.type,
        event.playerId,
        event.relatedPlayerId,
        event.propertyId,
        event.amount,
        event.position,
        event.description,
        event.metadata
      ]
    );
  }

  async getGameEvents(gameId: number): Promise<GameEvent[]> {
    const result = await this.pool.query(
      'SELECT * FROM game_events WHERE game_id = $1 ORDER BY timestamp ASC',
      [gameId]
    );
    return result.rows;
  }

  async getGameStatistics(gameId: number): Promise<GameStatistics> {
    const events = await this.getGameEvents(gameId);
    const result = await this.pool.query(
      'SELECT * FROM game_statistics WHERE game_id = $1',
      [gameId]
    );
    const stats = result.rows[0] || {};

    return {
      totalTurns: stats.total_turns || 0,
      mostOwnedColor: stats.most_owned_color || '',
      highestRentPaid: stats.highest_rent_paid || 0,
      mostVisitedProperty: stats.most_visited_property || '',
      longestGame: stats.longest_game || 0,
      bankruptcyCount: stats.bankruptcy_count || 0,
      tradingVolume: stats.trading_volume || 0,
      auctionsSold: stats.auctions_sold || 0,
      players: await this.getPlayerStatistics(gameId),
      trades: await this.getTradeStatistics(gameId),
      properties: await this.getPropertyStatistics(gameId)
    };
  }

  private async getPlayerStatistics(gameId: number): Promise<any[]> {
    const result = await this.pool.query(
      'SELECT * FROM player_statistics WHERE game_id = $1',
      [gameId]
    );
    return result.rows || [];
  }

  private async getTradeStatistics(gameId: number): Promise<any[]> {
    const result = await this.pool.query(
      'SELECT * FROM trade_statistics WHERE game_id = $1',
      [gameId]
    );
    return result.rows || [];
  }

  private async getPropertyStatistics(gameId: number): Promise<any[]> {
    const result = await this.pool.query(
      'SELECT * FROM property_statistics WHERE game_id = $1',
      [gameId]
    );
    return result.rows || [];
  }
}

export const gameHistoryService = new GameHistoryService(); 