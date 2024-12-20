import { DatabaseService } from '../services/databaseService';
import { runMigrations } from '../db/migrations/runMigrations';

async function checkTableStructure(client: any) {
    const result = await client.query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'games'
        ORDER BY ordinal_position;
    `);
    console.log('Games table structure:', result.rows);
}

async function dropTables(db: DatabaseService) {
    console.log('[resetDb] Starting dropTables at:', new Date().toISOString());
    const client = await db.getPool().connect();
    try {
        console.log('[resetDb] Database connection successful at:', new Date().toISOString());
        console.log('[resetDb] Starting table drop at:', new Date().toISOString());
        await client.query('BEGIN');

        // Drop all tables in the public schema
        await client.query(`
            DO $$ DECLARE
                r RECORD;
            BEGIN
                FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
                    EXECUTE 'DROP TABLE IF EXISTS ' || quote_ident(r.tablename) || ' CASCADE';
                END LOOP;
            END $$;
        `);

        await client.query('COMMIT');
        console.log('[resetDb] All tables dropped successfully at:', new Date().toISOString());
    } catch (error) {
        console.error('[resetDb] Error dropping tables at:', new Date().toISOString(), error);
        await client.query('ROLLBACK');
        throw error;
    } finally {
        console.log('[resetDb] Releasing client at:', new Date().toISOString());
        client.release();
        console.log('[resetDb] Client released at:', new Date().toISOString());
    }
}

async function resetDb() {
    console.log('[resetDb] Starting reset process at:', new Date().toISOString());
    const db = DatabaseService.getInstance();
    try {
        await dropTables(db);
        
        // Run migrations to recreate tables
        console.log('[resetDb] Starting migrations at:', new Date().toISOString());
        await runMigrations();
        console.log('[resetDb] Migrations completed at:', new Date().toISOString());

        // Check table structure
        console.log('[resetDb] Checking table structure at:', new Date().toISOString());
        const client = await db.getPool().connect();
        try {
            await checkTableStructure(client);
            console.log('[resetDb] Table structure check completed at:', new Date().toISOString());
        } finally {
            console.log('[resetDb] Releasing structure check client at:', new Date().toISOString());
            client.release();
        }

        console.log('[resetDb] Database reset completed at:', new Date().toISOString());
    } catch (error) {
        console.error('[resetDb] Error during reset at:', new Date().toISOString(), error);
        throw error;
    }
}

// Run if this file is executed directly
if (require.main === module) {
    console.log('[resetDb] Starting direct execution at:', new Date().toISOString());
    (async () => {
        const db = DatabaseService.getInstance();
        try {
            await resetDb();
            console.log('[resetDb] Reset process completed at:', new Date().toISOString());
            console.log('[resetDb] Initiating database close at:', new Date().toISOString());
            await db.close(true);
            console.log('[resetDb] Database closed, exiting at:', new Date().toISOString());
            process.exit(0);
        } catch (error) {
            console.error('[resetDb] Reset process failed at:', new Date().toISOString(), error);
            console.log('[resetDb] Attempting to close database after error at:', new Date().toISOString());
            await db.close(true);
            console.log('[resetDb] Database closed after error, exiting at:', new Date().toISOString());
            process.exit(1);
        }
    })();
} 