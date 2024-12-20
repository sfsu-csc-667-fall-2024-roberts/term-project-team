import { Pool } from 'pg';
import { DatabaseService } from '../services/databaseService';
import { GameState } from '../../shared/types';
import { BOARD_SPACES } from '../../shared/boardData';
import bcrypt from 'bcrypt';

async function addTestData() {
    const db = DatabaseService.getInstance();

    try {
        console.log('Adding test users...');
        // Add test users
        const password = await bcrypt.hash('password123', 10);
        const user1 = await db.query(
            'INSERT INTO users (username, password, email) VALUES ($1, $2, $3) RETURNING id',
            ['testuser1', password, 'test1@test.com']
        );
        const user2 = await db.query(
            'INSERT INTO users (username, password, email) VALUES ($1, $2, $3) RETURNING id',
            ['testuser2', password, 'test2@test.com']
        );

        console.log('Adding test players...');
        // Add test players
        const player1 = await db.query(
            'INSERT INTO players (user_id) VALUES ($1) RETURNING id',
            [user1.rows[0].id]
        );
        const player2 = await db.query(
            'INSERT INTO players (user_id) VALUES ($1) RETURNING id',
            [user2.rows[0].id]
        );

        console.log('Creating test game...');
        // Create test game
        const gameId = await db.createGame('Test Game', 4);

        console.log('Adding players to game...');
        // Add players to game
        await db.addPlayerToGame(gameId, player1.rows[0].id);
        await db.addPlayerToGame(gameId, player2.rows[0].id);

        console.log('Initializing game properties...');
        // Initialize game properties from BOARD_SPACES
        for (const space of BOARD_SPACES) {
            if (space.type === 'property' || space.type === 'railroad' || space.type === 'utility') {
                await db.query(
                    `INSERT INTO game_properties (
                        game_id, name, position, price, rent, type, color, 
                        mortgaged, house_cost, hotel_cost, rent_levels, 
                        mortgage_value, current_rent, can_be_improved
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, false, $8, $9, $10, $11, $12, $13)`,
                    [
                        gameId,
                        space.name,
                        space.position,
                        space.price || 0,
                        space.rentLevels ? space.rentLevels[0] : 0,
                        space.type,
                        space.colorGroup,
                        space.houseCost || 0,
                        space.hotelCost || 0,
                        space.rentLevels || [],
                        space.mortgageValue || 0,
                        space.rentLevels ? space.rentLevels[0] : 0,
                        space.type === 'property'
                    ]
                );
            }
        }

        console.log('Adding test game events...');
        // Add test game events with new structure
        await db.query(
            `INSERT INTO game_events (
                game_id, player_id, type, description, 
                property_id, related_player_id, amount, position, metadata
            ) VALUES ($1, $2, $3, $4, NULL, NULL, NULL, NULL, '{}'::jsonb)`,
            [gameId, player1.rows[0].id, 'game_start', 'Game started']
        );
    } catch (error) {
        console.error('Error adding test data:', error);
        throw error;
    }
}

// Only export the function, don't run it automatically
export { addTestData };

// Run if this file is executed directly
if (require.main === module) {
    (async () => {
        const db = DatabaseService.getInstance();
        try {
            await addTestData();
            console.log('Test data added successfully');
            await db.close(true);
            process.exit(0);
        } catch (error) {
            console.error('Failed to add test data:', error);
            await db.close(true);
            process.exit(1);
        }
    })();
} 