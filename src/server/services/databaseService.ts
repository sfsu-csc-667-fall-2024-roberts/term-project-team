import { Pool, QueryResult } from 'pg';
import { GameState, Player, Property, GamePhase, GameEvent, Game } from '../../shared/types';
import { User } from '../models/users';

export class DatabaseService {
    private static instance: DatabaseService | null = null;
    private pool: Pool | null = null;
    private isClosing: boolean = false;

    private constructor() {
        console.log('[DatabaseService] Constructor called at:', new Date().toISOString());
        this.initializePool();
    }

    private initializePool() {
        if (this.pool) {
            console.log('[DatabaseService] Pool already exists, skipping initialization at:', new Date().toISOString());
            return;
        }

        console.log('[DatabaseService] Starting pool initialization at:', new Date().toISOString());
        console.log('[DatabaseService] Config:', {
            user: process.env.DB_USER || 'postgres',
            host: process.env.DB_HOST || 'localhost',
            database: process.env.DB_NAME || 'monopoly',
            port: parseInt(process.env.DB_PORT || '5432')
        });
        
        this.pool = new Pool({
            user: process.env.DB_USER || 'postgres',
            host: process.env.DB_HOST || 'localhost',
            database: process.env.DB_NAME || 'monopoly',
            password: process.env.DB_PASSWORD || 'postgres',
            port: parseInt(process.env.DB_PORT || '5432'),
            max: 20,
            idleTimeoutMillis: 1000,
            connectionTimeoutMillis: 1000,
            allowExitOnIdle: true
        });

        // Test the connection
        this.pool.connect()
            .then(() => console.log('[DatabaseService] Successfully connected to the database at:', new Date().toISOString()))
            .catch(err => console.error('[DatabaseService] Failed to connect to the database:', err));

        // Handle pool errors
        this.pool.on('error', (err) => {
            console.error('[DatabaseService] Pool error at:', new Date().toISOString(), err);
        });

        // Add pool event listeners for debugging
        this.pool.on('connect', () => {
            console.log('[DatabaseService] New client connected to pool at:', new Date().toISOString());
        });

        this.pool.on('acquire', () => {
            console.log('[DatabaseService] Client acquired from pool at:', new Date().toISOString());
        });

        this.pool.on('remove', () => {
            console.log('[DatabaseService] Client removed from pool at:', new Date().toISOString());
        });
    }

    public static getInstance(): DatabaseService {
        if (!DatabaseService.instance) {
            console.log('[DatabaseService] Creating new instance at:', new Date().toISOString());
            DatabaseService.instance = new DatabaseService();
        }
        return DatabaseService.instance;
    }

    public async close(forceExit: boolean = false): Promise<void> {
        console.log('[DatabaseService] Close requested at:', new Date().toISOString(), 'forceExit:', forceExit);
        
        if (this.isClosing) {
            console.log('[DatabaseService] Already closing at:', new Date().toISOString());
            return;
        }

        this.isClosing = true;
        console.log('[DatabaseService] Starting pool closure at:', new Date().toISOString());
        
        try {
            if (this.pool) {
                console.log('[DatabaseService] Active pool found, ending at:', new Date().toISOString());
                
                // Create a promise that times out after 1 second
                const closePromise = Promise.race([
                    this.pool.end(),
                    new Promise((_, reject) => 
                        setTimeout(() => reject(new Error('Pool close timed out')), 1000)
                    )
                ]);

                try {
                    await closePromise;
                    console.log('[DatabaseService] Pool ended successfully at:', new Date().toISOString());
                } catch (error) {
                    console.log('[DatabaseService] Pool close timed out, forcing shutdown at:', new Date().toISOString());
                    // Force nullify the pool even if close timed out
                }

                this.pool = null;
                if (forceExit) {
                    console.log('[DatabaseService] Force exit requested, nullifying instance at:', new Date().toISOString());
                    DatabaseService.instance = null;
                }
            } else {
                console.log('[DatabaseService] No active pool to close at:', new Date().toISOString());
            }
        } catch (error) {
            console.error('[DatabaseService] Error closing pool at:', new Date().toISOString(), error);
            // Still nullify the pool on error when force exiting
            if (forceExit) {
                this.pool = null;
                DatabaseService.instance = null;
            }
            throw error;
        } finally {
            this.isClosing = false;
            console.log('[DatabaseService] Close operation completed at:', new Date().toISOString());
        }
    }

    private async getPoolSize(): Promise<number> {
        if (!this.pool) return 0;
        try {
            const result = await this.pool.query('SELECT count(*) as count FROM pg_stat_activity WHERE datname = $1', [process.env.DB_NAME || 'monopoly']);
            return parseInt(result.rows[0].count);
        } catch (error) {
            console.error('[DatabaseService] Error getting pool size:', error);
            return -1;
        }
    }

    // Make pool accessible to subclasses and other services
    public getPool(): Pool {
        if (!this.pool) {
            this.initializePool();
        }
        if (!this.pool) {
            throw new Error('Failed to initialize database pool');
        }
        return this.pool;
    }

    private ensurePool(): Pool {
        if (!this.pool) {
            this.initializePool();
        }
        if (!this.pool) {
            throw new Error('Failed to initialize database pool');
        }
        return this.pool;
    }

