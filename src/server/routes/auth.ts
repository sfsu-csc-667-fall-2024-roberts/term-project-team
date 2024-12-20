import express, { Request, Response, NextFunction, RequestHandler } from 'express';
import bcrypt from 'bcrypt';
import { User } from '../models/users';
import { validateRegistration, validateLogin } from '../middleware/validation';
import { generateToken } from '../utils/auth';
import { AuthRequest } from '../../shared/types';
import { DatabaseService } from '../services/databaseService';
import { PlayerService } from '../services/playerService';
import { gameHistoryService } from '../services/gameHistoryService';

const router = express.Router();
const playerService = PlayerService.getInstance();
const databaseService = DatabaseService.getInstance();

const renderLoginPage: RequestHandler = (req: Request, res: Response): void => {
    if (res.locals.user) {
        res.redirect('/lobby');
        return;
    }
    res.render('auth/login', { error: null });
};

const renderRegisterPage: RequestHandler = (req: Request, res: Response): void => {
    if (res.locals.user) {
        res.redirect('/lobby');
        return;
    }
    res.render('auth/register', { error: null });
};

const handleRegister: RequestHandler = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { username, email, password } = req.body;
        
        if (!username || !email || !password) {
            res.render('auth/register', { error: 'Missing required fields' });
            return;
        }
        
        const hashedPassword = await bcrypt.hash(password, 10);
        
        const existingUser = await databaseService.getUserByUsername(username);
        
        if (existingUser) {
            res.render('auth/register', { error: 'Username already exists' });
            return;
        }
        
        const user = await databaseService.createUser({ username, email, password: hashedPassword });
        const token = generateToken({
            id: user.id,
            username: user.username
        });

        // Create a player for the user
        const player = await playerService.getPlayerByUserId(user.id);
        if (!player) {
            await databaseService.createPlayer({
                userId: user.id,
                username: user.username,
                money: 1500, // Starting money
                position: 0,  // Start position
                isJailed: false,
                turnsInJail: 0,
                jailFreeCards: 0,
                isBankrupt: false,
                gameId: -1 // No game yet
            });
        }

        // Set token in cookie
        res.cookie('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production'
        });

        res.redirect('/lobby');
    } catch (error) {
        next(error);
    }
};

const handleLogin: RequestHandler = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        console.log('Login attempt - Request body:', req.body);
        const { username, password } = req.body;
        
        if (!username || !password) {
            console.log('Login failed - Missing fields');
            res.render('auth/login', { error: 'Missing required fields' });
            return;
        }
        
        const user = await databaseService.getUserByUsername(username);
        console.log('Login attempt - User found:', !!user);
        
        if (!user || !user.password) {
            console.log('Login failed - Invalid credentials (user not found or no password)');
            res.render('auth/login', { error: 'Invalid credentials' });
            return;
        }
        
        const validPassword = await bcrypt.compare(password, user.password);
        console.log('Login attempt - Password valid:', validPassword);
        
        if (!validPassword) {
            console.log('Login failed - Invalid password');
            res.render('auth/login', { error: 'Invalid credentials' });
            return;
        }
        
        const token = generateToken({
            id: user.id,
            username: user.username
        });

        // Ensure player exists
        const player = await playerService.getPlayerByUserId(user.id);
        console.log('Login attempt - Player exists:', !!player);
        
        if (!player) {
            console.log('Creating new player for user');
            await databaseService.createPlayer({
                userId: user.id,
                username: user.username,
                money: 1500,
                position: 0,
                isJailed: false,
                turnsInJail: 0,
                jailFreeCards: 0,
                isBankrupt: false,
                gameId: -1
            });
        }

        // Set token in cookie and header
        res.cookie('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax'
        });

        // Set authorization header
        res.setHeader('Authorization', `Bearer ${token}`);

        // Store token in session
        if (req.session) {
            req.session.token = token;
            req.session.userId = user.id;
            req.session.username = user.username;
            await new Promise<void>((resolve, reject) => {
                req.session.save((err) => {
                    if (err) reject(err);
                    else resolve();
                });
            });
        }

        console.log('Login successful, redirecting to lobby');
        res.redirect('/lobby');
    } catch (error) {
        console.error('Login error:', error);
        next(error);
    }
};

const handleGetCurrentUser: RequestHandler = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
        if (!req.user || typeof req.user.id !== 'number') {
            res.status(401).json({ error: 'Not authenticated' });
            return;
        }
        
        const user = await databaseService.getUserById(req.user.id);
        
        if (!user) {
            res.status(404).json({ error: 'User not found' });
            return;
        }

        const player = await playerService.getPlayerByUserId(req.user.id);
        
        const { password, ...userWithoutPassword } = user;
        res.json({
            ...userWithoutPassword,
            player
        });
    } catch (error) {
        next(error);
    }
};

const handleLogout: RequestHandler = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const userId = (req as AuthRequest).user?.id;
        if (typeof userId === 'number') {
            const player = await playerService.getPlayerByUserId(userId);
            if (player && typeof player.gameId === 'number' && player.gameId !== -1) {
                // Leave any active game
                await gameHistoryService.leaveGame(player.gameId, player.id);
            }
        }

        res.clearCookie('token');
        res.redirect('/auth/login');
    } catch (error) {
        next(error);
    }
};

router.get('/login', renderLoginPage);
router.get('/register', renderRegisterPage);
router.post('/register', validateRegistration, handleRegister);
router.post('/login', validateLogin, handleLogin);
router.get('/me', handleGetCurrentUser);
router.post('/logout', handleLogout);

export default router;
