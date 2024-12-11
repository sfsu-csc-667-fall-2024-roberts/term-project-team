import { pool } from '../config';
import { User, Game, Player, Property } from '../models/types';
import { BOARD_SPACES, BoardSpace } from '../../../shared/boardData';

// User operations
export async function createUser(username: string, hashedPassword: string): Promise<User> {
  try {
    const result = await pool.query(
      'INSERT INTO users (username, hashed_password) VALUES ($1, $2) RETURNING id, username, hashed_password',
      [username, hashedPassword]
    );
    return result.rows[0];
  } catch (error) {
    console.error('Error creating user:', error);
    throw error;
  }
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
    'INSERT INTO players (game_id, user_id, balance) VALUES ($1, $2, $3) RETURNING *',
    [gameId, userId, 1500] // Standard Monopoly starting money
  );
  return result.rows[0];
}

export async function getGamePlayers(gameId: number): Promise<(Player & { username: string })[]> {
  const result = await pool.query(`
    SELECT 
      p.id,
      p.game_id,
      p.user_id,
      COALESCE(p.balance, 1500) as balance,
      COALESCE(p.position, 0) as position,
      COALESCE(p.jailed, false) as jailed,
      p.created_at,
      p.updated_at,
      u.username
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

export async function buyProperty(gameId: number, position: number, playerId: number): Promise<Property> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Get the property details from board data
    const propertyData = BOARD_SPACES.find((space: BoardSpace) => space.position === position);
    if (!propertyData || propertyData.type !== 'property' || !propertyData.price) {
      throw new Error('Invalid property position or not a purchasable property');
    }

    // Check if property already exists
    let property = await getPropertyByPosition(gameId, position);
    
    if (property) {
      throw new Error('Property already owned');
    }

    // Get player's current balance
    const playerResult = await client.query(
      'SELECT balance FROM players WHERE game_id = $1 AND id = $2',
      [gameId, playerId]
    );

    if (playerResult.rows.length === 0) {
      throw new Error('Player not found');
    }

    const playerBalance = playerResult.rows[0].balance;
    if (playerBalance < propertyData.price) {
      throw new Error('Insufficient funds');
    }

    // Create new property
    const propertyResult = await client.query(
      'INSERT INTO properties (game_id, name, owner_id, position) VALUES ($1, $2, $3, $4) RETURNING *',
      [gameId, propertyData.name, playerId, position]
    );

    // Deduct money from player
    const updateResult = await client.query(
      'UPDATE players SET balance = balance - $1 WHERE game_id = $2 AND id = $3 RETURNING balance',
      [propertyData.price, gameId, playerId]
    );

    await client.query('COMMIT');
    
    return {
      ...propertyResult.rows[0],
      newBalance: updateResult.rows[0].balance
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function payRent(gameId: number, position: number, tenantId: number, ownerId: number): Promise<{ tenantBalance: number, ownerBalance: number }> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Get the property details from board data
    const propertyData = BOARD_SPACES.find((space: BoardSpace) => space.position === position);
    if (!propertyData || propertyData.type !== 'property' || !propertyData.price || !propertyData.rent) {
      throw new Error('Invalid property position or not a rentable property');
    }

    // Check if property already exists
    let property = await getPropertyByPosition(gameId, position);

    if (!property) {
      throw new Error('Property not owned');
    }

    // Get player's current balance
    const playerResult = await client.query(
      'SELECT balance FROM players WHERE game_id = $1 AND id = $2',
      [gameId, tenantId]
    );

    if (playerResult.rows.length === 0) {
      throw new Error('Player not found');
    }

    const playerBalance = playerResult.rows[0].balance;
    if (playerBalance < propertyData.rent[0]) {
      // TODO: move to bankrupt or morgage routine
      throw new Error('Insufficient funds');
    }

    // Transfer money from tenant to owner
    const updatedTenantResult = await client.query(
      'UPDATE players SET balance = balance - $1 WHERE game_id = $2 AND id = $3 RETURNING balance',
      [propertyData.rent[0], gameId, tenantId]
    );
    const updatedOwnerResult = await client.query(
      'UPDATE players SET balance = balance + $1 WHERE game_id = $2 AND id = $3 RETURNING balance',
      [propertyData.rent[0], gameId, ownerId]
    );

    await client.query('COMMIT');

    return {
      tenantBalance: updatedTenantResult.rows[0].balance,
      ownerBalance: updatedOwnerResult.rows[0].balance
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function getPropertyByPosition(gameId: number, position: number): Promise<Property | null> {
  const result = await pool.query(
    'SELECT * FROM properties WHERE game_id = $1 AND position = $2',
    [gameId, position]
  );
  return result.rows[0] || null;
} 