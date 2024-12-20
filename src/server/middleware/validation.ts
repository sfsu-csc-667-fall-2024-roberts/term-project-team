import { Request, Response, NextFunction, RequestHandler } from 'express';
import { AuthRequest } from '../../shared/types';

export const validateRegistration: RequestHandler = (req: Request, res: Response, next: NextFunction): void => {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
        res.status(400).json({ error: 'Username, email, and password are required' });
        return;
    }

    if (username.length < 3 || username.length > 20) {
        res.status(400).json({ error: 'Username must be between 3 and 20 characters' });
        return;
    }

    if (!email.includes('@') || !email.includes('.')) {
        res.status(400).json({ error: 'Invalid email format' });
        return;
    }

    if (password.length < 3) {
        res.status(400).json({ error: 'Password must be at least 3 characters' });
        return;
    }

    next();
};

export const validateLogin: RequestHandler = (req: Request, res: Response, next: NextFunction): void => {
    const { username, password } = req.body;

    if (!username || !password) {
        res.status(400).json({ error: 'Username and password are required' });
        return;
    }

    next();
};

export const validateGameAction: RequestHandler = (req: Request, res: Response, next: NextFunction): void => {
    const { gameId } = req.params;
    const playerId = (req as AuthRequest).user?.id;

    if (!gameId || !playerId) {
        res.status(400).json({ error: 'Game ID and player ID are required' });
        return;
    }

    next();
}; 