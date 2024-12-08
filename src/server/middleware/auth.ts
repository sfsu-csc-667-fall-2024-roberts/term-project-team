import { Request, Response, NextFunction } from 'express';
import '../types/session';

// Middleware to check if user is authenticated
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session.userId) {
    // Store the original URL they were trying to access
    req.session.returnTo = req.originalUrl;
    return res.redirect('/login');
  }
  next();
}

// Middleware to check if user is NOT authenticated (for login/register pages)
export function requireNoAuth(req: Request, res: Response, next: NextFunction) {
  if (req.session.userId) {
    return res.redirect('/lobby'); // Redirect to lobby if already logged in
  }
  next();
}

// Add user data to response locals for use in templates
export function addUserToLocals(req: Request, res: Response, next: NextFunction) {
  res.locals.user = req.session.user || null;
  next();
} 