import { Request, Response, NextFunction, RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import { User } from '../models/users';
import { verifyToken } from '../utils/auth';
import 'express-session';

declare global {
    namespace Express {
        interface Request {
            user?: User;
        }
    }
}

const getTokenFromRequest = (req: Request): string | null => {
    // Check Authorization header
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        return authHeader.split(' ')[1];
    }

    // Check cookies
    if (req.cookies && req.cookies.token) {
        return req.cookies.token;
    }

    // Check session
    if (req.session && typeof req.session.token === 'string') {
        return req.session.token;
    }

    return null;
};

export const requireAuth: RequestHandler = (req: Request, res: Response, next: NextFunction): void => {
    console.log('RequireAuth - Checking authentication');
    const token = getTokenFromRequest(req);
    console.log('RequireAuth - Token found:', token ? 'yes' : 'no');

    if (!token) {
        console.log('RequireAuth - No token found, redirecting to login');
        res.redirect('/auth/login');
        return;
    }

    const decoded = verifyToken(token);
    console.log('RequireAuth - Token verification:', decoded ? 'successful' : 'failed');

    if (!decoded) {
        console.log('RequireAuth - Invalid token, redirecting to login');
        res.redirect('/auth/login');
        return;
    }

    req.user = decoded;
    next();
};

export const requireNoAuth: RequestHandler = (req: Request, res: Response, next: NextFunction): void => {
    const token = getTokenFromRequest(req);

    if (token) {
        res.redirect('/lobby');
        return;
    }

    next();
};

export const addUserToLocals: RequestHandler = (req: Request, res: Response, next: NextFunction): void => {
    console.log('AddUserToLocals - Checking for user');
    const token = getTokenFromRequest(req);
    console.log('AddUserToLocals - Token found:', token ? 'yes' : 'no');

    if (token) {
        const decoded = verifyToken(token);
        console.log('AddUserToLocals - Token verification:', decoded ? 'successful' : 'failed');

        if (decoded) {
            req.user = decoded;
            res.locals.user = decoded;
        }
    }

    next();
}; 