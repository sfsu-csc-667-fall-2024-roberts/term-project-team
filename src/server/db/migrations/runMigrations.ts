import { pool } from '../config';
import fs from 'fs';
import path from 'path';

async function runMigrations() {
  const client = await pool.connect();
  try {
    // Create migrations table if it doesn't exist
    await client.query(`
      CREATE TABLE IF NOT EXISTS migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Get list of executed migrations
    const { rows: executedMigrations } = await client.query(
      'SELECT name FROM migrations ORDER BY id ASC'
    );
    const executedMigrationNames = new Set(executedMigrations.map(row => row.name));

    // List all migration files
    const migrationFiles = [
      '001_create_tables.sql',
      '002_create_session_table.sql',
      '003_add_bot_players.sql',
      '004_fix_users_table.sql',
      '005_add_username_to_players.sql',
      '006_cleanup_database.sql',
      '007_add_game_state.sql'
    ];

    // Run pending migrations in a transaction
    await client.query('BEGIN');
    
    try {
      for (const file of migrationFiles) {
        if (!executedMigrationNames.has(file)) {
          const migrationPath = path.join(__dirname, file);
          const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
          
          await client.query(migrationSQL);
          await client.query(
            'INSERT INTO migrations (name) VALUES ($1)',
            [file]
          );
          
          console.log(`Completed migration: ${file}`);
        }
      }
      
      await client.query('COMMIT');
      console.log('All migrations completed successfully');
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error running migrations:', error);
      throw error;
    }
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

// Run migrations if this file is executed directly
if (require.main === module) {
  runMigrations();
}

export default runMigrations; 