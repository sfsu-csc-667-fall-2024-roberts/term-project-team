-- Create game_events table
CREATE TABLE game_events (
  id SERIAL PRIMARY KEY,
  game_id INTEGER NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  event_type VARCHAR(50) NOT NULL,
  player_id INTEGER REFERENCES players(id) ON DELETE SET NULL,
  related_player_id INTEGER REFERENCES players(id) ON DELETE SET NULL,
  property_id INTEGER REFERENCES properties(id) ON DELETE SET NULL,
  amount INTEGER,
  position INTEGER,
  description TEXT,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Create indexes for efficient querying
CREATE INDEX idx_game_events_game_id ON game_events(game_id);
CREATE INDEX idx_game_events_player_id ON game_events(player_id);
CREATE INDEX idx_game_events_timestamp ON game_events(timestamp);
CREATE INDEX idx_game_events_event_type ON game_events(event_type);

-- Create game_messages table if it doesn't exist
CREATE TABLE IF NOT EXISTS game_messages (
  id SERIAL PRIMARY KEY,
  game_id INTEGER NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  player_id INTEGER REFERENCES players(id) ON DELETE SET NULL,
  message TEXT NOT NULL,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  message_type VARCHAR(50) DEFAULT 'game'
);

-- Create indexes for game_messages
CREATE INDEX idx_game_messages_game_id ON game_messages(game_id);
CREATE INDEX idx_game_messages_timestamp ON game_messages(timestamp);

-- Add statistics columns to games table
ALTER TABLE games ADD COLUMN IF NOT EXISTS statistics JSONB DEFAULT '{}'::jsonb;
ALTER TABLE games ADD COLUMN IF NOT EXISTS total_moves INTEGER DEFAULT 0;
ALTER TABLE games ADD COLUMN IF NOT EXISTS total_trades INTEGER DEFAULT 0;
ALTER TABLE games ADD COLUMN IF NOT EXISTS total_bankruptcies INTEGER DEFAULT 0;

-- Add statistics columns to players table
ALTER TABLE players ADD COLUMN IF NOT EXISTS total_earned INTEGER DEFAULT 0;
ALTER TABLE players ADD COLUMN IF NOT EXISTS total_spent INTEGER DEFAULT 0;
ALTER TABLE players ADD COLUMN IF NOT EXISTS times_in_jail INTEGER DEFAULT 0;
ALTER TABLE players ADD COLUMN IF NOT EXISTS properties_owned INTEGER DEFAULT 0;
ALTER TABLE players ADD COLUMN IF NOT EXISTS houses_built INTEGER DEFAULT 0;
ALTER TABLE players ADD COLUMN IF NOT EXISTS hotels_built INTEGER DEFAULT 0; 