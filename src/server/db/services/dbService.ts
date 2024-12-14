import { pool } from '../config';
import { User, Game, Player, Property } from '../models/types';
import { BOARD_SPACES, BoardSpace } from '../../shared/boardData';
import { BotService } from '../../services/botService';

type BotStrategy = 'aggressive' | 'conservative' | 'balanced';
type BotDifficulty = 'easy' | 'medium' | 'hard';

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
async function initializeGameProperties(gameId: number, client: any): Promise<void> {
  // Clear any existing properties for this game
  await client.query('DELETE FROM properties WHERE game_id = $1', [gameId]);
  
  // Initialize properties from board data
  for (const space of BOARD_SPACES) {
    if (space.type === 'property' || space.type === 'railroad' || space.type === 'utility') {
      await client.query(
        'INSERT INTO properties (game_id, position, name, owner_id, house_count, mortgaged, price) VALUES ($1, $2, $3, $4, $5, $6, $7)',
        [gameId, space.position, space.name, null, 0, false, space.price]
      );
    }
  }
}

export async function createGame(ownerId: number): Promise<Game> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Check if user exists and get username
    const userResult = await client.query('SELECT * FROM users WHERE id = $1', [ownerId]);
    const user = userResult.rows[0];
    if (!user) {
      throw new Error('User not found');
    }

    // Create game with initial game state
    const initialGameState = {
      phase: 'waiting',
      current_player_index: 0,
      dice_rolls: [],
      turn_order: []
    };

    const gameResult = await client.query(
      'INSERT INTO games (owner_id, status, game_state) VALUES ($1, $2, $3) RETURNING *',
      [ownerId, 'waiting', initialGameState]
    );
    const game = gameResult.rows[0];

    // Initialize properties for the game
    await initializeGameProperties(game.id, client);

    // Add owner as first player with username
    await client.query(
      'INSERT INTO players (game_id, user_id, username, is_bot, balance, position) VALUES ($1, $2, $3, $4, $5, $6)',
      [game.id, ownerId, user.username, false, 1500, 0]
    );

    await client.query('COMMIT');
    return game;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function getGame(gameId: number): Promise<Game | null> {
  if (!gameId || isNaN(gameId)) {
    console.error('Invalid game ID:', gameId);
    return null;
  }

  try {
    const result = await pool.query(
      'SELECT * FROM games WHERE id = $1',
      [gameId]
    );
    return result.rows[0] || null;
  } catch (error) {
    console.error('Error getting game:', error);
    throw error;
  }
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

export async function getGamePlayers(gameId: number): Promise<Player[]> {
  if (!gameId || isNaN(gameId)) {
    console.error('Invalid game ID for players:', gameId);
    return [];
  }

  try {
    const result = await pool.query(
      'SELECT * FROM players WHERE game_id = $1 ORDER BY id',
      [gameId]
    );
    return result.rows;
  } catch (error) {
    console.error('Error getting game players:', error);
    throw error;
  }
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
  if (!gameId || isNaN(gameId)) {
    console.error('Invalid game ID for properties:', gameId);
    return [];
  }

  try {
    const result = await pool.query(
      'SELECT * FROM properties WHERE game_id = $1 ORDER BY position',
      [gameId]
    );
    return result.rows;
  } catch (error) {
    console.error('Error getting game properties:', error);
    throw error;
  }
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

    console.log('Starting property purchase:', {
      gameId,
      position,
      playerId
    });

    // Get the property details from board data
    const propertyData = BOARD_SPACES.find((space: BoardSpace) => space.position === position);
    if (!propertyData || !['property', 'railroad', 'utility'].includes(propertyData.type) || !propertyData.price) {
      console.error('Invalid property data:', { propertyData, position });
      throw new Error('Invalid property position or not a purchasable property');
    }

    // Check if property exists and is unowned
    const property = await getPropertyByPosition(gameId, position);
    console.log('Found property:', property);
    
    if (property && property.owner_id !== null) {
      console.error('Property already owned:', property);
      throw new Error('Property already owned');
    }

    // Get player's current balance
    const playerResult = await client.query(
      'SELECT balance FROM players WHERE game_id = $1 AND id = $2',
      [gameId, playerId]
    );

    if (playerResult.rows.length === 0) {
      console.error('Player not found:', { gameId, playerId });
      throw new Error('Player not found');
    }

    const playerBalance = playerResult.rows[0].balance;
    if (playerBalance < propertyData.price) {
      console.error('Insufficient funds:', { playerBalance, price: propertyData.price });
      throw new Error('Insufficient funds');
    }

    let updatedProperty;
    if (property) {
      // Update existing property
      console.log('Updating existing property:', property);
      updatedProperty = await client.query(
        'UPDATE properties SET owner_id = $1, updated_at = NOW() WHERE game_id = $2 AND position = $3 RETURNING *',
        [playerId, gameId, position]
      );
    } else {
      // Create new property
      console.log('Creating new property:', propertyData);
      updatedProperty = await client.query(
        'INSERT INTO properties (game_id, name, owner_id, position, price) VALUES ($1, $2, $3, $4, $5) RETURNING *',
        [gameId, propertyData.name, playerId, position, propertyData.price]
      );
    }

    // Deduct money from player
    const updateResult = await client.query(
      'UPDATE players SET balance = balance - $1 WHERE game_id = $2 AND id = $3 RETURNING balance',
      [propertyData.price, gameId, playerId]
    );

    console.log('Purchase completed:', {
      property: updatedProperty.rows[0],
      newBalance: updateResult.rows[0].balance
    });

    await client.query('COMMIT');
    
    return {
      ...updatedProperty.rows[0],
      newBalance: updateResult.rows[0].balance
    };
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Property purchase error:', error);
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

export async function processRentPayment(
  gameId: number,
  payerId: number,
  ownerId: number,
  rentAmount: number
): Promise<{ payerBalance: number; ownerBalance: number }> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Check if payer has enough money
    const payerResult = await client.query(
      'SELECT balance FROM players WHERE game_id = $1 AND id = $2',
      [gameId, payerId]
    );

    if (payerResult.rows.length === 0) {
      throw new Error('Payer not found');
    }

    const payerBalance = payerResult.rows[0].balance;
    if (payerBalance < rentAmount) {
      throw new Error('Insufficient funds to pay rent');
    }

    // Update payer's balance
    const updatedPayerResult = await client.query(
      'UPDATE players SET balance = balance - $1 WHERE game_id = $2 AND id = $3 RETURNING balance',
      [rentAmount, gameId, payerId]
    );

    // Update owner's balance
    const updatedOwnerResult = await client.query(
      'UPDATE players SET balance = balance + $1 WHERE game_id = $2 AND id = $3 RETURNING balance',
      [rentAmount, gameId, ownerId]
    );

    await client.query('COMMIT');

    return {
      payerBalance: updatedPayerResult.rows[0].balance,
      ownerBalance: updatedOwnerResult.rows[0].balance
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function createBotPlayer(
  gameId: number,
  strategyOrNumber: string | number = 'balanced',
  difficulty: string = 'medium'
): Promise<Player> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    let strategy: string;
    if (typeof strategyOrNumber === 'number') {
      const strategies: BotStrategy[] = ['aggressive', 'conservative', 'balanced'];
      strategy = strategies[Math.floor(Math.random() * strategies.length)];
    } else {
      strategy = strategyOrNumber;
    }

    // Generate bot name based on strategy and difficulty
    const botName = BotService.generateBotName(strategy, difficulty);

    // Check if game exists and has space
    const gameResult = await client.query(
      'SELECT COUNT(p.id) as player_count FROM games g LEFT JOIN players p ON g.id = p.game_id WHERE g.id = $1',
      [gameId]
    );

    if (!gameResult.rows[0] || gameResult.rows[0].player_count >= 4) {
      throw new Error('Game is full or does not exist');
    }

    // Create bot player
    const result = await client.query(
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

    await client.query('COMMIT');
    return result.rows[0];
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function isPlayerBot(gameId: number, playerId: number): Promise<boolean> {
  const result = await pool.query(
    'SELECT is_bot FROM players WHERE game_id = $1 AND id = $2',
    [gameId, playerId]
  );
  return result.rows[0]?.is_bot || false;
}

async function cleanupStaleGames(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Delete games that are empty (no players)
    await client.query(`
      DELETE FROM games 
      WHERE id IN (
        SELECT g.id 
        FROM games g 
        LEFT JOIN players p ON g.id = p.game_id 
        GROUP BY g.id 
        HAVING COUNT(p.id) = 0
      )
    `);

    // Mark old waiting games as finished
    await client.query(`
      UPDATE games 
      SET status = 'finished' 
      WHERE status = 'waiting' 
      AND created_at < NOW() - INTERVAL '24 hours'
    `);

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function getGames(): Promise<any[]> {
  await cleanupStaleGames();
  
  const result = await pool.query(`
    SELECT 
      g.*,
      COUNT(p.id) as total_players,
      COUNT(p.id) filter (where not p.is_bot) as human_count,
      COUNT(p.id) filter (where p.is_bot) as bot_count,
      json_agg(json_build_object(
        'id', p.id,
        'username', p.username,
        'is_bot', p.is_bot
      )) as players
    FROM games g
    LEFT JOIN players p ON g.id = p.game_id
    WHERE g.status = 'waiting'
    GROUP BY g.id
    ORDER BY g.created_at DESC
  `);
  return result.rows;
}

export async function getUserById(userId: number): Promise<User | null> {
  const result = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);
  return result.rows[0] || null;
}

async function isPlayerInAnyGame(userId: number): Promise<boolean> {
  const result = await pool.query(`
    SELECT COUNT(*) as count 
    FROM players p 
    JOIN games g ON p.game_id = g.id 
    WHERE p.user_id = $1 
    AND g.status = 'waiting' 
    AND NOT p.is_bot
  `, [userId]);
  return parseInt(result.rows[0].count) > 0;
}

async function leaveExistingGames(userId: number): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Get all games where the user is a player
    const games = await client.query(`
      SELECT DISTINCT g.id 
      FROM games g 
      JOIN players p ON g.id = p.game_id 
      WHERE p.user_id = $1 AND g.status = 'waiting'
    `, [userId]);

    // Remove the player from these games
    for (const game of games.rows) {
      await client.query(
        'DELETE FROM players WHERE game_id = $1 AND user_id = $2',
        [game.id, userId]
      );
    }

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function joinGame(gameId: number, userId: number): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Check if user exists
    const userResult = await client.query('SELECT * FROM users WHERE id = $1', [userId]);
    if (!userResult.rows[0]) {
      throw new Error('User not found');
    }

    // Leave any existing games
    await leaveExistingGames(userId);

    // Check if player is already in this specific game
    const existingPlayer = await client.query(
      'SELECT * FROM players WHERE game_id = $1 AND user_id = $2',
      [gameId, userId]
    );

    if (existingPlayer.rows.length > 0) {
      throw new Error('Already in this game');
    }

    // Check player count
    const playerCount = await client.query(
      'SELECT COUNT(*) as count FROM players WHERE game_id = $1',
      [gameId]
    );

    if (playerCount.rows[0].count >= 4) {
      throw new Error('Game is full');
    }

    // Add player to game
    await client.query(
      'INSERT INTO players (game_id, user_id, username, is_bot) VALUES ($1, $2, $3, $4)',
      [gameId, userId, userResult.rows[0].username, false]
    );

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function updateGameState(gameId: number, gameState: any): Promise<void> {
  await pool.query(
    'UPDATE games SET game_state = $1 WHERE id = $2',
    [gameState, gameId]
  );
}

export async function getGameById(gameId: number): Promise<Game | null> {
  const result = await pool.query(
    'SELECT * FROM games WHERE id = $1',
    [gameId]
  );
  return result.rows[0] || null;
}

export async function payRent(gameId: number, playerId: number, propertyPosition: number): Promise<{ tenantBalance: number; ownerBalance: number }> {
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

    // Get the property details from board data
    const boardSpace = BOARD_SPACES[propertyPosition];
    if (!boardSpace || boardSpace.type !== 'property' || typeof boardSpace.rent !== 'number') {
      throw new Error('Invalid property position');
    }

    // Get player and owner information
    const [playerResult, ownerResult] = await Promise.all([
      client.query('SELECT * FROM players WHERE id = $1', [playerId]),
      client.query('SELECT * FROM players WHERE id = $1', [property.owner_id])
    ]);

    const player = playerResult.rows[0];
    const owner = ownerResult.rows[0];

    if (!player || !owner) {
      throw new Error('Player or owner not found');
    }

    // Calculate rent based on property state
    const baseRent: number = boardSpace.rent;
    let rentAmount: number = baseRent;
    if (property.house_count > 0) {
      rentAmount = baseRent * (property.house_count + 1);
    }

    // Check if player can afford rent
    if (player.balance < rentAmount) {
      throw new Error('Insufficient funds to pay rent');
    }

    // Transfer rent money
    const newTenantBalance: number = player.balance - rentAmount;
    const newOwnerBalance: number = owner.balance + rentAmount;

    await Promise.all([
      client.query(
        'UPDATE players SET balance = $1 WHERE id = $2',
        [newTenantBalance, playerId]
      ),
      client.query(
        'UPDATE players SET balance = $1 WHERE id = $2',
        [newOwnerBalance, property.owner_id]
      )
    ]);

    await client.query('COMMIT');
    return { tenantBalance: newTenantBalance, ownerBalance: newOwnerBalance };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

// Delete a game (owner only)
export const deleteGame = async (gameId: number, userId: number): Promise<void> => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Verify user is the game owner
    const game = await client.query(
      'SELECT owner_id FROM games WHERE id = $1',
      [gameId]
    );

    if (!game.rows[0] || game.rows[0].owner_id !== userId) {
      throw new Error('Unauthorized: Only the game owner can delete the game');
    }

    // Delete all related records (players, properties, etc.)
    await client.query('DELETE FROM players WHERE game_id = $1', [gameId]);
    await client.query('DELETE FROM properties WHERE game_id = $1', [gameId]);
    await client.query('DELETE FROM games WHERE id = $1', [gameId]);

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

// Leave a game
export const leaveGame = async (gameId: number, userId: number): Promise<void> => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Check if game is in waiting status
    const game = await client.query(
      'SELECT status FROM games WHERE id = $1',
      [gameId]
    );

    if (!game.rows[0] || game.rows[0].status !== 'waiting') {
      throw new Error('Cannot leave a game that has already started');
    }

    // Remove the player from the game
    await client.query(
      'DELETE FROM players WHERE game_id = $1 AND user_id = $2',
      [gameId, userId]
    );

    // Update game status if no players left
    const remainingPlayers = await client.query(
      'SELECT COUNT(*) as count FROM players WHERE game_id = $1',
      [gameId]
    );

    if (remainingPlayers.rows[0].count === 0) {
      await client.query(
        'DELETE FROM games WHERE id = $1',
        [gameId]
      );
    }

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}; 