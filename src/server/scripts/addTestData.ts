import { 
  createUser, 
  createGame, 
  addPlayerToGame, 
  createProperty,
  getUserByUsername 
} from '../db/services/dbService';
import bcrypt from 'bcrypt';

async function addTestData() {
  try {
    // 1. Create a test user
    const username = 'testuser';
    const password = 'password123';
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Check if user already exists
    let user = await getUserByUsername(username);
    if (!user) {
      user = await createUser(username, hashedPassword);
      console.log('Created User:', { ...user, hashed_password: '[HIDDEN]' });
    } else {
      console.log('Using existing user:', { ...user, hashed_password: '[HIDDEN]' });
    }

    // 2. Create a game owned by that user
    const game = await createGame(user.id);
    console.log('Created Game:', game);

    // 3. Add the user as a player in that game
    const player = await addPlayerToGame(game.id, user.id);
    console.log('Created Player:', player);

    // 4. Add some sample properties to the game
    const properties = await Promise.all([
      createProperty(game.id, 'Mediterranean Avenue'),
      createProperty(game.id, 'Baltic Avenue'),
      createProperty(game.id, 'Reading Railroad')
    ]);
    console.log('Created Properties:', properties);

    console.log('\nTest data added successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Error adding test data:', error);
    process.exit(1);
  }
}

// Run if this file is executed directly
if (require.main === module) {
  addTestData();
} 