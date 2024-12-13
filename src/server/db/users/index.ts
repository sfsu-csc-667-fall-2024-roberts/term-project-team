import bcrypt from "bcrypt";
import { pool } from "../config";
import { REGISTER_SQL, FIND_BY_USERNAME_SQL } from "./sql";

type User = {
  id: number;
  username: string;
};

type UserWithPassword = User & {
  hashed_password: string;
};

const register = async (
  username: string,
  clearTextPassword: string
): Promise<User> => {
  try {
    // Check if username already exists
    const existingUser = await findByUsername(username);
    if (existingUser) {
      throw new Error("Username already taken");
    }

    // Hash password and create user
    const hashedPassword = await bcrypt.hash(clearTextPassword, 10);
    const result = await pool.query(REGISTER_SQL, [username, hashedPassword]);
    
    console.log('User registered:', { username, userId: result.rows[0].id });
    return result.rows[0];
  } catch (error) {
    console.error('Registration error:', error);
    throw error;
  }
};

const login = async (username: string, clearTextPassword: string): Promise<User> => {
  try {
    // Find user by username
    const user = await findByUsername(username);
    if (!user) {
      console.error('Login failed: User not found:', username);
      throw new Error("Invalid username or password");
    }

    // Verify password
    const isValid = await bcrypt.compare(clearTextPassword, user.hashed_password);
    if (!isValid) {
      console.error('Login failed: Invalid password for user:', username);
      throw new Error("Invalid username or password");
    }

    // Return user without password
    const { hashed_password, ...userWithoutPassword } = user;
    console.log('User logged in:', { username, userId: user.id });
    return userWithoutPassword;
  } catch (error) {
    console.error('Login error:', error);
    throw error;
  }
};

const findByUsername = async (username: string): Promise<UserWithPassword | null> => {
  try {
    const result = await pool.query(FIND_BY_USERNAME_SQL, [username]);
    return result.rows[0] || null;
  } catch (error) {
    console.error('Error finding user:', error);
    throw error;
  }
};

export default { register, login, findByUsername };
