import connectPgSimple from "connect-pg-simple";
import type { Express, RequestHandler } from "express";
import flash from "express-flash";
import session from "express-session";

let sessionMiddleware: RequestHandler | undefined = undefined;

export default (app: Express): RequestHandler | undefined => {
  if (sessionMiddleware === undefined) {
    sessionMiddleware = session({
      store: new (connectPgSimple(session))({
        createTableIfMissing: true, 
      }),
      secret: process.env.SESSION_SECRET!, 
      resave: true, 
      saveUninitialized: true, 
      cookie: {
        secure: process.env.NODE_ENV === 'production',
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
        httpOnly: true,
        sameSite: 'lax'
      },
      name: 'monopoly.sid', // Custom session cookie name
      rolling: true // Refresh session with each request
    });
    app.use(sessionMiddleware);
    app.use(flash()); // Add flash messages
  }
  return sessionMiddleware;
};
