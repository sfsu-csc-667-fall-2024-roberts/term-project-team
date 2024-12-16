-- Add new columns and modify existing ones without recreating tables
DO $$
BEGIN
    -- Add new columns to players table
    ALTER TABLE players
        ADD COLUMN IF NOT EXISTS isBot BOOLEAN NOT NULL DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS isBankrupt BOOLEAN NOT NULL DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS inJail BOOLEAN NOT NULL DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS jailTurns INTEGER NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS turnOrder INTEGER NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS botStrategy VARCHAR(50),
        ADD COLUMN IF NOT EXISTS botDifficulty VARCHAR(50);

    -- Add gameState to games table
    ALTER TABLE games
        ADD COLUMN IF NOT EXISTS gameState JSONB DEFAULT '{"phase": "waiting", "currentPlayerIndex": 0, "diceRolls": [], "turnOrder": []}'::jsonb;

    -- Rename columns from snake_case to camelCase
    -- Users table
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'created_at') THEN
        ALTER TABLE users RENAME COLUMN created_at TO createdAt;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'updated_at') THEN
        ALTER TABLE users RENAME COLUMN updated_at TO updatedAt;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'password_hash') THEN
        ALTER TABLE users RENAME COLUMN password_hash TO passwordHash;
    END IF;

    -- Games table
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'games' AND column_name = 'created_at') THEN
        ALTER TABLE games RENAME COLUMN created_at TO createdAt;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'games' AND column_name = 'updated_at') THEN
        ALTER TABLE games RENAME COLUMN updated_at TO updatedAt;
    END IF;

    -- Players table
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'players' AND column_name = 'created_at') THEN
        ALTER TABLE players RENAME COLUMN created_at TO createdAt;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'players' AND column_name = 'updated_at') THEN
        ALTER TABLE players RENAME COLUMN updated_at TO updatedAt;
    END IF;

    -- Properties table
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'properties' AND column_name = 'created_at') THEN
        ALTER TABLE properties RENAME COLUMN created_at TO createdAt;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'properties' AND column_name = 'updated_at') THEN
        ALTER TABLE properties RENAME COLUMN updated_at TO updatedAt;
    END IF;
END $$; 