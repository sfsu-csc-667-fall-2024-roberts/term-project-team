import jwt from 'jsonwebtoken';
import { User } from '../models/users';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

interface TokenPayload {
    id: number;
    username: string;
    gameId?: number;
}

export const generateToken = (payload: TokenPayload): string => {
    console.log('Generating token for payload:', payload);
    const token = jwt.sign(
        { id: payload.id, username: payload.username, gameId: payload.gameId },
        JWT_SECRET,
        { expiresIn: '24h' }
    );
    console.log('Generated token:', token);
    return token;
};

export const verifyToken = (token: string): any => {
    try {
        console.log('Verifying token:', token);
        const decoded = jwt.verify(token, JWT_SECRET);
        console.log('Token verified successfully:', decoded);
        return decoded;
    } catch (error) {
        console.error('Token verification failed:', error);
        return null;
    }
};

export const requireAuth = (req: any, res: any, next: any) => {
    console.log('Checking auth headers:', req.headers);
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        console.log('No auth header found');
        return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.split(' ')[1];
    console.log('Extracted token:', token);
    const decoded = verifyToken(token);

    if (!decoded) {
        console.log('Token verification failed');
        return res.status(401).json({ error: 'Invalid token' });
    }

    console.log('Auth successful, user:', decoded);
    req.user = decoded;
    next();
}; 