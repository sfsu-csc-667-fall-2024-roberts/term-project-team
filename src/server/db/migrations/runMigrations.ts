import { pool } from '../config';
import fs from 'fs';
import path from 'path';

async function runMigrations() {
  try {
    // Read the migration files
    const migrationFiles = [
      '001_create_tables.sql',
      '002_create_session_table.sql'
    ];

    // Run the migrations within a transaction
    await pool.query('BEGIN');
    
    try {
      for (const file of migrationFiles) {
        const migrationPath = path.join(__dirname, file);
        const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
        await pool.query(migrationSQL);
        console.log(`Completed migration: ${file}`);
      }
      
      await pool.query('COMMIT');
      console.log('All migrations completed successfully');
    } catch (error) {
      await pool.query('ROLLBACK');
      console.error('Error running migrations:', error);
      throw error;
    }
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run migrations if this file is executed directly
if (require.main === module) {
  runMigrations();
}

export default runMigrations; 