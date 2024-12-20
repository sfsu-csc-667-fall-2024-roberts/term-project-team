import { PoolClient } from 'pg';
import { 
  GameState, 
  Player, 
  Property, 
  Game,
  RentPaymentResult,
  GameData,
  PlayerWithRoll
} from '../../../shared/types';
import { databaseService } from '../../services/databaseService';

// Utility functions for case conversion
const toCamelCase = (str: string): string => {
  return str.replace(/_([a-z])/g, (g) => g[1].toUpperCase());
};

const toSnakeCase = (str: string): string => {
  return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
};

const convertKeysToCamelCase = (obj: any): any => {
  if (Array.isArray(obj)) {
    return obj.map(convertKeysToCamelCase);
  }
  if (obj !== null && typeof obj === 'object') {
    return Object.keys(obj).reduce((acc, key) => {
      const camelKey = toCamelCase(key);
      acc[camelKey] = convertKeysToCamelCase(obj[key]);
      return acc;
    }, {} as any);
  }
  return obj;
};

const convertKeysToSnakeCase = (obj: any): any => {
  if (Array.isArray(obj)) {
    return obj.map(convertKeysToSnakeCase);
  }
  if (obj !== null && typeof obj === 'object') {
    return Object.keys(obj).reduce((acc, key) => {
      const snakeKey = toSnakeCase(key);
      acc[snakeKey] = convertKeysToSnakeCase(obj[key]);
      return acc;
    }, {} as any);
  }
  return obj;
};

// Update database functions to use case conversion
export const getGame = async (gameId: number): Promise<Game> => {
  const result = await databaseService.getPool().query('SELECT * FROM games WHERE id = $1', [gameId]);
  return convertKeysToCamelCase(result.rows[0]);
};

export const getGameById = async (gameId: number): Promise<Game> => {
  return getGame(gameId);
};

export const getGameState = async (gameId: number): Promise<GameState> => {
  const result = await databaseService.getPool().query('SELECT game_state FROM games WHERE id = $1', [gameId]);
  return convertKeysToCamelCase(result.rows[0]?.game_state);
};

export const getGamePlayers = async (gameId: number): Promise<Player[]> => {
  const result = await databaseService.getPool().query('SELECT * FROM players WHERE game_id = $1', [gameId]);
  return convertKeysToCamelCase(result.rows);
};

export const getGameProperties = async (gameId: number): Promise<Property[]> => {
  const result = await databaseService.getPool().query('SELECT * FROM properties WHERE game_id = $1', [gameId]);
  return convertKeysToCamelCase(result.rows);
};

export const getPropertyByPosition = async (gameId: number, position: number): Promise<Property> => {
  const result = await databaseService.getPool().query(
    'SELECT * FROM properties WHERE game_id = $1 AND position = $2',
    [gameId, position]
  );
  return convertKeysToCamelCase(result.rows[0]);
};

export const payRent = async (
  client: PoolClient,
  fromPlayerId: number,
  toPlayerId: number,
  amount: number
): Promise<RentPaymentResult> => {
  await client.query('BEGIN');
  try {
    await client.query(
      'UPDATE players SET money = money - $1 WHERE id = $2',
      [amount, fromPlayerId]
    );
    await client.query(
      'UPDATE players SET money = money + $1 WHERE id = $2',
      [amount, toPlayerId]
    );
    await client.query('COMMIT');
    
    const fromPlayer = await getPlayerById(fromPlayerId);
    const toPlayer = await getPlayerById(toPlayerId);
    
    return {
      success: true,
      message: 'Rent paid successfully',
      payerBalance: fromPlayer.money,
      ownerBalance: toPlayer.money
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
};

export const getPlayerById = async (playerId: number): Promise<Player> => {
  const result = await databaseService.getPool().query('SELECT * FROM players WHERE id = $1', [playerId]);
  return convertKeysToCamelCase(result.rows[0]);
};

export const updatePlayerPosition = async (playerId: number, position: number, gameId: number): Promise<void> => {
  await databaseService.getPool().query('UPDATE players SET position = $1 WHERE id = $2 AND game_id = $3', [position, playerId, gameId]);
};

export const updatePlayerMoney = async (playerId: number, amount: number): Promise<void> => {
  await databaseService.getPool().query('UPDATE players SET money = $1 WHERE id = $2', [amount, playerId]);
};

export const updatePlayerBankruptcy = async (playerId: number, isBankrupt: boolean): Promise<void> => {
  await databaseService.getPool().query('UPDATE players SET is_bankrupt = $1 WHERE id = $2', [isBankrupt, playerId]);
};

export const updatePlayerInJail = async (playerId: number, inJail: boolean): Promise<void> => {
  await databaseService.getPool().query('UPDATE players SET in_jail = $1 WHERE id = $2', [inJail, playerId]);
};

export const getPlayersByGameId = async (gameId: number): Promise<PlayerWithRoll[]> => {
  const result = await databaseService.getPool().query('SELECT * FROM players WHERE game_id = $1', [gameId]);
  return convertKeysToCamelCase(result.rows);
};

export const getPropertiesByGameId = async (gameId: number): Promise<Property[]> => {
  const result = await databaseService.getPool().query('SELECT * FROM properties WHERE game_id = $1', [gameId]);
  return convertKeysToCamelCase(result.rows);
};

export const getPropertiesByOwnerId = async (ownerId: number): Promise<Property[]> => {
  const result = await databaseService.getPool().query('SELECT * FROM properties WHERE owner_id = $1', [ownerId]);
  return convertKeysToCamelCase(result.rows);
};
  