import { pool } from '../db/config';
import runMigrations from '../db/migrations/runMigrations';

async function resetDb() {
  try {
    console.log('=== Starting Database Reset ===');
    
    // Drop all tables
    console.log('Dropping all tables...');
    await pool.query(`
      DROP TABLE IF EXISTS properties CASCADE;
      DROP TABLE IF EXISTS players CASCADE;
      DROP TABLE IF EXISTS games CASCADE;
      DROP TABLE IF EXISTS users CASCADE;
    `);
    console.log('Tables dropped successfully');

    // Run all migrations
    console.log('\nRunning migrations...');
    await runMigrations();
    console.log('=== Database Reset Complete ===');
  } catch (error) {
    console.error('Error resetting database:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  resetDb();
} 