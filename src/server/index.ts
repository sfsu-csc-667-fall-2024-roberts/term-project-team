import dotenv from "dotenv";
import express from "express";
import httpErrors from "http-errors";
import path from "path";
import morgan from "morgan";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import { pool } from "./db/config";
import { addUserToLocals, requireAuth } from "./middleware/auth";
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
      tableName: "session"
    }),
    secret: process.env.SESSION_SECRET || "your_session_secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      secure: process.env.NODE_ENV === "production"
    }
  })
);

// Add user data to response locals
app.use(addUserToLocals);

// Static files
const staticPath = path.join(process.cwd(), "src", "public");
app.use(express.static(staticPath));

// LiveReload setup in development
if (process.env.NODE_ENV !== "production") {
  const livereload = require("livereload");
  const connectLivereload = require("connect-livereload");
  
  const liveReloadServer = livereload.createServer();
  liveReloadServer.watch(staticPath);
  
  // Add CSP headers for development
  app.use((_req, res, next) => {
    res.setHeader(
      "Content-Security-Policy",
      "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' http://localhost:35729; connect-src 'self' ws://localhost:35729;"
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
