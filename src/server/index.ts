import express from 'express';
import session from 'express-session';
import path from 'path';
import livereload from 'livereload';
import connectLivereload from 'connect-livereload';
import { pool } from './db/config';
import authRoutes from './routes/auth';
import gameRoutes from './routes/game';
import lobbyRoutes from './routes/lobby';
import { addUserToLocals } from './middleware';
import { exec } from 'child_process';
import { promisify } from 'util';
import net from 'net';
import pgSession from 'connect-pg-simple';

const execAsync = promisify(exec);
const LIVERELOAD_PORT = 35729;

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize PostgreSQL session store
const PostgresqlStore = pgSession(session);

// Configure session middleware with PostgreSQL store
app.use(session({
  store: new PostgresqlStore({
    pool,
    tableName: 'user_sessions',   // Table to store sessions
    createTableIfMissing: true,   // Auto-create sessions table
    pruneSessionInterval: 60      // Cleanup old sessions every 60 seconds
  }),
  secret: process.env.JWT_SECRET || 'your_secret_key',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    httpOnly: true,
    sameSite: 'lax'
  },
  name: 'monopoly.sid', // custom session cookie name
  rolling: true // Refresh session with each request
}));

// Check if a port is in use
async function isPortInUse(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const tester = net.createServer()
      .once('error', () => resolve(true))
      .once('listening', () => {
        tester.once('close', () => resolve(false)).close();
      })
      .listen(port);
  });
}

// Kill existing LiveReload processes
async function cleanupLiveReload(): Promise<void> {
  try {
    console.log('Checking for existing LiveReload processes...');
    
    if (await isPortInUse(LIVERELOAD_PORT)) {
      console.log(`Port ${LIVERELOAD_PORT} is in use, cleaning up...`);
      try {
        const { stdout } = await execAsync(`lsof -i :${LIVERELOAD_PORT}`);
        const lines = stdout.split('\n');
        
        for (let i = 1; i < lines.length; i++) {
          const line = lines[i].trim();
          if (line) {
            const parts = line.split(/\s+/);
            if (parts.length >= 2) {
              const pid = parts[1];
              try {
                await execAsync(`kill -9 ${pid}`);
                console.log(`Killed process ${pid}`);
              } catch (error) {
                console.log(`Failed to kill process ${pid}:`, error);
              }
            }
          }
        }
      } catch (error) {
        console.log('No processes found to kill');
      }
      
      // Wait a bit for the port to be released
      await new Promise(resolve => setTimeout(resolve, 1000));
    } else {
      console.log('LiveReload port is available');
    }
  } catch (error) {
    console.error('Error during LiveReload cleanup:', error);
  }
}

// Initialize LiveReload server with retries
async function initializeLiveReload(retries = 3): Promise<void> {
  for (let i = 0; i < retries; i++) {
    try {
      await cleanupLiveReload();
      
      if (await isPortInUse(LIVERELOAD_PORT)) {
        console.log(`Port ${LIVERELOAD_PORT} still in use after cleanup, retrying...`);
        await new Promise(resolve => setTimeout(resolve, 1000));
        continue;
      }

      const liveReloadServer = livereload.createServer({
        port: LIVERELOAD_PORT,
        exts: ['js', 'css', 'ejs'],
        debug: true
      });

      liveReloadServer.watch([
        path.join(process.cwd(), 'public'),
        path.join(process.cwd(), 'src/server/views')
      ]);

      liveReloadServer.server.once("connection", () => {
        setTimeout(() => {
          liveReloadServer.refresh("/");
        }, 100);
      });

      // Add LiveReload middleware
      app.use(connectLivereload());
      console.log('LiveReload server started successfully');
      return;
    } catch (error) {
      console.error(`LiveReload initialization attempt ${i + 1} failed:`, error);
      if (i === retries - 1) {
        console.error('Failed to initialize LiveReload after all retries');
      }
    }
  }
}

// Initialize LiveReload
initializeLiveReload().catch(error => {
  console.error('Failed to initialize LiveReload:', error);
});

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// Add user data to locals
app.use(addUserToLocals);

// View engine setup
app.set('view engine', 'ejs');
app.set('views', path.join(process.cwd(), 'src', 'server', 'views'));

// Root route - redirect to lobby or login
app.get('/', (req, res) => {
  const session = req.session as session.Session & { userId?: number };
  if (session.userId) {
    res.redirect('/lobby');
  } else {
    res.redirect('/login');
  }
});

// Routes
app.use(authRoutes);
app.use('/game', gameRoutes);
app.use(lobbyRoutes);

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(err.status || 500);
  res.render('error', {
    message: err.message,
    error: process.env.NODE_ENV === 'development' ? err : {}
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
