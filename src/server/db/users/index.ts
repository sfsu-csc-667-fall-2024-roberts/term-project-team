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
  const hashedPassword = await bcrypt.hash(clearTextPassword, 10);
  const result = await pool.query(REGISTER_SQL, [username, hashedPassword]);
  return result.rows[0];
};

const login = async (username: string, clearTextPassword: string): Promise<User> => {
  const user = await findByUsername(username);
  if (!user) {
    throw new Error("User not found");
  }
  const isValid = await bcrypt.compare(clearTextPassword, user.hashed_password);
  if (isValid) {
    const { hashed_password, ...userWithoutPassword } = user;
    return userWithoutPassword;
  } else {
    throw new Error("Invalid credentials provided");
  }
};

const findByUsername = async (username: string): Promise<UserWithPassword | null> => {
  const result = await pool.query(FIND_BY_USERNAME_SQL, [username]);
  return result.rows[0] || null;
};

export default { register, login, findByUsername };
