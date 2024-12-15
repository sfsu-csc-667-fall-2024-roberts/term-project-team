import { pool } from '../db/config';
import bcrypt from 'bcrypt';

async function addTestData() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Check if test user exists
    const testUserCheck = await client.query('SELECT * FROM users WHERE username = $1', ['test']);
    
    if (!testUserCheck.rows[0]) {
      console.log('Creating test user...');
      const hashedPassword = await bcrypt.hash('test', 10);
      const testUser = await client.query(
        'INSERT INTO users (username, hashed_password) VALUES ($1, $2) RETURNING *',
        ['test', hashedPassword]
      );
      console.log('Test user created:', testUser.rows[0]);
    } else {
      console.log('Test user already exists:', testUserCheck.rows[0]);
    }

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error adding test data:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Run if called directly
if (require.main === module) {
  addTestData()
    .catch(error => {
      console.error('Failed to add test data:', error);
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

export default addTestData; 