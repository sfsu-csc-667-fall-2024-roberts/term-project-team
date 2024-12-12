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
  const startLiveReload = () => {
    // Use a different port range to avoid conflicts
    let port = 45729;
    const maxAttempts = 10;

    const tryPort = (attempt = 0) => {
      if (attempt >= maxAttempts) {
        console.log('Could not find available port for LiveReload, continuing without it');
        return;
      }

      const server = livereload.createServer({
        port: port + attempt,
        delay: 0,
        protocol: 'http',
        usePolling: true,
        exts: ['html', 'css', 'js', 'ts', 'ejs'],
        exclusions: [/node_modules/]
      }, () => {
        console.log(`LiveReload server started on port ${port + attempt}`);
      });

      server.server.on('error', (err: any) => {
        if (err.code === 'EADDRINUSE') {
          console.log(`Port ${port + attempt} in use, trying next port...`);
          tryPort(attempt + 1);
        } else {
          console.error('LiveReload error:', err);
        }
      });

      server.server.on('listening', () => {
        const actualPort = (server.server.address() as any).port;
        
        // Configure middleware with the working port
        app.use(connectLivereload({
          port: actualPort,
          src: `http://localhost:${actualPort}/livereload.js?snipver=1`
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
            `connect-src 'self' ws://localhost:${actualPort} http://localhost:*; ` +
            "base-uri 'self';"
          );
          next();
        });
      });

      server.watch(staticPath);
    };

    tryPort();
  };

  // Start LiveReload
  startLiveReload();
}

// Routes
app.get("/", (_req, res) => res.redirect("/lobby")); // Redirect root to lobby
app.use("/", authRoutes);
app.use("/", lobbyRoutes);
app.use("/", gameRoutes);
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
