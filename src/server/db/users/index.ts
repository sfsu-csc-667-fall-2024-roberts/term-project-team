import bcrypt from "bcrypt";
import { createHash } from "crypto";
import { pool } from "../config";
import { REGISTER_SQL, FIND_BY_EMAIL_SQL } from "./sql";

type User = {
  id: number;
  username: string;
  email: string;
  gravatar: string;
};

type UserWithPassword = User & {
  password: string;
};

const register = async (
  username: string,
  email: string,
  clearTextPassword: string
): Promise<User> => {
  const password = await bcrypt.hash(clearTextPassword, 10);
  const gravatar = createHash("sha256").update(email).digest("hex");
  const result = await pool.query(REGISTER_SQL, [username, email, password, gravatar]);
  return result.rows[0];
};

const login = async (email: string, clearTextPassword: string): Promise<User> => {
  const user = await findByEmail(email); // Find user by email
  const isValid = await bcrypt.compare(clearTextPassword, user.password);
  if (isValid) {
    const { password, ...userWithoutPassword } = user; // Exclude password from returned data
    return userWithoutPassword as User;
  } else {
    throw new Error("Invalid credentials provided");
  }
};

const findByEmail = async (email: string): Promise<UserWithPassword> => {
  const result = await pool.query(FIND_BY_EMAIL_SQL, [email]);
  return result.rows[0];
};

export default { register, login, findByEmail };
