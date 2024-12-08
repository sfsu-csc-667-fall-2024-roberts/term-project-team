import express from 'express';
import bcrypt from 'bcrypt';
import { createUser, getUserByUsername } from '../db/services/dbService';
import { requireNoAuth } from '../middleware/auth';

const router = express.Router();

// GET /register - Show registration form
router.get('/register', requireNoAuth, (_req, res) => {
  res.render('auth/register', { error: null });
});

// POST /register - Handle registration
router.post('/register', requireNoAuth, async (req, res) => {
  try {
    const { username, password, confirmPassword } = req.body;

    // Basic validation
    if (!username || !password || !confirmPassword) {
      return res.render('auth/register', { 
        error: 'All fields are required' 
      });
    }

    if (password !== confirmPassword) {
      return res.render('auth/register', { 
        error: 'Passwords do not match' 
      });
    }

    // Check if username already exists
    const existingUser = await getUserByUsername(username);
    if (existingUser) {
      return res.render('auth/register', { 
        error: 'Username already taken' 
      });
    }

    // Create new user
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await createUser(username, hashedPassword);

    // Log them in automatically
    req.session.userId = user.id;
    req.session.user = {
      id: user.id,
      username: user.username
    };

    res.redirect('/lobby');
  } catch (error) {
    console.error('Registration error:', error);
    res.render('auth/register', { 
      error: 'An error occurred during registration' 
    });
  }
});

// GET /login - Show login form
router.get('/login', requireNoAuth, (_req, res) => {
  res.render('auth/login', { error: null });
});

// POST /login - Handle login
router.post('/login', requireNoAuth, async (req, res) => {
  try {
    const { username, password } = req.body;

    // Basic validation
    if (!username || !password) {
      return res.render('auth/login', { 
        error: 'Username and password are required' 
      });
    }

    // Find user
    const user = await getUserByUsername(username);
    if (!user) {
      return res.render('auth/login', { 
        error: 'Invalid username or password' 
      });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.hashed_password);
    if (!isValidPassword) {
      return res.render('auth/login', { 
        error: 'Invalid username or password' 
      });
    }

    // Set session
    req.session.userId = user.id;
    req.session.user = {
      id: user.id,
      username: user.username
    };

    // Redirect to original URL or lobby
    const returnTo = req.session.returnTo || '/lobby';
    delete req.session.returnTo;
    res.redirect(returnTo);

  } catch (error) {
    console.error('Login error:', error);
    res.render('auth/login', { 
      error: 'An error occurred during login' 
    });
  }
});

// POST /logout - Handle logout
router.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Logout error:', err);
    }
    res.redirect('/login');
  });
});

export default router;
