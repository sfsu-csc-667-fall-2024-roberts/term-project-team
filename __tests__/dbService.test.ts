import { pool } from '../src/server/db/config';
import {
  createUser,
  getUserByUsername,
  createGame,
} from '../src/server/db/services/dbService';

// Mock the pool.query and pool.connect functions
jest.mock('../src/server/db/config', () => ({
  pool: {
    query: jest.fn(),
    connect: jest.fn().mockResolvedValue({
      query: jest.fn(),
      release: jest.fn(),
    }),
  },
}));

describe('Database Functions', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createUser', () => {
    it('should create a user and return the new user object', async () => {
      const mockUser = { id: 1, username: 'testuser', hashed_password: 'hashedpass' };

      // Mock query response to return the mockUser
      (pool.query as jest.Mock).mockResolvedValueOnce({ rows: [mockUser] });

      const result = await createUser('testuser', 'hashedpass');

      expect(pool.query).toHaveBeenCalledWith(
        'INSERT INTO users (username, hashed_password) VALUES ($1, $2) RETURNING id, username, hashed_password',
        ['testuser', 'hashedpass']
      );
      expect(result).toEqual(mockUser);
    });

    it('should throw an error if the database query fails', async () => {
      const mockError = new Error('Database error');
      // Simulate a query failure
      (pool.query as jest.Mock).mockRejectedValueOnce(mockError);

      await expect(createUser('testuser', 'hashedpass')).rejects.toThrow('Database error');
    });
  });

  describe('getUserByUsername', () => {
    it('should return a user object if the username exists', async () => {
      const mockUser = { id: 1, username: 'testuser', hashed_password: 'hashedpass' };
      // Mock query response
      (pool.query as jest.Mock).mockResolvedValueOnce({ rows: [mockUser] });

      const result = await getUserByUsername('testuser');

      expect(pool.query).toHaveBeenCalledWith(
        'SELECT * FROM users WHERE username = $1',
        ['testuser']
      );
      expect(result).toEqual(mockUser);
    });

    it('should return null if the username does not exist', async () => {
      // Simulate no results for this query
      (pool.query as jest.Mock).mockResolvedValueOnce({ rows: [] });

      const result = await getUserByUsername('nonexistent');

      expect(pool.query).toHaveBeenCalledWith(
        'SELECT * FROM users WHERE username = $1',
        ['nonexistent']
      );
      expect(result).toBeNull();
    });
  });

  describe('createGame', () => {
    it('should create a game and initialize its properties', async () => {
      const mockClient = {
        query: jest.fn(),
        release: jest.fn(),
      };
      const mockUser = { id: 1, username: 'owner' };
      const mockGame = { id: 1, owner_id: 1, status: 'waiting', game_state: {} };

      // Mock the connect method to return the mockClient
      (pool.connect as jest.Mock).mockResolvedValue(mockClient);

      // Mock queries with specific responses for each step
      mockClient.query
        .mockResolvedValueOnce({ rows: [mockUser] }) 
        .mockResolvedValueOnce({ rows: [mockGame] })
        .mockResolvedValueOnce({ rows: [] }); 

      const result = await createGame(1);

      // Log the game object to debug if needed
      console.log('Created game:', result);

      // Ensure the game creation query is called with correct arguments
      expect(mockClient.query).toHaveBeenCalledWith(
        'SELECT * FROM users WHERE id = $1',
        [1]
      );

      // Ensure the game creation query is called with valid data
      expect(mockClient.query).toHaveBeenCalledWith(
        'INSERT INTO games (owner_id, status, game_state) VALUES ($1, $2, $3) RETURNING *',
        [1, 'waiting', { phase: 'waiting', current_player_index: 0, dice_rolls: [], turn_order: [] }]
      );

      // Assert that the result matches the mock game
      expect(result).toEqual(mockGame);

      // Ensure the client release method is called
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should throw an error if the game creation fails', async () => {
      const mockClient = {
        query: jest.fn(),
        release: jest.fn(),
      };

      // Mock the connect method to return the mockClient
      (pool.connect as jest.Mock).mockResolvedValue(mockClient);

      // Mock the query flow to simulate an error
      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // Fail to find user
        .mockRejectedValueOnce(new Error('User not found'));

      await expect(createGame(1)).rejects.toThrow('User not found');

      // Ensure rollback is called
      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should throw an error if the game creation query fails', async () => {
      const mockClient = {
        query: jest.fn(),
        release: jest.fn(),
      };
      const mockUser = { id: 1, username: 'owner' };

      // Mock the connect method to return the mockClient
      (pool.connect as jest.Mock).mockResolvedValue(mockClient);

      // Mock the query flow to simulate a failed game creation
      mockClient.query
        .mockResolvedValueOnce({ rows: [mockUser] }) // Get user
        .mockRejectedValueOnce(new Error('Failed to create game'));

      await expect(createGame(1)).rejects.toThrow('Failed to create game');

      // Ensure rollback is called
      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
      expect(mockClient.release).toHaveBeenCalled();
    });
  });
});
