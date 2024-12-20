-- Create migrations table
CREATE TABLE IF NOT EXISTS migrations (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    applied_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create users table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(255) NOT NULL UNIQUE,
    email VARCHAR(255) UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create session table
CREATE TABLE IF NOT EXISTS "session" (
    "sid" varchar NOT NULL COLLATE "default",
    "sess" json NOT NULL,
    "expire" timestamp(6) NOT NULL,
    CONSTRAINT "session_pkey" PRIMARY KEY ("sid")
);

-- Create games table
CREATE TABLE IF NOT EXISTS games (
    id SERIAL PRIMARY KEY,
    owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL DEFAULT 'waiting',
    game_state JSONB DEFAULT '{"phase": "waiting", "currentPlayerIndex": 0, "diceRolls": [], "turnOrder": []}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create players table
CREATE TABLE IF NOT EXISTS players (
    id SERIAL PRIMARY KEY,
    game_id INTEGER NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    username VARCHAR(255) NOT NULL,
    position INTEGER NOT NULL DEFAULT 0,
    money INTEGER NOT NULL DEFAULT 1500,
    is_bot BOOLEAN NOT NULL DEFAULT FALSE,
    is_bankrupt BOOLEAN NOT NULL DEFAULT FALSE,
    in_jail BOOLEAN NOT NULL DEFAULT FALSE,
    jail_turns INTEGER NOT NULL DEFAULT 0,
    turn_order INTEGER NOT NULL DEFAULT 0,
    bot_strategy VARCHAR(50),
    bot_difficulty VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (game_id, user_id)
);

-- Create properties table
CREATE TABLE IF NOT EXISTS properties (
    id SERIAL PRIMARY KEY,
    game_id INTEGER NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    position INTEGER NOT NULL,
    name VARCHAR(255) NOT NULL,
    owner_id INTEGER REFERENCES players(id) ON DELETE SET NULL,
    type VARCHAR(50) NOT NULL CHECK (type IN ('property', 'railroad', 'utility')),
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

-- Create game_events table
CREATE TABLE IF NOT EXISTS game_events (
    id SERIAL PRIMARY KEY,
    game_id INTEGER REFERENCES games(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    player_id INTEGER REFERENCES players(id),
    related_player_id INTEGER REFERENCES players(id),
    property_id INTEGER REFERENCES properties(id),
    amount INTEGER,
    position INTEGER,
    description TEXT,
    metadata JSONB,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create game_statistics table
CREATE TABLE IF NOT EXISTS game_statistics (
    id SERIAL PRIMARY KEY,
    game_id INTEGER REFERENCES games(id) ON DELETE CASCADE,
    total_turns INTEGER DEFAULT 0,
    most_owned_color VARCHAR(50),
    highest_rent_paid INTEGER DEFAULT 0,
    most_visited_property VARCHAR(255),
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
    player_id INTEGER REFERENCES players(id),
    total_moves INTEGER DEFAULT 0,
    properties_owned INTEGER DEFAULT 0,
    rent_collected INTEGER DEFAULT 0,
    rent_paid INTEGER DEFAULT 0,
    passes_through_go INTEGER DEFAULT 0,
    times_in_jail INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create trade_statistics table
CREATE TABLE IF NOT EXISTS trade_statistics (
    id SERIAL PRIMARY KEY,
    game_id INTEGER REFERENCES games(id) ON DELETE CASCADE,
    from_player_id INTEGER REFERENCES players(id),
    to_player_id INTEGER REFERENCES players(id),
    properties_traded INTEGER DEFAULT 0,
    money_exchanged INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create property_statistics table
CREATE TABLE IF NOT EXISTS property_statistics (
    id SERIAL PRIMARY KEY,
    game_id INTEGER REFERENCES games(id) ON DELETE CASCADE,
    property_id INTEGER REFERENCES properties(id),
    times_landed_on INTEGER DEFAULT 0,
    rent_generated INTEGER DEFAULT 0,
    times_mortgaged INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
