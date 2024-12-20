-- Create users table
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create players table
CREATE TABLE players (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create games table
CREATE TABLE games (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    max_players INTEGER NOT NULL,
    game_phase VARCHAR(50) NOT NULL,
    current_player_id INTEGER REFERENCES players(id),
    winner INTEGER REFERENCES players(id),
    dice_roll INTEGER[],
    doubles_count INTEGER DEFAULT 0,
    turn_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create game_players table
CREATE TABLE game_players (
    game_id INTEGER REFERENCES games(id),
    player_id INTEGER REFERENCES players(id),
    position INTEGER DEFAULT 0,
    money INTEGER DEFAULT 1500,
    properties INTEGER[] DEFAULT '{}',
    is_jailed BOOLEAN DEFAULT false,
    turns_in_jail INTEGER DEFAULT 0,
    is_bankrupt BOOLEAN DEFAULT false,
    jail_free_cards INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (game_id, player_id)
);

-- Create game_properties table
CREATE TABLE game_properties (
    id SERIAL PRIMARY KEY,
    game_id INTEGER REFERENCES games(id),
    name VARCHAR(255) NOT NULL,
    position INTEGER,
    price INTEGER NOT NULL,
    rent INTEGER NOT NULL,
    owner_id INTEGER REFERENCES players(id),
    type VARCHAR(50) NOT NULL,
    color VARCHAR(50),
    mortgaged BOOLEAN DEFAULT false,
    houses INTEGER DEFAULT 0,
    hotel BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create cards table
CREATE TABLE cards (
    id SERIAL PRIMARY KEY,
    type VARCHAR(50) NOT NULL CHECK (type IN ('chance', 'community_chest')),
    text TEXT NOT NULL,
    action_type VARCHAR(50) NOT NULL,
    action_value JSONB NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create game_cards table for tracking drawn cards
CREATE TABLE game_cards (
    id SERIAL PRIMARY KEY,
    game_id INTEGER REFERENCES games(id),
    card_id INTEGER REFERENCES cards(id),
    drawn_by INTEGER REFERENCES players(id),
    drawn_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    resolved BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create game_events table
CREATE TABLE game_events (
    id SERIAL PRIMARY KEY,
    game_id INTEGER REFERENCES games(id),
    type VARCHAR(50) NOT NULL,
    player_id INTEGER REFERENCES players(id),
    related_player_id INTEGER REFERENCES players(id),
    property_id INTEGER REFERENCES game_properties(id),
    amount INTEGER,
    position INTEGER,
    description TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX idx_game_players_game_id ON game_players(game_id);
CREATE INDEX idx_game_players_player_id ON game_players(player_id);
CREATE INDEX idx_game_properties_game_id ON game_properties(game_id);
CREATE INDEX idx_game_properties_owner_id ON game_properties(owner_id);
CREATE INDEX idx_game_events_game_id ON game_events(game_id);
CREATE INDEX idx_game_events_player_id ON game_events(player_id);
CREATE INDEX idx_game_cards_game_id ON game_cards(game_id);
CREATE INDEX idx_game_cards_card_id ON game_cards(card_id);
CREATE INDEX idx_game_cards_drawn_by ON game_cards(drawn_by);
CREATE INDEX idx_cards_type ON cards(type);

-- Create function to update updated_at timestamp
DO $$ 
BEGIN
    CREATE OR REPLACE FUNCTION update_updated_at_column()
    RETURNS TRIGGER AS $BODY$
    BEGIN
        NEW.updated_at = CURRENT_TIMESTAMP;
        RETURN NEW;
    END;
    $BODY$ LANGUAGE plpgsql;
END $$;

-- Create trigger for games table
DROP TRIGGER IF EXISTS update_games_updated_at ON games;
CREATE TRIGGER update_games_updated_at
    BEFORE UPDATE ON games
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column(); 