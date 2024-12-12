-- Drop existing tables and their dependencies
DROP TABLE IF EXISTS players CASCADE;
DROP TABLE IF EXISTS games CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Recreate users table with correct structure
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(255) UNIQUE NOT NULL,
  hashed_password VARCHAR(255) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Recreate games table
CREATE TABLE games (
  id SERIAL PRIMARY KEY,
  owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status VARCHAR(50) NOT NULL DEFAULT 'waiting',
  game_state JSONB DEFAULT '{"phase": "waiting", "current_player_index": 0, "dice_rolls": [], "turn_order": []}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CHECK (status IN ('waiting', 'in-progress', 'finished'))
);

-- Recreate players table with bot support and username
CREATE TABLE players (
  id SERIAL PRIMARY KEY,
  game_id INTEGER NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  username VARCHAR(255) NOT NULL,
  balance INTEGER NOT NULL DEFAULT 1500,
  position INTEGER NOT NULL DEFAULT 0,
  jailed BOOLEAN NOT NULL DEFAULT FALSE,
  is_bot BOOLEAN NOT NULL DEFAULT FALSE,
  bot_strategy VARCHAR(50) CHECK (bot_strategy IN ('aggressive', 'conservative', 'balanced') OR bot_strategy IS NULL),
  bot_difficulty VARCHAR(20) CHECK (bot_difficulty IN ('easy', 'medium', 'hard') OR bot_difficulty IS NULL),
  turn_order INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
); 