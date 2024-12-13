import { Request, Response, NextFunction } from 'express';
import session from 'express-session';

type TypedSession = session.Session & {
  userId?: number;
  username?: string;
  returnTo?: string;
};

export const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  const typedSession = req.session as TypedSession;
  if (!typedSession.userId) {
    // Store the original URL they were trying to access
    typedSession.returnTo = req.originalUrl;
    return res.redirect('/login');
  }
  next();
};

export const requireNoAuth = (req: Request, res: Response, next: NextFunction) => {
  const typedSession = req.session as TypedSession;
  if (typedSession.userId) {
    return res.redirect('/lobby');
  }
  next();
};

export const addUserToLocals = (req: Request, res: Response, next: NextFunction) => {
  const typedSession = req.session as TypedSession;
  const userId = typedSession.userId;
  const username = typedSession.username;
  
  if (userId && username) {
    res.locals.user = {
      id: userId,
      username: username
    };
  }
  next();
}; 