import { DatabaseService } from '../services/databaseService';
import bcrypt from 'bcrypt';

export interface User {
    id: number;
    username: string;
    email: string;
    password?: string;
    createdAt?: Date;
}

export interface UserCredentials {
    username: string;
    password: string;
    email: string;
}

export class UserModel {
    private static instance: UserModel | null = null;
    private databaseService: DatabaseService;

    private constructor() {
        this.databaseService = DatabaseService.getInstance();
    }

    public static getInstance(): UserModel {
        if (!UserModel.instance) {
            UserModel.instance = new UserModel();
        }
        return UserModel.instance;
    }

    async create(credentials: UserCredentials): Promise<User> {
        const { username, password, email } = credentials;

        if (!username || !password || !email) {
            throw new Error('Username, password, and email are required');
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const result = await this.databaseService.query(
            'INSERT INTO users (username, password, email) VALUES ($1, $2, $3) RETURNING id, username, email, created_at',
            [username, hashedPassword, email]
        );

        return result.rows[0];
    }

    async findOne(query: { username?: string; id?: number }): Promise<User | null> {
        let queryString = 'SELECT id, username, email, created_at FROM users WHERE ';
        const values = [];

        if (query.username) {
            queryString += 'username = $1';
            values.push(query.username);
        } else if (query.id) {
            queryString += 'id = $1';
            values.push(query.id);
        } else {
            throw new Error('Invalid query parameters');
        }

        const result = await this.databaseService.query(queryString, values);
        return result.rows[0] || null;
    }

    async findByCredentials(username: string, password: string): Promise<User | null> {
        const result = await this.databaseService.query(
            'SELECT * FROM users WHERE username = $1',
            [username]
        );

        const user = result.rows[0];
        if (!user || !user.password) {
            return null;
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return null;
        }

        // Don't return the password
        delete user.password;
        return user;
    }

    async getUserById(id: number): Promise<User | null> {
        const result = await this.databaseService.query(
            'SELECT id, username, email, created_at FROM users WHERE id = $1',
            [id]
        );

        return result.rows[0] || null;
    }
}

// Export the singleton instance
export const User = UserModel.getInstance(); 