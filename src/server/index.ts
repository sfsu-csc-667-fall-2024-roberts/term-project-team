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
  
  // Try to create LiveReload server with fallback ports
  const tryCreateLiveReloadServer = async (startPort: number, maxAttempts: number = 10): Promise<void> => {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const port = startPort + attempt;
      try {
        const liveReloadServer = livereload.createServer({
          port,
          delay: 0,
          protocol: 'http',
          usePolling: true,
          exts: ['html', 'css', 'js', 'ts', 'ejs'],
          exclusions: [/node_modules/],
          errorListener: (err: any) => {
            console.error('LiveReload error:', err);
          }
        });

        liveReloadServer.watch(staticPath);
        console.log(`LiveReload server started on port ${port}`);
        return;
      } catch (error: any) {
        if (error.code === 'EADDRINUSE') {
          console.warn(`LiveReload port ${port} is in use, trying next port...`);
          continue;
        }
        console.error('Failed to start LiveReload server:', error);
        break;
      }
    }
    console.warn('Could not start LiveReload server after', maxAttempts, 'attempts');
  };

  // Start with a high port number to avoid conflicts
  tryCreateLiveReloadServer(35729);
  
  // Add CSP headers for development
  app.use((_req, res, next) => {
    res.setHeader(
      "Content-Security-Policy",
      "default-src 'self'; " +
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' http://localhost:*; " +
      "style-src 'self' 'unsafe-inline' 'unsafe-hashes'; " +
      "img-src 'self' data: https:; " +
      "font-src 'self' data:; " +
      "connect-src 'self' ws://localhost:*; " +
      "base-uri 'self';"
    );
    next();
  });
  
  app.use(connectLivereload());
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
