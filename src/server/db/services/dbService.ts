import { pool } from '../config';
import { User, Game, Player, Property } from '../models/types';
import { BOARD_SPACES } from '../../shared/boardData';
import { Pool, PoolClient } from 'pg';

type DatabaseClient = Pool | PoolClient;

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

export async function getUserById(userId: number): Promise<User | null> {
  try {
    const result = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);
    return result.rows[0] || null;
  } catch (error) {
    console.error('Error getting user by ID:', error);
    throw error;
  }
}

export async function getUserByUsername(username: string): Promise<User | null> {
  const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
  return result.rows[0] || null;
}

// Game operations
async function initializeGameProperties(gameId: number, client: DatabaseClient): Promise<void> {
  // Initialize properties from board data
  for (const space of BOARD_SPACES) {
    if (space.type === 'property' || space.type === 'railroad' || space.type === 'utility') {
      await client.query(
        `INSERT INTO properties (
          game_id, position, name, owner_id, house_count, is_mortgaged, price,
          type, rent_levels, color_group, house_cost, hotel_cost, mortgage_value, has_hotel
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
        [
          gameId,
          space.position,
          space.name,
          null,
          0,
          false,
          space.price,
          space.type,
          space.rentLevels || [],
          space.colorGroup || null,
          space.type === 'property' ? 50 : null,
          space.type === 'property' ? 50 : null,
          Math.floor((space.price || 0) / 2),
          false
        ]
      );
    }
  }
}

export async function getGame(gameId: number): Promise<Game | null> {
  const result = await pool.query('SELECT * FROM games WHERE id = $1', [gameId]);
  return result.rows[0] || null;
}

export async function getGamePlayers(gameId: number): Promise<Player[]> {
  const result = await pool.query('SELECT * FROM players WHERE game_id = $1', [gameId]);
  return result.rows;
}

export async function getGameProperties(gameId: number): Promise<Property[]> {
  const result = await pool.query('SELECT * FROM properties WHERE game_id = $1', [gameId]);
  return result.rows;
}

export async function createGame(ownerId: number, client: DatabaseClient = pool): Promise<Game> {
  const shouldManageTransaction = client === pool;
  const dbClient = shouldManageTransaction ? await pool.connect() : client as PoolClient;
  
  try {
    if (shouldManageTransaction) {
      await dbClient.query('BEGIN');
      console.log('Transaction started for game creation');
    }

    // Check if user exists and get username
    console.log('Checking user existence:', { ownerId });
    const userResult = await dbClient.query('SELECT * FROM users WHERE id = $1', [ownerId]);
    const user = userResult.rows[0];
    
    if (!user) {
      console.error('User not found in database:', { ownerId });
      const allUsers = await dbClient.query('SELECT id, username FROM users');
      console.error('All users in database:', allUsers.rows);
      throw new Error(`User ${ownerId} not found`);
    }
    
    console.log('User found:', { userId: user.id, username: user.username });

    // Create game with initial game state
    const initialGameState = {
      phase: 'waiting',
      current_player_index: 0,
      dice_rolls: [],
      turn_order: [],
      doubles_count: 0,
      jail_turns: {},
      bankrupt_players: []
    };

    console.log('Creating new game with state:', initialGameState);
    const gameResult = await dbClient.query(
      'INSERT INTO games (owner_id, status, game_state) VALUES ($1, $2, $3) RETURNING *',
      [ownerId, 'waiting', initialGameState]
    );
    const game = gameResult.rows[0];
    console.log('Game created:', { gameId: game.id, ownerId: game.owner_id });

    // Initialize properties for the game
    console.log('Initializing properties for game:', { gameId: game.id });
    await initializeGameProperties(game.id, dbClient);
    console.log('Properties initialized successfully');

    // Add owner as first player with username
    console.log('Adding owner as first player:', { gameId: game.id, userId: ownerId, username: user.username });
    const playerResult = await dbClient.query(
      'INSERT INTO players (game_id, user_id, username, is_bot, balance, position) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [game.id, ownerId, user.username, false, 1500, 0]
    );
    console.log('Owner added as player:', playerResult.rows[0]);

    if (shouldManageTransaction) {
      await dbClient.query('COMMIT');
      console.log('Transaction committed successfully');
    }
    return game;
  } catch (error) {
    if (shouldManageTransaction) {
      await dbClient.query('ROLLBACK');
      console.error('Transaction rolled back due to error:', error);
    }
    throw error;
  } finally {
    if (shouldManageTransaction && 'release' in dbClient) {
      dbClient.release();
      console.log('Database client released');
    }
  }
}

export async function createBotPlayer(
  gameId: number,
  strategy: string = 'balanced',
  difficulty: string = 'medium',
  client: DatabaseClient = pool
): Promise<Player> {
  const shouldManageTransaction = client === pool;
  const dbClient = shouldManageTransaction ? await pool.connect() : client as PoolClient;
  
  try {
    if (shouldManageTransaction) {
      await dbClient.query('BEGIN');
    }

    // Generate bot name
    const botName = `Bot_${Math.random().toString(36).substring(7)}`;

    // Create bot player
    const result = await dbClient.query(
      `INSERT INTO players (
        game_id,
        user_id,
        username,
        is_bot,
        balance,
        position,
        bot_strategy,
        bot_difficulty
      ) VALUES ($1, NULL, $2, true, $3, $4, $5, $6)
      RETURNING *`,
      [gameId, botName, 1500, 0, strategy, difficulty]
    );

    if (shouldManageTransaction) {
      await dbClient.query('COMMIT');
    }
    return result.rows[0];
  } catch (error) {
    if (shouldManageTransaction) {
      await dbClient.query('ROLLBACK');
    }
    throw error;
  } finally {
    if (shouldManageTransaction && 'release' in dbClient) {
      dbClient.release();
    }
  }
}

export async function getGames(): Promise<Game[]> {
  const result = await pool.query(`
    SELECT * FROM games 
    WHERE status = 'waiting'
    ORDER BY created_at DESC
  `);
  return result.rows;
}

export async function joinGame(gameId: number, userId: number): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Get user info
    const user = await getUserById(userId);
    if (!user) throw new Error('User not found');

    // Add player to game
    await client.query(
      'INSERT INTO players (game_id, user_id, username, is_bot, balance, position) VALUES ($1, $2, $3, $4, $5, $6)',
      [gameId, userId, user.username, false, 1500, 0]
    );

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function deleteGame(gameId: number, userId: number): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM games WHERE id = $1 AND owner_id = $2', [gameId, userId]);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function leaveGame(gameId: number, userId: number): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM players WHERE game_id = $1 AND user_id = $2', [gameId, userId]);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function updateGameState(gameId: number, gameState: any): Promise<void> {
  await pool.query('UPDATE games SET game_state = $1 WHERE id = $2', [gameState, gameId]);
}

export async function updatePlayerState(playerId: number, updates: Partial<Player>): Promise<Player> {
  const setClauses: string[] = [];
  const values: any[] = [playerId];
  let paramCount = 2;

  for (const [key, value] of Object.entries(updates)) {
    if (value !== undefined) {
      setClauses.push(`${key} = $${paramCount}`);
      values.push(value);
      paramCount++;
    }
  }

  if (setClauses.length === 0) {
    throw new Error('No valid updates provided');
  }

  const result = await pool.query(
    `UPDATE players SET ${setClauses.join(', ')} WHERE id = $1 RETURNING *`,
    values
  );
  return result.rows[0];
}

export async function updatePropertyState(propertyId: number, updates: Partial<Property>): Promise<Property> {
  const setClauses: string[] = [];
  const values: any[] = [propertyId];
  let paramCount = 2;

  for (const [key, value] of Object.entries(updates)) {
    if (value !== undefined) {
      setClauses.push(`${key} = $${paramCount}`);
      values.push(value);
      paramCount++;
    }
  }

  if (setClauses.length === 0) {
    throw new Error('No valid updates provided');
  }

  const result = await pool.query(
    `UPDATE properties SET ${setClauses.join(', ')} WHERE id = $1 RETURNING *`,
    values
  );
  return result.rows[0];
}

interface PurchaseResult {
  success: boolean;
  error?: string;
  property?: Property;
  player?: Player;
}

export async function buyProperty(gameId: number, playerId: number, position: number): Promise<PurchaseResult> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Get property
    const propertyResult = await client.query(
      'SELECT * FROM properties WHERE game_id = $1 AND position = $2',
      [gameId, position]
    );
    const property = propertyResult.rows[0];

    if (!property) {
      throw new Error('Property not found');
    }

    if (property.owner_id !== null) {
      throw new Error('Property already owned');
    }

    // Get player
    const playerResult = await client.query(
      'SELECT * FROM players WHERE game_id = $1 AND id = $2',
      [gameId, playerId]
    );
    const player = playerResult.rows[0];

    if (!player) {
      throw new Error('Player not found');
    }

    if (player.balance < property.price) {
      throw new Error('Insufficient funds');
    }

    // Update property owner
    await client.query(
      'UPDATE properties SET owner_id = $1 WHERE id = $2',
      [playerId, property.id]
    );

    // Update player balance
    await client.query(
      'UPDATE players SET balance = balance - $1 WHERE id = $2',
      [property.price, playerId]
    );

    await client.query('COMMIT');

    // Convert database property to application property type
    const updatedProperty = {
      id: property.id,
      gameId: property.game_id,
      position: property.position,
      name: property.name,
      type: property.type,
      price: property.price,
      rentLevels: property.rent_levels,
      houseCost: property.house_cost,
      hotelCost: property.hotel_cost,
      mortgageValue: property.mortgage_value,
      colorGroup: property.color_group,
      ownerId: playerId,
      houseCount: property.house_count,
      isMortgaged: property.is_mortgaged,
      hasHotel: property.has_hotel
    };

    // Get updated player
    const updatedPlayerResult = await client.query(
      'SELECT * FROM players WHERE id = $1',
      [playerId]
    );

    return {
      success: true,
      property: updatedProperty,
      player: updatedPlayerResult.rows[0]
    };
  } catch (error) {
    await client.query('ROLLBACK');
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
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

export async function getPropertiesByOwnerId(ownerId: number): Promise<Property[]> {
  const result = await pool.query('SELECT * FROM properties WHERE owner_id = $1', [ownerId]);
  return result.rows;
}

export async function processRentPayment(
  gameId: number,
  payerId: number,
  ownerId: number,
  rentAmount: number
): Promise<{ payerBalance: number; ownerBalance: number }> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Update balances
    const [payerResult, ownerResult] = await Promise.all([
      client.query(
        'UPDATE players SET balance = balance - $1 WHERE game_id = $2 AND id = $3 RETURNING balance',
        [rentAmount, gameId, payerId]
      ),
      client.query(
        'UPDATE players SET balance = balance + $1 WHERE game_id = $2 AND id = $3 RETURNING balance',
        [rentAmount, gameId, ownerId]
      )
    ]);

    await client.query('COMMIT');
    return {
      payerBalance: payerResult.rows[0].balance,
      ownerBalance: ownerResult.rows[0].balance
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function createProperty(gameId: number, propertyData: Partial<Property>): Promise<Property> {
  const result = await pool.query(
    `INSERT INTO properties (
      game_id, position, name, type, price, rent_levels,
      house_cost, hotel_cost, mortgage_value, color_group,
      owner_id, house_count, is_mortgaged, has_hotel
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
    RETURNING *`,
    [
      gameId,
      propertyData.position,
      propertyData.name,
      propertyData.type,
      propertyData.price,
      propertyData.rentLevels,
      propertyData.houseCost,
      propertyData.hotelCost,
      propertyData.mortgageValue,
      propertyData.colorGroup,
      propertyData.ownerId,
      propertyData.houseCount || 0,
      propertyData.isMortgaged || false,
      propertyData.hasHotel || false
    ]
  );
  return result.rows[0];
}

export async function payRent(
  gameId: number,
  playerId: number,
  propertyPosition: number
): Promise<{ tenantBalance: number; ownerBalance: number }> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Get property and its owner
    const propertyResult = await client.query(
      'SELECT * FROM properties WHERE game_id = $1 AND position = $2',
      [gameId, propertyPosition]
    );
    const property = propertyResult.rows[0];

    if (!property || !property.owner_id) {
      throw new Error('Property not found or has no owner');
    }

    // Get player and owner information
    const [playerResult, propertyOwnerResult] = await Promise.all([
      client.query('SELECT * FROM players WHERE id = $1', [playerId]),
      client.query('SELECT * FROM players WHERE id = $1', [property.owner_id])
    ]);

    const player = playerResult.rows[0];
    const owner = propertyOwnerResult.rows[0];

    if (!player || !owner) {
      throw new Error('Player or owner not found');
    }

    // Calculate rent based on property state
    const baseRent = property.rent_levels[0];
    let rentAmount = baseRent;
    if (property.house_count > 0) {
      rentAmount = property.rent_levels[property.house_count] || baseRent;
    }

    // Check if player can afford rent
    if (player.balance < rentAmount) {
      throw new Error('Insufficient funds to pay rent');
    }

    // Transfer rent money
    const [payerResult, rentOwnerResult] = await Promise.all([
      client.query(
        'UPDATE players SET balance = balance - $1 WHERE id = $2 RETURNING balance',
        [rentAmount, playerId]
      ),
      client.query(
        'UPDATE players SET balance = balance + $1 WHERE id = $2 RETURNING balance',
        [rentAmount, property.owner_id]
      )
    ]);

    await client.query('COMMIT');
    return {
      tenantBalance: payerResult.rows[0].balance,
      ownerBalance: rentOwnerResult.rows[0].balance
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function getGameState(gameId: number): Promise<any> {
  const result = await pool.query('SELECT game_state FROM games WHERE id = $1', [gameId]);
  return result.rows[0]?.game_state || null;
}

export async function getProperty(gameId: number, position: number): Promise<Property | null> {
  const result = await pool.query(
    'SELECT * FROM properties WHERE game_id = $1 AND position = $2',
    [gameId, position]
  );
  
  if (!result.rows[0]) return null;
  
  // Map database fields to interface fields
  const dbProperty = result.rows[0];
  return {
    id: dbProperty.id,
    gameId: dbProperty.game_id,
    position: dbProperty.position,
    name: dbProperty.name,
    type: dbProperty.type,
    price: dbProperty.price,
    rentLevels: dbProperty.rent_levels,
    houseCost: dbProperty.house_cost,
    hotelCost: dbProperty.hotel_cost,
    mortgageValue: dbProperty.mortgage_value,
    isMortgaged: dbProperty.is_mortgaged,
    houseCount: dbProperty.house_count,
    hasHotel: dbProperty.has_hotel,
    colorGroup: dbProperty.color_group,
    ownerId: dbProperty.owner_id,
    createdAt: dbProperty.created_at,
    updatedAt: dbProperty.updated_at
  };
}

export async function getPlayer(gameId: number, playerId: number): Promise<Player | null> {
  const result = await pool.query(
    'SELECT * FROM players WHERE game_id = $1 AND user_id = $2',
    [gameId, playerId]
  );
  return result.rows[0] || null;
}

export async function purchaseProperty(
  gameId: number,
  playerId: number,
  position: number
): Promise<{
  success: boolean;
  error?: string;
  property?: Property;
  player?: Player;
}> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Get property and player in a transaction
    const property = await getProperty(gameId, position);
    const player = await getPlayer(gameId, playerId);

    if (!property || !player) {
      await client.query('ROLLBACK');
      return {
        success: false,
        error: !property ? 'Property not found' : 'Player not found'
      };
    }

    if (property.ownerId !== null) {
      await client.query('ROLLBACK');
      return {
        success: false,
        error: 'Property is already owned'
      };
    }

    if (player.balance < property.price) {
      await client.query('ROLLBACK');
      return {
        success: false,
        error: 'Insufficient funds'
      };
    }

    // Update property ownership
    await client.query(
      'UPDATE properties SET owner_id = $1 WHERE game_id = $2 AND position = $3',
      [playerId, gameId, position]
    );

    // Update player balance
    await client.query(
      'UPDATE players SET balance = balance - $1 WHERE game_id = $2 AND user_id = $3',
      [property.price, gameId, playerId]
    );

    // Get updated property and player
    const updatedProperty = await getProperty(gameId, position);
    const updatedPlayer = await getPlayer(gameId, playerId);

    await client.query('COMMIT');

    return {
      success: true,
      property: updatedProperty || undefined,
      player: updatedPlayer || undefined
    };
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Purchase property error:', error);
    return {
      success: false,
      error: 'Transaction failed'
    };
  } finally {
    client.release();
  }
}
  