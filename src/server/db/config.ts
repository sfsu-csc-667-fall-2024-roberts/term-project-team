import { Pool } from 'pg';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Log database configuration (without sensitive data)
console.log('Database configuration:', {
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'monopoly',
    port: parseInt(process.env.DB_PORT || '5432')
});

// Create a new pool instance with configuration from environment variables
const pool = new Pool({
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'monopoly',
    password: process.env.DB_PASSWORD || 'postgres',
    port: parseInt(process.env.DB_PORT || '5432'),
    // Add connection timeout
    connectionTimeoutMillis: 5000,
    // Add idle timeout
    idleTimeoutMillis: 30000,
    // Add maximum number of clients
    max: 20
});

// Handle pool errors
pool.on('error', (err) => {
    console.error('Unexpected error on idle client:', err);
    process.exit(-1);
});

// Test the connection
async function testConnection() {
    try {
        const client = await pool.connect();
        try {
            const result = await client.query('SELECT NOW()');
            console.log('Database connection test successful:', result.rows[0]);
        } finally {
            client.release();
        }
    } catch (err) {
        console.error('Error testing database connection:', err);
        throw err;
    }
}

// Run the test connection
testConnection().catch(err => {
    console.error('Failed to establish database connection:', err);
    process.exit(-1);
});

export { pool }; 