import { pool } from '../db/config';
import runMigrations from '../db/migrations/runMigrations';

async function resetDb() {
  try {
    console.log('=== Starting Database Reset ===');
    
    // Drop all tables with CASCADE to ensure clean state
    console.log('Dropping all tables...');
    await pool.query(`
      DROP TABLE IF EXISTS properties CASCADE;
      DROP TABLE IF EXISTS players CASCADE;
      DROP TABLE IF EXISTS games CASCADE;
      DROP TABLE IF EXISTS users CASCADE;
      DROP TABLE IF EXISTS "session" CASCADE;
      DROP TABLE IF EXISTS "user_sessions" CASCADE;
    `);
    console.log('Tables dropped successfully');

    // Reset sequences
    console.log('Resetting sequences...');
    await pool.query(`
      DROP SEQUENCE IF EXISTS properties_id_seq CASCADE;
      DROP SEQUENCE IF EXISTS players_id_seq CASCADE;
      DROP SEQUENCE IF EXISTS games_id_seq CASCADE;
      DROP SEQUENCE IF EXISTS users_id_seq CASCADE;
    `);
    console.log('Sequences reset successfully');

    // Run all migrations
    console.log('\nRunning migrations...');
    await runMigrations();
    
    // Verify database state
    console.log('\nVerifying database state...');
    const tables = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
    console.log('Available tables:', tables.rows.map(r => r.table_name));

    console.log('=== Database Reset Complete ===');
  } catch (error) {
    console.error('Error resetting database:', error);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  resetDb()
    .catch(error => {
      console.error('Failed to reset database:', error);
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

export default resetDb; 