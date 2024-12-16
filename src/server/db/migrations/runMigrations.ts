import { pool } from '../config';
import fs from 'fs';
import path from 'path';

async function runMigrations() {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    // Create migrations table if it doesn't exist
    await client.query(`
      CREATE TABLE IF NOT EXISTS migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        executed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Get list of executed migrations
    const { rows: executedMigrations } = await client.query(
      'SELECT name FROM migrations ORDER BY id'
    );
    const executedMigrationNames = new Set(executedMigrations.map(row => row.name));

    // Read and sort migration files
    const migrationFiles = fs
      .readdirSync(__dirname)
      .filter(file => file.endsWith('.sql'))
      .sort(); // Ensure consistent ordering

    // Run each migration in order
    for (const file of migrationFiles) {
      try {
        // Skip if migration was already executed
        if (executedMigrationNames.has(file)) {
          console.log(`Skipping already executed migration: ${file}`);
          continue;
        }

        const migrationPath = path.join(__dirname, file);
        const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
        
        // Run the migration
        await client.query(migrationSQL);
        
        // Record the migration
        await client.query(
          'INSERT INTO migrations (name) VALUES ($1)',
          [file]
        );
        
        console.log(`Completed migration: ${file}`);
      } catch (error) {
        console.error(`Error in migration ${file}:`, error);
        throw error;
      }
    }
    
    await client.query('COMMIT');
    console.log('All migrations completed successfully');

    // Verify final database state
    const { rows: tables } = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `);
    console.log('Final database tables:', tables.map(r => r.table_name).join(', '));

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Migration failed:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Run migrations if this file is executed directly
if (require.main === module) {
  runMigrations()
    .catch(error => {
      console.error('Failed to run migrations:', error);
      process.exit(1);
    })
    .finally(async () => {
      try {
        await pool.end();
      } catch (error) {
        console.error('Error closing pool:', error);
      }
      process.exit(0);
    });
}

export default runMigrations; 