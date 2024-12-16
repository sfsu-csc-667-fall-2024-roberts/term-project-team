-- Drop existing properties table and recreate with correct column names
DROP TABLE IF EXISTS properties CASCADE;

CREATE TABLE IF NOT EXISTS properties (
  id SERIAL PRIMARY KEY,
  game_id INTEGER NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  name VARCHAR(255) NOT NULL,
  owner_id INTEGER REFERENCES players(id) ON DELETE SET NULL,
  type VARCHAR(50) NOT NULL,
  price INTEGER,
  rent_levels INTEGER[],
  house_cost INTEGER,
  hotel_cost INTEGER,
  mortgage_value INTEGER,
  color_group VARCHAR(50),
  house_count INTEGER DEFAULT 0,
  is_mortgaged BOOLEAN DEFAULT false,
  has_hotel BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
); 