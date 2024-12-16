import { Pool } from 'pg';
import {
  GameState,
  Player,
  Property,
  Game,
  RollResponse,
  SpaceAction,
  RentPaymentResult
} from '../../shared/types';

class GameService {
  public pool: Pool;

  constructor() {
    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL
    });
  }

  async getGameById(gameId: number): Promise<Game | null> {
    console.log('=== Getting Game By ID ===');
    console.log('Game ID:', gameId);
    
    try {
      const result = await this.pool.query(
        'SELECT * FROM games WHERE id = $1',
        [gameId]
      );
      
      console.log('Game query result:', result.rows[0]);
      
      if (!result.rows[0]) {
        console.log('No game found');
        return null;
      }
      
      // Ensure game_state is properly parsed
      const game = result.rows[0];
      if (typeof game.game_state === 'string') {
        game.game_state = JSON.parse(game.game_state);
      }
      
      console.log('Returning game with state:', game.game_state);
      return game;
    } catch (error) {
      console.error('Error getting game:', error);
      throw error;
    }
  }

  async getGameState(gameId: number): Promise<GameState | null> {
    console.log('=== Getting Game State ===');
    console.log('Game ID:', gameId);
    
    try {
      const result = await this.pool.query(
        'SELECT game_state FROM games WHERE id = $1',
        [gameId]
      );
      
      console.log('Game state query result:', result.rows[0]);
      
      if (!result.rows[0]) {
        console.log('No game state found');
        return null;
      }
      
      const gameState = result.rows[0].game_state;
      if (typeof gameState === 'string') {
        return JSON.parse(gameState);
      }
      
      return gameState;
    } catch (error) {
      console.error('Error getting game state:', error);
      throw error;
    }
  }

  async updateGameState(gameId: number, gameState: Partial<GameState>): Promise<void> {
    await this.pool.query(
      'UPDATE games SET game_state = game_state || $1 WHERE id = $2',
      [gameState, gameId]
    );
  }

  async getPlayerById(playerId: number): Promise<Player> {
    const result = await this.pool.query(
      'SELECT * FROM players WHERE id = $1',
      [playerId]
    );
    return result.rows[0];
  }

  async getGamePlayers(gameId: number): Promise<Player[]> {
    console.log('=== Getting Game Players ===');
    console.log('Game ID:', gameId);
    
    try {
      const result = await this.pool.query(
        'SELECT * FROM players WHERE game_id = $1 ORDER BY turn_order',
        [gameId]
      );
      
      console.log('Players query result:', result.rows);
      return result.rows;
    } catch (error) {
      console.error('Error getting game players:', error);
      throw error;
    }
  }

  async getGameProperties(gameId: number): Promise<Property[]> {
    const result = await this.pool.query(
      'SELECT * FROM properties WHERE game_id = $1 ORDER BY position',
      [gameId]
    );
    return result.rows;
  }

  async updatePlayer(playerId: number, updates: Partial<Player>): Promise<void> {
    const updateFields = Object.entries(updates)
      .map(([key, _], index) => {
        const snakeKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
        return `${snakeKey} = $${index + 2}`;
      })
      .join(', ');

    await this.pool.query(
      `UPDATE players SET ${updateFields} WHERE id = $1`,
      [playerId, ...Object.values(updates)]
    );
  }

  async updateProperty(propertyId: number, updates: Partial<Property>): Promise<void> {
    const updateFields = Object.entries(updates)
      .map(([key, _], index) => {
        const snakeKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
        return `${snakeKey} = $${index + 2}`;
      })
      .join(', ');

    await this.pool.query(
      `UPDATE properties SET ${updateFields} WHERE id = $1`,
      [propertyId, ...Object.values(updates)]
    );
  }

  async processRoll(gameId: number, playerId: number): Promise<RollResponse> {
    const dice: [number, number] = [
      Math.floor(Math.random() * 6) + 1,
      Math.floor(Math.random() * 6) + 1
    ];
    const roll = dice[0] + dice[1];
    const isDoubles = dice[0] === dice[1];

    const player = await this.getPlayerById(playerId);
    if (!player) {
      throw new Error('Player not found');
    }

    const newPosition = (player.position + roll) % 40;
    await this.updatePlayer(playerId, { position: newPosition });

    const property = await this.getPropertyByPosition(gameId, newPosition);
    let spaceAction: SpaceAction | undefined;

    if (property) {
      spaceAction = {
        type: 'PROPERTY',
        message: `Landed on ${property.name}`,
        property
      };
    }

    const updatedPlayer = await this.getPlayerById(playerId);
    if (!updatedPlayer) {
      throw new Error('Updated player not found');
    }

    const gameState = await this.getGameState(gameId);
    const players = await this.getGamePlayers(gameId);

    const response: RollResponse = {
      success: true,
      message: `Rolled ${roll} (${dice[0]}, ${dice[1]})`,
      roll,
      dice,
      isDoubles,
      newPosition,
      spaceAction,
      currentPlayer: updatedPlayer,
      players
    };

    if (gameState) {
      response.gameState = gameState;
    }

    return response;
  }

  async getPropertyByPosition(gameId: number, position: number): Promise<Property | null> {
    const result = await this.pool.query(
      'SELECT * FROM properties WHERE game_id = $1 AND position = $2',
      [gameId, position]
    );
    return result.rows[0] || null;
  }

  async payRent(
    client: Pool,
    fromPlayerId: number,
    toPlayerId: number,
    amount: number
  ): Promise<RentPaymentResult> {
    const payer = await this.getPlayerById(fromPlayerId);
    const owner = await this.getPlayerById(toPlayerId);

    if (payer.money < amount) {
      return {
        success: false,
        message: 'Insufficient funds',
        payerBalance: payer.money,
        ownerBalance: owner.money
      };
    }

    await this.updatePlayer(fromPlayerId, { money: payer.money - amount });
    await this.updatePlayer(toPlayerId, { money: owner.money + amount });

    return {
      success: true,
      message: 'Rent paid successfully',
      payerBalance: payer.money - amount,
      ownerBalance: owner.money + amount
    };
  }
}

export const gameService = new GameService(); 