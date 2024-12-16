-- Create game_statistics table
CREATE TABLE IF NOT EXISTS game_statistics (
  id SERIAL PRIMARY KEY,
  game_id INTEGER REFERENCES games(id) ON DELETE CASCADE,
  total_turns INTEGER DEFAULT 0,
  most_owned_color VARCHAR(50),
  highest_rent_paid INTEGER DEFAULT 0,
  most_visited_property VARCHAR(100),
  longest_game INTEGER DEFAULT 0,
  bankruptcy_count INTEGER DEFAULT 0,
  trading_volume INTEGER DEFAULT 0,
  auctions_sold INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create player_statistics table
CREATE TABLE IF NOT EXISTS player_statistics (
  id SERIAL PRIMARY KEY,
  game_id INTEGER REFERENCES games(id) ON DELETE CASCADE,
  player_id INTEGER REFERENCES players(id) ON DELETE CASCADE,
  username VARCHAR(100),
  total_money INTEGER DEFAULT 0,
  properties_owned INTEGER DEFAULT 0,
  rent_collected INTEGER DEFAULT 0,
  rent_paid INTEGER DEFAULT 0,
  passed_go INTEGER DEFAULT 0,
  jail_visits INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create trade_statistics table
CREATE TABLE IF NOT EXISTS trade_statistics (
  id SERIAL PRIMARY KEY,
  game_id INTEGER REFERENCES games(id) ON DELETE CASCADE,
  trade_id INTEGER REFERENCES trades(id) ON DELETE CASCADE,
  from_player_id INTEGER REFERENCES players(id) ON DELETE CASCADE,
  to_player_id INTEGER REFERENCES players(id) ON DELETE CASCADE,
  properties_traded INTEGER DEFAULT 0,
  money_exchanged INTEGER DEFAULT 0,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create property_statistics table
CREATE TABLE IF NOT EXISTS property_statistics (
  id SERIAL PRIMARY KEY,
  game_id INTEGER REFERENCES games(id) ON DELETE CASCADE,
  property_id INTEGER REFERENCES properties(id) ON DELETE CASCADE,
  name VARCHAR(100),
  times_landed_on INTEGER DEFAULT 0,
  rent_collected INTEGER DEFAULT 0,
  ownership_changes INTEGER DEFAULT 0,
  houses_built INTEGER DEFAULT 0,
  hotels_built INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Add triggers to update timestamps
CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_game_statistics_timestamp
  BEFORE UPDATE ON game_statistics
  FOR EACH ROW
  EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER update_player_statistics_timestamp
  BEFORE UPDATE ON player_statistics
  FOR EACH ROW
  EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER update_property_statistics_timestamp
  BEFORE UPDATE ON property_statistics
  FOR EACH ROW
  EXECUTE FUNCTION update_timestamp(); 