import dotenv from "dotenv";
import express from "express";
import httpErrors from "http-errors";
import path from "path";
import morgan from "morgan";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import { pool } from "./db/config";
import { addUserToLocals } from "./middleware/auth";
import * as routes from "./routes";
import authRoutes from "./routes/auth";
import lobbyRoutes from "./routes/lobby";
import gameRoutes from "./routes/game";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// View engine setup
app.set("views", path.join(process.cwd(), "src", "server", "views"));
app.set("view engine", "ejs");

// Middleware
app.use(morgan("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Add request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

// Session setup
const PgSession = connectPgSimple(session);
app.use(
  session({
    store: new PgSession({
      pool,
      tableName: "session",
      createTableIfMissing: true
    }),
    secret: process.env.SESSION_SECRET || "your_session_secret",
    resave: true,
    saveUninitialized: true,
    cookie: {
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      secure: false, // Set to false for development
      httpOnly: true,
      sameSite: 'lax'
    }
  })
);

// Add user data to response locals
app.use(addUserToLocals);

// Static files
const staticPath = path.join(process.cwd(), "public");
app.use(express.static(staticPath));

// LiveReload setup in development
if (process.env.NODE_ENV !== "production") {
  const livereload = require("livereload");
  const connectLivereload = require("connect-livereload");
  
  // Create LiveReload server with dynamic port
  const startLiveReload = async () => {
    const basePort = 35729; // Default LiveReload port
    const maxPort = 35739; // Try up to 10 ports
    let currentPort = basePort;

    // Kill any existing LiveReload processes
    try {
      const { execSync } = require('child_process');
      console.log('Checking for existing LiveReload processes...');
      const cmd = process.platform === 'win32' 
        ? `FOR /F "tokens=5" %P IN ('netstat -a -n -o ^| findstr :35729') DO TaskKill /PID %P /F /T` 
        : `lsof -ti:35729 | xargs kill -9`;
      execSync(cmd, { stdio: 'ignore' });
      console.log('Cleaned up existing LiveReload processes');
    } catch (error) {
      // Ignore errors - no processes might be running
    }

    const tryPort = (port: number): Promise<any> => {
      return new Promise((resolve) => {
        const server = livereload.createServer({
          port: port,
          delay: 0,
          protocol: 'http',
          usePolling: true,
          exts: ['html', 'css', 'js', 'ts', 'ejs'],
          exclusions: [/node_modules/]
        });

        server.server.on('error', () => {
          resolve(null); // Port in use, try next
        });

        server.server.on('listening', () => {
          console.log(`LiveReload server started on port ${port}`);
          resolve(server);
        });

        server.watch(staticPath);

        // Set a timeout in case the server hangs
        setTimeout(() => {
          try {
            server.server.close();
          } catch (e) {
            // Ignore close errors
          }
          resolve(null);
        }, 1000);
      });
    };

    while (currentPort <= maxPort) {
      try {
        const server = await tryPort(currentPort);
        if (server) {
          // Configure middleware with the working port
          app.use(connectLivereload({
            port: currentPort,
            src: `http://localhost:${currentPort}/livereload.js?snipver=1`
          }));

          // Add CSP headers
          app.use((_req, res, next) => {
            res.setHeader(
              "Content-Security-Policy",
              "default-src 'self'; " +
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' http://localhost:*; " +
              "style-src 'self' 'unsafe-inline' 'unsafe-hashes'; " +
              "img-src 'self' data: https:; " +
              "font-src 'self' data:; " +
              `connect-src 'self' ws://localhost:${currentPort} http://localhost:*; ` +
              "base-uri 'self';"
            );
            next();
          });
          
          return;
        }
      } catch (error) {
        console.error(`Error on port ${currentPort}:`, error);
      }
      currentPort++;
    }

    console.log('Could not find available port for LiveReload, continuing without it');
  };

  // Start LiveReload
  startLiveReload().catch(err => {
    console.error('Failed to start LiveReload:', err);
  });
}

// Routes
app.get("/", (_req, res) => res.redirect("/lobby")); // Redirect root to lobby
app.use("/", authRoutes);
app.use("/", lobbyRoutes);
app.use("/game", gameRoutes);
app.use("/tests", routes.tests);

// 404 handler
app.use((_request, _response, next) => next(httpErrors(404)));

// Error handler
app.use((err: any, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  res.locals.message = err.message;
  res.locals.error = req.app.get("env") === "development" ? err : {};
  res.status(err.status || 500);
  res.render("error");
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
