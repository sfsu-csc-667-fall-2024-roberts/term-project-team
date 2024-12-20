import express from 'express';
import path from 'path';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import session from 'express-session';
import { setupWebSocket } from './websocket/index';
import gameRoutes from './routes/game';
import propertyRoutes from './routes/property';
import lobbyRoutes from './routes/lobby';
import authRoutes from './routes/auth';
import { addUserToLocals } from './middleware/auth';
import { DatabaseService } from './services/databaseService';

const app = express();
const port = process.env.PORT || 3000;

// Initialize database
const initializeApp = async () => {
    let server;
    try {
        console.log('\n=== Starting Server Initialization ===');
        
        // Initialize database connection
        console.log('\nStep 1: Creating database service instance...');
        const dbService = DatabaseService.getInstance();
        console.log('Database service instance created successfully');
        
        console.log('\nStep 2: Initializing database connection...');
        await dbService.initialize();
        console.log('Database initialized successfully');

        // Middleware setup
        console.log('\nStep 3: Setting up middleware...');
        app.use(cors({
            origin: 'http://localhost:3000',
            credentials: true
        }));
        console.log('CORS middleware set up successfully');

        // Body parsing middleware
        console.log('\nStep 4: Setting up body parsing middleware...');
        app.use(express.json());
        app.use(express.urlencoded({ extended: true }));
        app.use(cookieParser());
        console.log('Basic middleware set up successfully');

        // Session middleware
        console.log('\nStep 5: Setting up session middleware...');
        app.use(session({
            secret: process.env.SESSION_SECRET || 'your-secret-key',
            resave: false,
            saveUninitialized: false,
            cookie: {
                secure: process.env.NODE_ENV === 'production',
                httpOnly: true,
                maxAge: 24 * 60 * 60 * 1000 // 24 hours
            }
        }));
        console.log('Session middleware set up successfully');

        // Add user to locals middleware
        console.log('\nStep 6: Setting up user locals middleware...');
        app.use(addUserToLocals);
        console.log('User locals middleware set up successfully');

        // Set view engine
        console.log('\nStep 7: Setting up view engine...');
        app.set('views', path.join(__dirname, 'views'));
        app.set('view engine', 'ejs');
        console.log('View engine set up successfully');

        // Static files
        console.log('\nStep 8: Setting up static file serving...');
        app.use('/dist', express.static(path.join(__dirname, '../../dist'), {
            setHeaders: (res, path) => {
                if (path.endsWith('.css')) {
                    res.setHeader('Content-Type', 'text/css');
                }
            }
        }));
        app.use(express.static(path.join(__dirname, '../public')));
        console.log('Static file serving set up successfully');

        // Routes
        console.log('\nStep 9: Setting up routes...');
        app.use('/auth', authRoutes);
        app.use('/game', gameRoutes);
        app.use('/property', propertyRoutes);
        app.use('/lobby', lobbyRoutes);
        console.log('Routes set up successfully');

        // Root route
        app.get('/', (req, res) => {
            console.log('Root route accessed, user:', res.locals.user);
            const user = res.locals.user;
            if (user) {
                res.redirect('/lobby');
            } else {
                res.redirect('/auth/login');
            }
        });

        // Error handling middleware
        console.log('\nStep 10: Setting up error handling...');
        app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
            console.error('Error:', err);
            res.status(err.status || 500).render('error', {
                message: err.message || 'An unexpected error occurred',
                error: process.env.NODE_ENV === 'development' ? err : {}
            });
        });
        console.log('Error handling set up successfully');

        // Start server
        console.log('\nStep 11: Starting server...');
        server = app.listen(port, () => {
            console.log(`\n=== Server is running on http://localhost:${port} ===\n`);
        });

        // Setup WebSocket
        console.log('\nStep 12: Setting up WebSocket...');
        setupWebSocket(server);
        console.log('WebSocket server initialized successfully');

        // Handle WebSocket upgrade requests
        server.on('upgrade', (request, socket, head) => {
            const url = new URL(request.url!, `http://${request.headers.host}`);
            console.log('WebSocket upgrade request for URL:', url.pathname);
            
            if (url.pathname.startsWith('/ws/game/')) {
                socket.on('error', (error) => {
                    console.error('WebSocket upgrade error:', error);
                    socket.destroy();
                });
            }
        });

        console.log('\n=== Application initialization completed successfully ===\n');

        // Handle server errors
        server.on('error', (error: any) => {
            console.error('\nServer error:', error);
            if (error.code === 'EADDRINUSE') {
                console.error(`Port ${port} is already in use`);
                process.exit(1);
            }
        });

        return server;
    } catch (error) {
        console.error('\nFailed to initialize application:', error);
        if (server) {
            server.close();
        }
        process.exit(1);
    }
};

// Start the application with error handling
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    process.exit(1);
});

process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    process.exit(1);
});

initializeApp().catch(error => {
    console.error('Failed to start application:', error);
    process.exit(1);
});

export default app;
