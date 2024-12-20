import { DatabaseService } from '../../services/databaseService';
import * as fs from 'fs';
import * as path from 'path';

export async function runMigrations() {
    const db = DatabaseService.getInstance();
    let client;
    try {
        console.log('Starting migration process...');
        client = await db.getPool().connect();
        console.log('Connected to database for migrations');
        
        // Create migrations table if it doesn't exist
        console.log('Creating migrations table if it does not exist...');
        await client.query(`
            CREATE TABLE IF NOT EXISTS migrations (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) NOT NULL UNIQUE,
                applied_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log('Migrations table ready');

        // Get list of applied migrations
        console.log('Checking for previously applied migrations...');
        const { rows: appliedMigrations } = await client.query(
            'SELECT name FROM migrations ORDER BY id'
        );
        const appliedMigrationNames = new Set(appliedMigrations.map(m => m.name));
        console.log('Previously applied migrations:', Array.from(appliedMigrationNames));

        // Read migration files from current directory
        console.log('Reading migration files from directory...');
        const migrationFiles = fs.readdirSync(__dirname)
            .filter(file => file.endsWith('.sql'))
            .sort((a, b) => {
                const numA = parseInt(a.split('_')[0]);
                const numB = parseInt(b.split('_')[0]);
                return numA - numB;
            });

        console.log('Found migration files:', migrationFiles);

        // Run migrations in order
        for (const file of migrationFiles) {
            if (!appliedMigrationNames.has(file)) {
                console.log(`\nStarting migration: ${file}`);
                const filePath = path.join(__dirname, file);
                console.log(`Reading migration file from: ${filePath}`);
                const sql = fs.readFileSync(filePath, 'utf8');
                
                try {
                    console.log(`Beginning transaction for ${file}...`);
                    await client.query('BEGIN');
                    
                    console.log(`Executing SQL for ${file}...`);
                    // Execute the entire SQL file as a single transaction
                    await client.query(sql);
                    console.log(`SQL execution completed for ${file}`);
                    
                    console.log(`Recording migration ${file} in migrations table...`);
                    await client.query(
                        'INSERT INTO migrations (name) VALUES ($1)',
                        [file]
                    );
                    
                    console.log(`Committing transaction for ${file}...`);
                    await client.query('COMMIT');
                    console.log(`Migration ${file} completed successfully`);
                } catch (error) {
                    console.error(`\nError during migration ${file}:`, error);
                    console.log('Rolling back transaction...');
                    await client.query('ROLLBACK');
                    throw new Error(`Migration ${file} failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
                }
            } else {
                console.log(`Skipping already applied migration: ${file}`);
            }
        }

        console.log('\nAll migrations completed successfully');
    } catch (error) {
        console.error('\nError running migrations:', error);
        throw error;
    } finally {
        if (client) {
            console.log('Releasing database client...');
            client.release();
            console.log('Database client released');
        }
    }
}

// Run migrations if this file is executed directly
if (require.main === module) {
    console.log('Starting standalone migration process...');
    (async () => {
        const db = DatabaseService.getInstance();
        try {
            await runMigrations();
            console.log('Migration process completed successfully');
            await db.close(true); // Force exit when running directly
            process.exit(0);
        } catch (error) {
            console.error('Migration process failed:', error);
            await db.close(true); // Force exit when running directly
            process.exit(1);
        }
    })();
} 