    async getPlayer(playerId: number): Promise<Player | null> {
        const result = await this.ensurePool().query(
            'SELECT p.id, u.username as name, gp.position, gp.money, gp.properties, gp.is_jailed as "isJailed", gp.turns_in_jail as "turnsInJail", gp.is_bankrupt as "isBankrupt", gp.jail_free_cards as "jailFreeCards" FROM game_players gp JOIN players p ON gp.player_id = p.id JOIN users u ON p.user_id = u.id WHERE p.id = $1',
            [playerId]
        );
        return result.rows[0] || null;
    }

    async updatePlayer(playerId: number, updates: Partial<Player>, gameId?: number): Promise<void> {
        const setClause = Object.entries(updates)
            .map(([key, _], index) => `${this.snakeCaseKey(key)} = $${index + 2}`)
            .join(', ');
        
        const whereClause = gameId ? 'WHERE player_id = $1 AND game_id = $' + (Object.keys(updates).length + 2) : 'WHERE player_id = $1';
        const params = gameId ? [playerId, ...Object.values(updates), gameId] : [playerId, ...Object.values(updates)];
        
        await this.ensurePool().query(
            `UPDATE game_players SET ${setClause} ${whereClause}`,
            params
        );
    }

    async updateProperty(propertyId: number, updates: Partial<Property>): Promise<void> {
        const setClause = Object.entries(updates)
            .map(([key, _], index) => `${this.snakeCaseKey(key)} = $${index + 2}`)
            .join(', ');
        
        await this.ensurePool().query(
            `UPDATE game_properties SET ${setClause} WHERE id = $1`,
            [propertyId, ...Object.values(updates)]
        );
    }

    async getPlayerById(playerId: number): Promise<Player | null> {
        return this.getPlayer(playerId);
    }

    async getPropertyById(propertyId: number): Promise<Property | null> {
        return this.getProperty(propertyId);
    }

    async getPlayerProperties(gameId: number, playerId: number): Promise<Property[]> {
        const result = await this.ensurePool().query(
            'SELECT * FROM game_properties WHERE game_id = $1 AND owner_id = $2',
            [gameId, playerId]
        );
        return this.mapProperties(result.rows);
    }

