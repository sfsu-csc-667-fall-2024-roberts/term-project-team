import { Pool, PoolClient } from 'pg';
import { 
  GameState, 
  Player, 
  Property, 
  Game,
  RentPaymentResult,
  GameData,
  PlayerWithRoll
} from '../../../shared/types';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

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
  const result = await pool.query('SELECT * FROM games WHERE id = $1', [gameId]);
  return convertKeysToCamelCase(result.rows[0]);
};

export const getGameById = async (gameId: number): Promise<Game> => {
  return getGame(gameId);
};

export const getGameState = async (gameId: number): Promise<GameState> => {
  const result = await pool.query('SELECT game_state FROM games WHERE id = $1', [gameId]);
  return convertKeysToCamelCase(result.rows[0]?.game_state);
};

export const getGamePlayers = async (gameId: number): Promise<Player[]> => {
  const result = await pool.query('SELECT * FROM players WHERE game_id = $1', [gameId]);
  return convertKeysToCamelCase(result.rows);
};

export const getGameProperties = async (gameId: number): Promise<Property[]> => {
  const result = await pool.query('SELECT * FROM properties WHERE game_id = $1', [gameId]);
  return convertKeysToCamelCase(result.rows);
};

export const getPropertyByPosition = async (gameId: number, position: number): Promise<Property> => {
  const result = await pool.query(
    'SELECT * FROM properties WHERE game_id = $1 AND position = $2',
    [gameId, position]
  );
  return convertKeysToCamelCase(result.rows[0]);
};

export const updateGameState = async (gameId: number, gameState: GameState): Promise<void> => {
  const snakeCaseState = convertKeysToSnakeCase(gameState);
  await pool.query(
    'UPDATE games SET game_state = $1 WHERE id = $2',
    [snakeCaseState, gameId]
  );
};

export const updatePlayer = async (player: Player): Promise<void> => {
  const snakeCasePlayer = convertKeysToSnakeCase(player);
  await pool.query(
    'UPDATE players SET position = $1, money = $2, in_jail = $3, jail_turns = $4, is_bankrupt = $5 WHERE id = $6',
    [
      snakeCasePlayer.position,
      snakeCasePlayer.money,
      snakeCasePlayer.in_jail,
      snakeCasePlayer.jail_turns,
      snakeCasePlayer.is_bankrupt,
      snakeCasePlayer.id
    ]
  );
};

export const updateProperty = async (property: Property): Promise<void> => {
  const snakeCaseProperty = convertKeysToSnakeCase(property);
  await pool.query(
    'UPDATE properties SET owner_id = $1, is_mortgaged = $2, house_count = $3, has_hotel = $4 WHERE id = $5',
    [
      snakeCaseProperty.owner_id,
      snakeCaseProperty.is_mortgaged,
      snakeCaseProperty.house_count,
      snakeCaseProperty.has_hotel,
      snakeCaseProperty.id
    ]
  );
};

export const buyProperty = async (
  client: PoolClient,
  propertyId: number,
  playerId: number,
  price: number
): Promise<void> => {
  await client.query('BEGIN');
  try {
    await client.query(
      'UPDATE properties SET owner_id = $1 WHERE id = $2',
      [playerId, propertyId]
    );
    await client.query(
      'UPDATE players SET money = money - $1 WHERE id = $2',
      [price, playerId]
    );
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
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
  const result = await pool.query('SELECT * FROM players WHERE id = $1', [playerId]);
  return result.rows[0];
};

export const updatePlayerPosition = async (playerId: number, position: number): Promise<void> => {
  await pool.query('UPDATE players SET position = $1 WHERE id = $2', [position, playerId]);
};

export const updatePlayerMoney = async (playerId: number, amount: number): Promise<void> => {
  await pool.query('UPDATE players SET money = $1 WHERE id = $2', [amount, playerId]);
};

export const updatePlayerBankruptcy = async (playerId: number, isBankrupt: boolean): Promise<void> => {
  await pool.query('UPDATE players SET is_bankrupt = $1 WHERE id = $2', [isBankrupt, playerId]);
};

export const updatePlayerInJail = async (playerId: number, inJail: boolean): Promise<void> => {
  await pool.query('UPDATE players SET in_jail = $1 WHERE id = $2', [inJail, playerId]);
};

export const getPlayersByGameId = async (gameId: number): Promise<PlayerWithRoll[]> => {
  const result = await pool.query('SELECT * FROM players WHERE game_id = $1', [gameId]);
  return result.rows;
};

export const getPropertiesByGameId = async (gameId: number): Promise<Property[]> => {
  const result = await pool.query('SELECT * FROM properties WHERE game_id = $1', [gameId]);
  return result.rows;
};

export const getPropertiesByOwnerId = async (ownerId: number): Promise<Property[]> => {
  const result = await pool.query('SELECT * FROM properties WHERE owner_id = $1', [ownerId]);
  return result.rows;
};
  