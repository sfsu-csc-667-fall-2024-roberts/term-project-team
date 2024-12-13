import 'express';
import { Session } from 'express-session';

declare module 'express-session' {
  interface SessionData {
    userId?: number;
    username?: string;
    returnTo?: string;
  }
}

declare module 'express' {
  interface Request {
    session: Session & {
      userId?: number;
      username?: string;
      returnTo?: string;
    };
  }
} 