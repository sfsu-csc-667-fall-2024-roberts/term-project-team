import { Pool } from 'pg';
import { pool } from '../config';

export interface User {
    id: number;
    username: string;
    email: string;
    password: string;
}

export class Users {
    static async create(username: string, email: string, hashedPassword: string): Promise<User> {
        const result = await pool.query(
            'INSERT INTO users (username, email, password) VALUES ($1, $2, $3) RETURNING *',
            [username, email, hashedPassword]
        );
        return result.rows[0];
    }

    static async findByEmail(email: string): Promise<User | null> {
        const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        return result.rows[0] || null;
    }

    static async findById(id: number): Promise<User | null> {
        const result = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
        return result.rows[0] || null;
    }
}

export default Users;
