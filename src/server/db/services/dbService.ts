import { pool } from '../config';
import { User, Game, Player, Property } from '../models/types';

// User operations
export async function createUser(username: string, hashedPassword: string): Promise<User> {
  const result = await pool.query(
    'INSERT INTO users (username, hashed_password) VALUES ($1, $2) RETURNING *',
    [username, hashedPassword]
  );
  return result.rows[0];
}

export async function getUserByUsername(username: string): Promise<User | null> {
  const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
  return result.rows[0] || null;
}

// Game operations
export async function createGame(ownerId: number): Promise<Game> {
  const result = await pool.query(
    'INSERT INTO games (owner_id) VALUES ($1) RETURNING *',
    [ownerId]
  );
  return result.rows[0];
}

export async function getGame(gameId: number): Promise<Game | null> {
  const result = await pool.query('SELECT * FROM games WHERE id = $1', [gameId]);
  return result.rows[0] || null;
}

export async function listGames(): Promise<(Game & { owner_username: string; player_count: number })[]> {
  const result = await pool.query(`
    SELECT 
      g.*,
      u.username as owner_username,
      COUNT(DISTINCT p.id) as player_count
    FROM games g
    JOIN users u ON g.owner_id = u.id
    LEFT JOIN players p ON g.id = p.game_id
    GROUP BY g.id, u.username
    ORDER BY g.created_at DESC
  `);
  return result.rows;
}

export async function listMyGames(userId: number): Promise<(Game & { owner_username: string; player_count: number })[]> {
  const result = await pool.query(`
    SELECT 
      g.*,
      u.username as owner_username,
      COUNT(DISTINCT p.id) as player_count
    FROM games g
    JOIN users u ON g.owner_id = u.id
    LEFT JOIN players p ON g.id = p.game_id
    WHERE g.owner_id = $1 OR EXISTS (
      SELECT 1 FROM players WHERE game_id = g.id AND user_id = $1
    )
    GROUP BY g.id, u.username
    ORDER BY g.created_at DESC
  `, [userId]);
  return result.rows;
}

export async function updateGameStatus(gameId: number, status: Game['status']): Promise<Game> {
  const result = await pool.query(
    'UPDATE games SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
    [status, gameId]
  );
  return result.rows[0];
}

// Player operations
export async function addPlayerToGame(gameId: number, userId: number): Promise<Player> {
  // First check if player is already in the game
  const existingPlayer = await pool.query(
    'SELECT * FROM players WHERE game_id = $1 AND user_id = $2',
    [gameId, userId]
  );

  if (existingPlayer.rows[0]) {
    return existingPlayer.rows[0];
  }

  const result = await pool.query(
    'INSERT INTO players (game_id, user_id) VALUES ($1, $2) RETURNING *',
    [gameId, userId]
  );
  return result.rows[0];
}

export async function getGamePlayers(gameId: number): Promise<(Player & { username: string })[]> {
  const result = await pool.query(`
    SELECT p.*, u.username
    FROM players p
    JOIN users u ON p.user_id = u.id
    WHERE p.game_id = $1
    ORDER BY p.created_at ASC
  `, [gameId]);
  return result.rows;
}

export async function updatePlayerState(
  playerId: number,
  updates: Partial<Pick<Player, 'balance' | 'position' | 'jailed'>>
): Promise<Player> {
  const setClauses = [];
  const values: (number | boolean)[] = [playerId];
  let paramCount = 2;

  if ('balance' in updates && typeof updates.balance === 'number') {
    setClauses.push(`balance = $${paramCount}`);
    values.push(updates.balance);
    paramCount++;
  }
  if ('position' in updates && typeof updates.position === 'number') {
    setClauses.push(`position = $${paramCount}`);
    values.push(updates.position);
    paramCount++;
  }
  if ('jailed' in updates && typeof updates.jailed === 'boolean') {
    setClauses.push(`jailed = $${paramCount}`);
    values.push(updates.jailed);
    paramCount++;
  }

  if (setClauses.length === 0) {
    throw new Error('No valid updates provided');
  }

  const result = await pool.query(
    `UPDATE players 
     SET ${setClauses.join(', ')}, updated_at = NOW() 
     WHERE id = $1 
     RETURNING *`,
    values
  );
  return result.rows[0];
}

// Property operations
export async function createProperty(
  gameId: number,
  name: string,
  initialOwnerId?: number | null
): Promise<Property> {
  const result = await pool.query(
    'INSERT INTO properties (game_id, name, owner_id) VALUES ($1, $2, $3) RETURNING *',
    [gameId, name, initialOwnerId ?? null]
  );
  return result.rows[0];
}

export async function getGameProperties(gameId: number): Promise<Property[]> {
  const result = await pool.query(
    'SELECT * FROM properties WHERE game_id = $1 ORDER BY id ASC',
    [gameId]
  );
  return result.rows;
}

export async function updatePropertyState(
  propertyId: number,
  updates: Partial<Pick<Property, 'owner_id' | 'house_count' | 'mortgaged'>>
): Promise<Property> {
  const setClauses = [];
  const values: (number | boolean | null)[] = [propertyId];
  let paramCount = 2;

  if ('owner_id' in updates) {
    setClauses.push(`owner_id = $${paramCount}`);
    values.push(updates.owner_id ?? null);
    paramCount++;
  }
  if ('house_count' in updates && typeof updates.house_count === 'number') {
    setClauses.push(`house_count = $${paramCount}`);
    values.push(updates.house_count);
    paramCount++;
  }
  if ('mortgaged' in updates && typeof updates.mortgaged === 'boolean') {
    setClauses.push(`mortgaged = $${paramCount}`);
    values.push(updates.mortgaged);
    paramCount++;
  }

  if (setClauses.length === 0) {
    throw new Error('No valid updates provided');
  }

  const result = await pool.query(
    `UPDATE properties 
     SET ${setClauses.join(', ')}, updated_at = NOW() 
     WHERE id = $1 
     RETURNING *`,
    values
  );
  return result.rows[0];
} 