    async buyProperty(propertyId: number, playerId: number, price: number): Promise<void> {
        const client = await this.ensurePool().connect();
        try {
            await client.query('BEGIN');
            
            await client.query(
                'UPDATE game_properties SET owner_id = $1 WHERE id = $2',
                [playerId, propertyId]
            );
            
            await client.query(
                'UPDATE game_players SET money = money - $1 WHERE player_id = $2',
                [price, playerId]
            );
            
            await client.query('COMMIT');
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    async query(text: string, params?: any[]): Promise<QueryResult> {
        return await this.ensurePool().query(text, params);
    }

    async createGame(name: string, maxPlayers: number): Promise<number> {
        const client = await this.ensurePool().connect();
        try {
            await client.query('BEGIN');

            // Create the game
            const insertQuery = `
                INSERT INTO games (
                    name, max_players, game_phase, 
                    current_player_id, winner, dice_roll,
                    doubles_count, turn_count,
                    created_at, updated_at
                ) VALUES (
                    $1, $2, $3, 
                    NULL, NULL, NULL,
                    0, 0,
                    CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
                ) RETURNING id
            `;
            console.log('Creating game with query:', insertQuery);

            const result = await client.query(insertQuery, [name, maxPlayers, 'WAITING']);
            const gameId = result.rows[0].id;

            // Initialize game properties from BOARD_SPACES
            const COLOR_GROUPS = {
                brown: '#8B4513',
                lightblue: '#87CEEB',
                pink: '#FF69B4',
                orange: '#FFA500',
                red: '#FF0000',
                yellow: '#FFFF00',
                green: '#008000',
                blue: '#0000FF',
                railroad: '#000000',
                utility: '#808080'
            };

            const BOARD_SPACES = [
                { position: 0, name: "GO", type: "special" },
                { position: 1, name: "Mediterranean Avenue", type: "property", price: 60, rentLevels: [2, 10, 30, 90, 160, 250], houseCost: 50, hotelCost: 50, mortgageValue: 30, colorGroup: "brown", color: COLOR_GROUPS.brown },
                { position: 2, name: "Community Chest", type: "special" },
                { position: 3, name: "Baltic Avenue", type: "property", price: 60, rentLevels: [4, 20, 60, 180, 320, 450], houseCost: 50, hotelCost: 50, mortgageValue: 30, colorGroup: "brown", color: COLOR_GROUPS.brown },
                { position: 4, name: "Income Tax", type: "special" },
                { position: 5, name: "Reading Railroad", type: "railroad", price: 200, rentLevels: [25, 50, 100, 200], mortgageValue: 100, color: COLOR_GROUPS.railroad },
                { position: 6, name: "Oriental Avenue", type: "property", price: 100, rentLevels: [6, 30, 90, 270, 400, 550], houseCost: 50, hotelCost: 50, mortgageValue: 50, colorGroup: "lightblue", color: COLOR_GROUPS.lightblue },
                { position: 7, name: "Chance", type: "special" },
                { position: 8, name: "Vermont Avenue", type: "property", price: 100, rentLevels: [6, 30, 90, 270, 400, 550], houseCost: 50, hotelCost: 50, mortgageValue: 50, colorGroup: "lightblue", color: COLOR_GROUPS.lightblue },
                { position: 9, name: "Connecticut Avenue", type: "property", price: 120, rentLevels: [8, 40, 100, 300, 450, 600], houseCost: 50, hotelCost: 50, mortgageValue: 60, colorGroup: "lightblue", color: COLOR_GROUPS.lightblue },
                { position: 10, name: "Jail", type: "special" },
                { position: 11, name: "St. Charles Place", type: "property", price: 140, rentLevels: [10, 50, 150, 450, 625, 750], houseCost: 100, hotelCost: 100, mortgageValue: 70, colorGroup: "pink", color: COLOR_GROUPS.pink },
                { position: 12, name: "Electric Company", type: "utility", price: 150, rentLevels: [4, 10], mortgageValue: 75, color: COLOR_GROUPS.utility },
                { position: 13, name: "States Avenue", type: "property", price: 140, rentLevels: [10, 50, 150, 450, 625, 750], houseCost: 100, hotelCost: 100, mortgageValue: 70, colorGroup: "pink", color: COLOR_GROUPS.pink },
                { position: 14, name: "Virginia Avenue", type: "property", price: 160, rentLevels: [12, 60, 180, 500, 700, 900], houseCost: 100, hotelCost: 100, mortgageValue: 80, colorGroup: "pink", color: COLOR_GROUPS.pink },
                { position: 15, name: "Pennsylvania Railroad", type: "railroad", price: 200, rentLevels: [25, 50, 100, 200], mortgageValue: 100, color: COLOR_GROUPS.railroad },
                { position: 16, name: "St. James Place", type: "property", price: 180, rentLevels: [14, 70, 200, 550, 750, 950], houseCost: 100, hotelCost: 100, mortgageValue: 90, colorGroup: "orange", color: COLOR_GROUPS.orange },
                { position: 17, name: "Community Chest", type: "special" },
                { position: 18, name: "Tennessee Avenue", type: "property", price: 180, rentLevels: [14, 70, 200, 550, 750, 950], houseCost: 100, hotelCost: 100, mortgageValue: 90, colorGroup: "orange", color: COLOR_GROUPS.orange },
                { position: 19, name: "New York Avenue", type: "property", price: 200, rentLevels: [16, 80, 220, 600, 800, 1000], houseCost: 100, hotelCost: 100, mortgageValue: 100, colorGroup: "orange", color: COLOR_GROUPS.orange },
                { position: 20, name: "Free Parking", type: "special" },
                { position: 21, name: "Kentucky Avenue", type: "property", price: 220, rentLevels: [18, 90, 250, 700, 875, 1050], houseCost: 150, hotelCost: 150, mortgageValue: 110, colorGroup: "red", color: COLOR_GROUPS.red },
                { position: 22, name: "Chance", type: "special" },
                { position: 23, name: "Indiana Avenue", type: "property", price: 220, rentLevels: [18, 90, 250, 700, 875, 1050], houseCost: 150, hotelCost: 150, mortgageValue: 110, colorGroup: "red", color: COLOR_GROUPS.red },
                { position: 24, name: "Illinois Avenue", type: "property", price: 240, rentLevels: [20, 100, 300, 750, 925, 1100], houseCost: 150, hotelCost: 150, mortgageValue: 120, colorGroup: "red", color: COLOR_GROUPS.red },
                { position: 25, name: "B. & O. Railroad", type: "railroad", price: 200, rentLevels: [25, 50, 100, 200], mortgageValue: 100, color: COLOR_GROUPS.railroad },
                { position: 26, name: "Atlantic Avenue", type: "property", price: 260, rentLevels: [22, 110, 330, 800, 975, 1150], houseCost: 150, hotelCost: 150, mortgageValue: 130, colorGroup: "yellow", color: COLOR_GROUPS.yellow },
                { position: 27, name: "Ventnor Avenue", type: "property", price: 260, rentLevels: [22, 110, 330, 800, 975, 1150], houseCost: 150, hotelCost: 150, mortgageValue: 130, colorGroup: "yellow", color: COLOR_GROUPS.yellow },
                { position: 28, name: "Water Works", type: "utility", price: 150, rentLevels: [4, 10], mortgageValue: 75, color: COLOR_GROUPS.utility },
                { position: 29, name: "Marvin Gardens", type: "property", price: 280, rentLevels: [24, 120, 360, 850, 1025, 1200], houseCost: 150, hotelCost: 150, mortgageValue: 140, colorGroup: "yellow", color: COLOR_GROUPS.yellow },
                { position: 30, name: "Go To Jail", type: "special" },
                { position: 31, name: "Pacific Avenue", type: "property", price: 300, rentLevels: [26, 130, 390, 900, 1100, 1275], houseCost: 200, hotelCost: 200, mortgageValue: 150, colorGroup: "green", color: COLOR_GROUPS.green },
                { position: 32, name: "North Carolina Avenue", type: "property", price: 300, rentLevels: [26, 130, 390, 900, 1100, 1275], houseCost: 200, hotelCost: 200, mortgageValue: 150, colorGroup: "green", color: COLOR_GROUPS.green },
                { position: 33, name: "Community Chest", type: "special" },
                { position: 34, name: "Pennsylvania Avenue", type: "property", price: 320, rentLevels: [28, 150, 450, 1000, 1200, 1400], houseCost: 200, hotelCost: 200, mortgageValue: 160, colorGroup: "green", color: COLOR_GROUPS.green },
                { position: 35, name: "Short Line", type: "railroad", price: 200, rentLevels: [25, 50, 100, 200], mortgageValue: 100, color: COLOR_GROUPS.railroad },
                { position: 36, name: "Chance", type: "special" },
                { position: 37, name: "Park Place", type: "property", price: 350, rentLevels: [35, 175, 500, 1100, 1300, 1500], houseCost: 200, hotelCost: 200, mortgageValue: 175, colorGroup: "blue", color: COLOR_GROUPS.blue },
                { position: 38, name: "Luxury Tax", type: "special" },
                { position: 39, name: "Boardwalk", type: "property", price: 400, rentLevels: [50, 200, 600, 1400, 1700, 2000], houseCost: 200, hotelCost: 200, mortgageValue: 200, colorGroup: "blue", color: COLOR_GROUPS.blue }
            ];

            // Insert properties for the game
            for (const space of BOARD_SPACES) {
                if (space.type === 'property' || space.type === 'railroad' || space.type === 'utility') {
                    await client.query(
                        `INSERT INTO game_properties (
                            game_id, name, position, price, rent, type, color_group,
                            mortgaged, house_cost, hotel_cost, rent_levels,
                            mortgage_value, current_rent, can_be_improved, color
                        ) VALUES ($1, $2, $3, $4, $5, $6, $7, false, $8, $9, $10, $11, $12, $13, $14)`,
                        [
                            gameId,
                            space.name,
                            space.position,
                            space.price || 0,
                            space.rentLevels ? space.rentLevels[0] : 0,
                            space.type,
                            space.colorGroup || null,
                            space.houseCost || 0,
                            space.hotelCost || 0,
                            space.rentLevels || [],
                            space.mortgageValue || 0,
                            space.rentLevels ? space.rentLevels[0] : 0,
                            space.type === 'property',
                            space.color || null
                        ]
                    );
                }
            }

            await client.query('COMMIT');
            return gameId;
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    async getGame(gameId: number): Promise<GameState | null> {
        const result = await this.ensurePool().query(
            'SELECT id, game_phase as "gamePhase", current_player_id as "currentPlayerId", winner, dice_roll as "diceRoll", doubles_count as "doublesCount", turn_count as "turnCount" FROM games WHERE id = $1',
            [gameId]
        );
        
        if (!result.rows[0]) return null;

        const [players, properties] = await Promise.all([
            this.getPlayersInGame(gameId),
            this.getPropertiesInGame(gameId)
        ]);

        return {
            ...result.rows[0],
            players,
            properties,
            bankruptPlayers: [],
            jailFreeCards: {},
            gameLog: [],
            turnOrder: players.map(p => p.id)
        };
    }

    async addPlayerToGame(gameId: number, playerId: number): Promise<boolean> {
        const client = await this.ensurePool().connect();
        try {
            await client.query('BEGIN');

            // Check if player is already in the game
            const existingPlayer = await client.query(
                'SELECT 1 FROM game_players WHERE game_id = $1 AND player_id = $2',
                [gameId, playerId]
            );

            if (existingPlayer.rows.length > 0) {
                await client.query('ROLLBACK');
                return false;
            }

            // Check if game is full
            const gameResult = await client.query(
                'SELECT max_players, (SELECT COUNT(*) FROM game_players WHERE game_id = $1) as player_count FROM games WHERE id = $1',
                [gameId]
            );

            if (gameResult.rows[0].player_count >= gameResult.rows[0].max_players) {
                await client.query('ROLLBACK');
                return false;
            }

            // Add player to game
            await client.query(
                `INSERT INTO game_players (
                    game_id, player_id, position, money,
                    is_jailed, turns_in_jail, is_bankrupt, jail_free_cards,
                    properties
                ) VALUES ($1, $2, 0, 1500, false, 0, false, 0, '{}')`,
                [gameId, playerId]
            );

            // If this is the first player, set them as the current player
            if (gameResult.rows[0].player_count === 0) {
                await client.query(
                    'UPDATE games SET current_player_id = $1, game_phase = $2 WHERE id = $3',
                    [playerId, 'ROLL', gameId]
                );
            }

            await client.query('COMMIT');
            return true;
        } catch (error) {
            await client.query('ROLLBACK');
            console.error('Error adding player to game:', error);
            throw error;
        } finally {
            client.release();
        }
    }

    private snakeCaseKey(key: string): string {
        return key.replace(/([A-Z])/g, '_$1').toLowerCase();
    }

    private mapProperties(rows: any[]): Property[] {
        return rows.map(row => ({
            id: row.id,
            name: row.name,
            price: row.price,
            rent: row.rent,
            ownerId: row.owner_id,
            type: row.type,
            color: row.color,
            mortgaged: row.mortgaged,
            houses: row.houses || 0,
            hotels: row.hotels || 0,
            houseCost: row.house_cost,
            hotelCost: row.hotel_cost,
            rentLevels: row.rent_levels,
            currentRent: row.current_rent,
            canBeImproved: row.can_be_improved,
            maxHouses: row.max_houses || 4,
            maxHotels: row.max_hotels || 1,
            position: row.position,
            colorGroup: row.color_group,
            houseCount: row.house_count || 0,
            hotelCount: row.hotel_count || 0,
            gameId: row.game_id
        }));
    }

    async updatePlayerPosition(gameId: number, playerId: number, position: number): Promise<void> {
        await this.ensurePool().query(
            'UPDATE game_players SET position = $1 WHERE game_id = $2 AND player_id = $3',
            [position, gameId, playerId]
        );
    }

    async updateGamePhase(gameId: number, phase: GamePhase): Promise<void> {
        await this.ensurePool().query(
            'UPDATE games SET game_phase = $1 WHERE id = $2',
            [phase, gameId]
        );
    }

    async updateDiceRoll(gameId: number, dice: number[]): Promise<void> {
        await this.ensurePool().query(
            'UPDATE games SET dice_roll = $1 WHERE id = $2',
            [dice, gameId]
        );
    }

    async updateCurrentPlayer(gameId: number, playerId: number): Promise<void> {
        await this.ensurePool().query(
            'UPDATE games SET current_player_id = $1 WHERE id = $2',
            [playerId, gameId]
        );
    }

    async updateWinner(gameId: number, playerId: number): Promise<void> {
        await this.ensurePool().query(
            'UPDATE games SET winner = $1 WHERE id = $2',
            [playerId, gameId]
        );
    }

    async updatePlayerMoney(playerId: number, money: number): Promise<void> {
        await this.ensurePool().query(
            'UPDATE game_players SET money = $1 WHERE player_id = $2',
            [money, playerId]
        );
    }

    async updatePropertyOwner(propertyId: number, playerId: number | null): Promise<void> {
        await this.ensurePool().query(
            'UPDATE game_properties SET owner_id = $1 WHERE id = $2',
            [playerId, propertyId]
        );
    }

    async getPlayersInGame(gameId: number): Promise<Player[]> {
        const result = await this.ensurePool().query(
            `SELECT 
                p.id,
                u.username,
                gp.position,
                gp.money,
                gp.properties,
                gp.is_jailed as "isJailed",
                gp.turns_in_jail as "turnsInJail",
                gp.is_bankrupt as "isBankrupt",
                gp.jail_free_cards as "jailFreeCards",
                gp.game_id as "gameId",
                false as "isBot"
            FROM game_players gp
            JOIN players p ON gp.player_id = p.id
            JOIN users u ON p.user_id = u.id
            WHERE gp.game_id = $1`,
            [gameId]
        );

        return result.rows.map(row => ({
            ...row,
            name: row.username,
            properties: row.properties || []
        }));
    }

    async getPropertiesInGame(gameId: number): Promise<Property[]> {
        const result = await this.ensurePool().query(
            'SELECT id, name, price, rent, owner_id as "ownerId", type, color, mortgaged, houses, hotels, house_cost as "houseCost", hotel_cost as "hotelCost", rent_levels as "rentLevels", current_rent as "currentRent", can_be_improved as "canBeImproved", max_houses as "maxHouses", max_hotels as "maxHotels", position, color_group as "colorGroup", house_count as "houseCount", hotel_count as "hotelCount" FROM game_properties WHERE game_id = $1',
            [gameId]
        );
        return this.mapProperties(result.rows);
    }

    async getPropertyByPosition(gameId: number, position: number): Promise<Property | null> {
        const result = await this.ensurePool().query(
            'SELECT id, name, price, rent, owner_id as "ownerId", type, color, mortgaged, houses, hotels, house_cost as "houseCost", hotel_cost as "hotelCost", rent_levels as "rentLevels", current_rent as "currentRent", can_be_improved as "canBeImproved", max_houses as "maxHouses", max_hotels as "maxHotels", position, color_group as "colorGroup", house_count as "houseCount", hotel_count as "hotelCount" FROM game_properties WHERE game_id = $1 AND position = $2',
            [gameId, position]
        );
        return result.rows[0] ? this.mapProperties([result.rows[0]])[0] : null;
    }

    async getProperty(propertyId: number): Promise<Property | null> {
        const result = await this.ensurePool().query(
            'SELECT id, name, price, rent, owner_id as "ownerId", type, color, mortgaged, houses, hotels, house_cost as "houseCost", hotel_cost as "hotelCost", rent_levels as "rentLevels", current_rent as "currentRent", can_be_improved as "canBeImproved", max_houses as "maxHouses", max_hotels as "maxHotels", position, color_group as "colorGroup", house_count as "houseCount", hotel_count as "hotelCount" FROM game_properties WHERE id = $1',
            [propertyId]
        );
        return result.rows[0] ? this.mapProperties([result.rows[0]])[0] : null;
    }

    async initialize(): Promise<void> {
        console.log('Starting database initialization...');
        try {
            console.log('Testing database connection...');
            await this.ensurePool().query('SELECT NOW()');
            console.log('Database connection test successful');
            
            console.log('Checking database tables...');
            const tablesResult = await this.ensurePool().query(`
                SELECT table_name 
                FROM information_schema.tables 
                WHERE table_schema = 'public'
            `);
            console.log('Available tables:', tablesResult.rows.map(row => row.table_name));
            
            console.log('Database initialization completed successfully');
        } catch (error) {
            console.error('Error during database initialization:', error);
            throw error;
        }
    }

    async updateGameState(gameId: number, updates: Partial<GameState>): Promise<void> {
        const client = await this.ensurePool().connect();
        try {
            await client.query('BEGIN');

            // Update game table fields
            const gameFields = [
                'game_phase',
                'current_player_id',
                'winner',
                'dice_roll',
                'doubles_count',
                'turn_count'
            ];

            const gameUpdateEntries = Object.entries(updates)
                .filter(([key]) => gameFields.includes(this.snakeCaseKey(key)))
                .map(([key, value]) => [this.snakeCaseKey(key), value]);

            if (gameUpdateEntries.length > 0) {
                const setClause = gameUpdateEntries
                    .map(([key], index) => `${key} = $${index + 2}`)
                    .join(', ');

                await client.query(
                    `UPDATE games SET ${setClause} WHERE id = $1`,
                    [gameId, ...gameUpdateEntries.map(([_, value]) => value)]
                );
            }

            // Update player information if present
            if (updates.players) {
                for (const player of updates.players) {
                    await client.query(
                        `UPDATE game_players 
                        SET money = $1, position = $2, is_jailed = $3, turns_in_jail = $4, 
                            jail_free_cards = $5, is_bankrupt = $6
                        WHERE game_id = $7 AND player_id = $8`,
                        [
                            player.money,
                            player.position,
                            player.isJailed,
                            player.turnsInJail,
                            player.jailFreeCards,
                            player.isBankrupt,
                            gameId,
                            player.id
                        ]
                    );
                }
            }

            await client.query('COMMIT');
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    async createGameEvent(gameId: number, event: GameEvent): Promise<void> {
        await this.ensurePool().query(
            'INSERT INTO game_events (game_id, type, description, player_id, property_id, related_player_id, amount, position, metadata) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)',
            [
                gameId,
                event.type,
                event.description,
                event.playerId,
                event.propertyId,
                event.relatedPlayerId,
                event.amount,
                event.position,
                event.metadata || '{}'
            ]
        );
    }

    async getGameEvents(gameId: number): Promise<GameEvent[]> {
        const result = await this.ensurePool().query(
            'SELECT type, description, player_id as "playerId", property_id as "propertyId", related_player_id as "relatedPlayerId", amount, position, timestamp FROM game_events WHERE game_id = $1 ORDER BY timestamp ASC',
            [gameId]
        );
        return result.rows;
    }

    async getGameState(gameId: number): Promise<GameState | null> {
        const client = await this.ensurePool().connect();
        try {
            // Get basic game info
            const gameResult = await client.query(
                `SELECT id, game_phase, current_player_id, winner, 
                        dice_roll, doubles_count, turn_count
                 FROM games WHERE id = $1`,
                [gameId]
            );

            if (gameResult.rows.length === 0) {
                return null;
            }

            const game = gameResult.rows[0];

            // Get players in game
            const playersResult = await client.query(
                `SELECT p.id, u.username, gp.position, gp.money, 
                        gp.is_jailed as "isJailed", 
                        gp.turns_in_jail as "turnsInJail",
                        gp.jail_free_cards as "jailFreeCards", 
                        gp.is_bankrupt as "isBankrupt"
                 FROM game_players gp
                 JOIN players p ON gp.player_id = p.id
                 JOIN users u ON p.user_id = u.id
                 WHERE gp.game_id = $1`,
                [gameId]
            );

            // Get properties in game with all their fields
            const propertiesResult = await client.query(
                `SELECT 
                    id, name, position, price, rent, type, 
                    color_group as "colorGroup", mortgaged,
                    house_cost as "houseCost", hotel_cost as "hotelCost",
                    rent_levels as "rentLevels", mortgage_value as "mortgageValue",
                    current_rent as "currentRent", can_be_improved as "canBeImproved",
                    house_count as "houseCount", hotel_count as "hotelCount",
                    owner_id as "ownerId", houses, hotels, color
                FROM game_properties 
                WHERE game_id = $1
                ORDER BY position`,
                [gameId]
            );

            // Map properties to their correct types
            const properties = propertiesResult.rows.map(prop => ({
                id: prop.id,
                name: prop.name,
                position: prop.position,
                price: prop.price,
                rent: prop.rent,
                ownerId: prop.ownerId,
                mortgaged: prop.mortgaged,
                houseCount: prop.houseCount || 0,
                hotelCount: prop.hotelCount || 0,
                colorGroup: prop.colorGroup,
                type: prop.type,
                houseCost: prop.houseCost,
                hotelCost: prop.hotelCost,
                rentLevels: prop.rentLevels || [],
                currentRent: prop.currentRent,
                canBeImproved: prop.canBeImproved,
                maxHouses: 4,
                maxHotels: 1,
                houses: prop.houses || 0,
                hotels: prop.hotels || 0,
                gameId: gameId,
                color: prop.color || prop.colorGroup // Fallback to colorGroup if color is not set
            }));

            // Construct game state
            const gameState: GameState = {
                id: game.id,
                players: playersResult.rows.map(p => ({
                    id: p.id,
                    username: p.username,
                    position: p.position,
                    money: p.money,
                    isJailed: p.isJailed,
                    turnsInJail: p.turnsInJail,
                    jailFreeCards: p.jailFreeCards,
                    isBankrupt: p.isBankrupt,
                    properties: properties.filter(prop => prop.ownerId === p.id).map(prop => prop.id),
                    gameId: gameId,
                    isBot: false,
                    color: '#' + Math.floor(Math.random()*16777215).toString(16)
                })),
                properties: properties,
                currentPlayerId: game.current_player_id,
                gamePhase: game.game_phase,
                winner: game.winner,
                doublesCount: game.doubles_count,
                turnCount: game.turn_count,
                bankruptPlayers: [],
                jailFreeCards: {},
                gameLog: [],
                turnOrder: playersResult.rows.map(p => p.id),
                pendingTrades: []
            };

            return gameState;
        } catch (error) {
            console.error('Error getting game state:', error);
            throw error;
        } finally {
            client.release();
        }
    }

    async getGamePlayers(gameId: number): Promise<Player[]> {
        const result = await this.ensurePool().query(
            'SELECT p.id, u.username as name, gp.position, gp.money, gp.properties, gp.is_jailed as "isJailed", gp.turns_in_jail as "turnsInJail", gp.is_bankrupt as "isBankrupt", gp.jail_free_cards as "jailFreeCards" FROM game_players gp JOIN players p ON gp.player_id = p.id JOIN users u ON p.user_id = u.id WHERE gp.game_id = $1',
            [gameId]
        );
        return result.rows;
    }

    async getGameProperties(gameId: number): Promise<Property[]> {
        const result = await this.ensurePool().query(
            'SELECT * FROM game_properties WHERE game_id = $1',
            [gameId]
        );
        return this.mapProperties(result.rows);
    }

    async getPropertiesByType(type: string): Promise<Property[]> {
        const result = await this.ensurePool().query('SELECT * FROM properties WHERE type = $1', [type]);
        return this.mapProperties(result.rows);
    }

    async getPropertiesByColor(gameId: number, colorGroup: string): Promise<Property[]> {
        const result = await this.ensurePool().query(
            'SELECT * FROM game_properties WHERE game_id = $1 AND color_group = $2',
            [gameId, colorGroup]
        );
        return this.mapProperties(result.rows);
    }

    async getGames(): Promise<Game[]> {
        const result = await this.ensurePool().query(
            'SELECT id, name, max_players as "maxPlayers", game_phase as "gamePhase", current_player_id as "currentPlayerId", winner, created_at as "createdAt", updated_at as "updatedAt" FROM games'
        );
        return result.rows;
    }

    async startGame(gameId: number, userId: number): Promise<GameState> {
        const client = await this.ensurePool().connect();
        try {
            await client.query('BEGIN');

            await client.query(
                'UPDATE games SET game_phase = $1, current_player_id = $2 WHERE id = $3',
                ['STARTED', userId, gameId]
            );

            const gameState = await this.getGameState(gameId);
            if (!gameState) {
                throw new Error('Game not found');
            }

            await client.query('COMMIT');
            return gameState;
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    async joinGame(gameId: number, userId: number): Promise<GameState> {
        const client = await this.ensurePool().connect();
        try {
            await client.query('BEGIN');

            const success = await this.addPlayerToGame(gameId, userId);
            if (!success) {
                throw new Error('Failed to join game');
            }

            const gameState = await this.getGameState(gameId);
            if (!gameState) {
                throw new Error('Game not found');
            }

            await client.query('COMMIT');
            return gameState;
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    async leaveGame(gameId: number, userId: number): Promise<void> {
        const client = await this.ensurePool().connect();
        try {
            await client.query('BEGIN');

            // Remove player from game_players
            await client.query(
                'DELETE FROM game_players WHERE game_id = $1 AND player_id = $2',
                [gameId, userId]
            );

            // Get remaining players
            const remainingPlayers = await client.query(
                'SELECT player_id FROM game_players WHERE game_id = $1',
                [gameId]
            );

            // If there are no players left, update game state
            if (remainingPlayers.rows.length === 0) {
                await client.query(
                    'UPDATE games SET current_player_id = NULL, game_phase = $1 WHERE id = $2',
                    ['WAITING', gameId]
                );
            }
            // If the leaving player was the current player, update to the next player
            else {
                const currentPlayer = await client.query(
                    'SELECT current_player_id FROM games WHERE id = $1',
                    [gameId]
                );
                
                if (currentPlayer.rows[0].current_player_id === userId) {
                    const nextPlayer = remainingPlayers.rows[0].player_id;
                    await client.query(
                        'UPDATE games SET current_player_id = $1 WHERE id = $2',
                        [nextPlayer, gameId]
                    );
                }
            }

            await client.query('COMMIT');
        } catch (error) {
            await client.query('ROLLBACK');
            console.error('Error leaving game:', error);
            throw error;
        } finally {
            client.release();
        }
    }

    async handleRoll(gameId: number, userId: number): Promise<any> {
        const client = await this.ensurePool().connect();
        try {
            await client.query('BEGIN');

            const dice = [
                Math.floor(Math.random() * 6) + 1,
                Math.floor(Math.random() * 6) + 1
            ];

            await this.updateDiceRoll(gameId, dice);

            const gameState = await this.getGameState(gameId);
            if (!gameState) {
                throw new Error('Game not found');
            }

            await client.query('COMMIT');
            return { dice, gameState };
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    async endTurn(gameId: number, userId: number): Promise<GameState> {
        const client = await this.ensurePool().connect();
        try {
            await client.query('BEGIN');

            const players = await this.getPlayersInGame(gameId);
            const currentPlayerIndex = players.findIndex(p => p.id === userId);
            const nextPlayerIndex = (currentPlayerIndex + 1) % players.length;
            const nextPlayerId = players[nextPlayerIndex].id;

            await this.updateCurrentPlayer(gameId, nextPlayerId);
            await this.updateGamePhase(gameId, 'ROLL');

            const gameState = await this.getGameState(gameId);
            if (!gameState) {
                throw new Error('Game not found');
            }

            await client.query('COMMIT');
            return gameState;
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    async getProperties(): Promise<Property[]> {
        const result = await this.ensurePool().query(
            'SELECT id, name, price, rent, owner_id as "ownerId", type, color, mortgaged, houses, hotels, house_cost as "houseCost", hotel_cost as "hotelCost", rent_levels as "rentLevels", current_rent as "currentRent", can_be_improved as "canBeImproved", max_houses as "maxHouses", max_hotels as "maxHotels", position, color_group as "colorGroup", house_count as "houseCount", hotel_count as "hotelCount" FROM properties'
        );
        return this.mapProperties(result.rows);
    }

    async purchaseProperty(propertyId: number, userId: number): Promise<boolean> {
        const client = await this.ensurePool().connect();
        try {
            await client.query('BEGIN');

            const property = await this.getProperty(propertyId);
            if (!property || property.ownerId !== null) {
                return false;
            }

            await this.updatePropertyOwner(propertyId, userId);
            await client.query('COMMIT');
            return true;
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    async sellProperty(propertyId: number, userId: number): Promise<boolean> {
        const client = await this.ensurePool().connect();
        try {
            await client.query('BEGIN');

            const property = await this.getProperty(propertyId);
            if (!property || property.ownerId !== userId) {
                return false;
            }

            await this.updatePropertyOwner(propertyId, null);
            await client.query('COMMIT');
            return true;
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    async mortgageProperty(propertyId: number, userId: number): Promise<boolean> {
        const client = await this.ensurePool().connect();
        try {
            await client.query('BEGIN');

            const property = await this.getProperty(propertyId);
            if (!property || property.ownerId !== userId || property.mortgaged) {
                return false;
            }

            await this.ensurePool().query(
                'UPDATE game_properties SET mortgaged = true WHERE id = $1',
                [propertyId]
            );

            await client.query('COMMIT');
            return true;
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    async unmortgageProperty(propertyId: number, userId: number): Promise<boolean> {
        const client = await this.ensurePool().connect();
        try {
            await client.query('BEGIN');

            const property = await this.getProperty(propertyId);
            if (!property || property.ownerId !== userId || !property.mortgaged) {
                return false;
            }

            await this.ensurePool().query(
                'UPDATE game_properties SET mortgaged = false WHERE id = $1',
                [propertyId]
            );

            await client.query('COMMIT');
            return true;
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    async getUserByUsername(username: string): Promise<User | null> {
        console.log('Looking up user by username:', username);
        try {
            const result = await this.ensurePool().query(
                'SELECT id, username, email, password FROM users WHERE username = $1',
                [username]
            );
            console.log('User lookup result:', result.rows[0] ? 'User found' : 'User not found');
            return result.rows[0] || null;
        } catch (error) {
            console.error('Error looking up user:', error);
            return null;
        }
    }

    async getUserById(userId: number): Promise<User | null> {
        const result = await this.ensurePool().query(
            'SELECT id, username, email, password FROM users WHERE id = $1',
            [userId]
        );
        return result.rows[0] || null;
    }

    async createUser(user: { username: string; email: string; password: string }): Promise<User> {
        console.log('Creating new user:', { username: user.username, email: user.email });
        try {
            const result = await this.ensurePool().query(
                'INSERT INTO users (username, email, password) VALUES ($1, $2, $3) RETURNING id, username, email',
                [user.username, user.email, user.password]
            );
            console.log('User created successfully:', result.rows[0]);
            return result.rows[0];
        } catch (error) {
            console.error('Error creating user:', error);
            throw error;
        }
    }

    async createPlayer(playerData: {
        userId: number;
        username: string;
        money: number;
        position: number;
        isJailed: boolean;
        turnsInJail: number;
        jailFreeCards: number;
        isBankrupt: boolean;
        gameId: number;
    }): Promise<void> {
        const client = await this.ensurePool().connect();
        try {
            await client.query('BEGIN');

            // First create the player record
            const playerResult = await client.query(
                'INSERT INTO players (user_id, username) VALUES ($1, $2) RETURNING id',
                [playerData.userId, playerData.username]
            );
            const playerId = playerResult.rows[0].id;

            // Then create the game_players record
            await client.query(
                `INSERT INTO game_players (
                    player_id, game_id, position, money, 
                    is_jailed, turns_in_jail, jail_free_cards, is_bankrupt
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
                [
                    playerId,
                    playerData.gameId,
                    playerData.position,
                    playerData.money,
                    playerData.isJailed,
                    playerData.turnsInJail,
                    playerData.jailFreeCards,
                    playerData.isBankrupt
                ]
            );

            await client.query('COMMIT');
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }
}

// Export the singleton instance
export const databaseService = DatabaseService.getInstance();