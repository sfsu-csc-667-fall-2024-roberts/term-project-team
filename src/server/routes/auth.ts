import express from 'express';
import users from '../db/users';
import { requireNoAuth } from '../middleware/auth';
import session from 'express-session';

const router = express.Router();

// GET /login - Show login form
router.get('/login', requireNoAuth, (req, res) => {
  res.render('auth/login', { error: req.query.error });
});

// GET /register - Show registration form
router.get('/register', requireNoAuth, (req, res) => {
  res.render('auth/register', { error: req.query.error });
});

// POST /register - Handle registration
router.post('/register', requireNoAuth, async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.redirect('/register?error=missing-fields');
    }

    // Try to register user
    const user = await users.register(username, password);
    
    // Set session and save it before redirecting
    const typedSession = req.session as session.Session & { 
      userId?: number;
      username?: string;
      returnTo?: string;
    };
    
    typedSession.userId = user.id;
    typedSession.username = user.username;
    
    req.session.save((err) => {
      if (err) {
        console.error('Session save error:', err);
        return res.redirect('/register?error=session-error');
      }
      res.redirect('/lobby');
    });
  } catch (err) {
    console.error('Registration error:', err);
    if (err instanceof Error && err.message === 'Username already taken') {
      res.redirect('/register?error=username-taken');
    } else {
      res.redirect('/register?error=registration-failed');
    }
  }
});

// POST /login - Handle login
router.post('/login', requireNoAuth, async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.redirect('/login?error=missing-fields');
    }

    // Try to login
    const user = await users.login(username, password);
    
    // Set session and save it before redirecting
    const typedSession = req.session as session.Session & { 
      userId?: number;
      username?: string;
      returnTo?: string;
    };
    
    typedSession.userId = user.id;
    typedSession.username = user.username;
    
    req.session.save((err) => {
      if (err) {
        console.error('Session save error:', err);
        return res.redirect('/login?error=session-error');
      }
      const returnTo = typedSession.returnTo || '/lobby';
      delete typedSession.returnTo;
      res.redirect(returnTo);
    });
  } catch (err) {
    console.error('Login error:', err);
    res.redirect('/login?error=invalid-credentials');
  }
});

// POST /logout - Handle logout
router.post('/logout', (req, res) => {
  const sessionID = req.sessionID;
  console.log('Logging out session:', sessionID);
  
  req.session.destroy((err) => {
    if (err) {
      console.error('Logout error:', err);
    }
    res.clearCookie('monopoly.sid');
    res.redirect('/login');
  });
});

export default router;
