import express from 'express';
import session from 'express-session';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import livereload from 'livereload';
import connectLivereload from 'connect-livereload';
import { pool } from './db/config';
import authRoutes from './routes/auth';
import gameRoutes from './routes/game';
import lobbyRoutes from './routes/lobby';
import { addUserToLocals } from './middleware';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const app = express();
const PORT = process.env.PORT || 3000;

// Kill existing LiveReload processes
async function cleanupLiveReload(): Promise<void> {
  try {
    console.log('Checking for existing LiveReload processes...');
    
    // Find processes using port 35729
    const { stdout } = await execAsync('lsof -i :35729');
    
    if (stdout) {
      console.log('Found existing LiveReload processes, cleaning up...');
      const lines = stdout.split('\n');
      
      // Skip header line and process each line
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
    } else {
      console.log('No existing LiveReload processes found');
    }
  } catch (error) {
    // If lsof command fails, it means no process is using the port
    console.log('No existing LiveReload processes found');
  }
}

// Run cleanup before starting LiveReload
cleanupLiveReload().then(() => {
  // Configure LiveReload
  const liveReloadServer = livereload.createServer({
    port: 35729,
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
}).catch(error => {
  console.error('Failed to cleanup LiveReload:', error);
});

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// Session configuration
app.use(session({
  secret: process.env.JWT_SECRET || 'your_secret_key',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    httpOnly: true,
    sameSite: 'lax'
  },
  name: 'monopoly.sid', // Custom session cookie name
  rolling: true // Refresh session with each request
}));

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
