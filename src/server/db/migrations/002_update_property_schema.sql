-- Add new columns to game_properties table if it exists
DO $$ 
BEGIN
    -- First ensure the game_properties table exists
    IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'game_properties') THEN
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
            color_group VARCHAR(50),
            mortgaged BOOLEAN DEFAULT false,
            houses INTEGER DEFAULT 0,
            hotels INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            house_cost INTEGER DEFAULT 0,
            hotel_cost INTEGER DEFAULT 0,
            rent_levels INTEGER[] DEFAULT '{}',
            current_rent INTEGER DEFAULT 0,
            can_be_improved BOOLEAN DEFAULT true,
            max_houses INTEGER DEFAULT 4,
            max_hotels INTEGER DEFAULT 1,
            mortgage_value INTEGER DEFAULT 0,
            house_count INTEGER DEFAULT 0,
            hotel_count INTEGER DEFAULT 0
        );
    ELSE
        -- First rename hotel to hotels if it exists
        IF EXISTS (SELECT 1 FROM information_schema.columns 
                  WHERE table_name = 'game_properties' AND column_name = 'hotel') THEN
            ALTER TABLE game_properties RENAME COLUMN hotel TO hotels;
        END IF;

        -- Add new columns to existing table if they don't exist
        BEGIN
            ALTER TABLE game_properties
                ADD COLUMN IF NOT EXISTS color_group VARCHAR(50);
        EXCEPTION WHEN duplicate_column THEN
            -- Column already exists, ignore
        END;
        
        BEGIN
            ALTER TABLE game_properties
                ADD COLUMN IF NOT EXISTS house_cost INTEGER DEFAULT 0,
                ADD COLUMN IF NOT EXISTS hotel_cost INTEGER DEFAULT 0,
                ADD COLUMN IF NOT EXISTS rent_levels INTEGER[] DEFAULT '{}',
                ADD COLUMN IF NOT EXISTS current_rent INTEGER DEFAULT 0,
                ADD COLUMN IF NOT EXISTS can_be_improved BOOLEAN DEFAULT true,
                ADD COLUMN IF NOT EXISTS max_houses INTEGER DEFAULT 4,
                ADD COLUMN IF NOT EXISTS max_hotels INTEGER DEFAULT 1,
                ADD COLUMN IF NOT EXISTS mortgage_value INTEGER DEFAULT 0,
                ADD COLUMN IF NOT EXISTS house_count INTEGER DEFAULT 0,
                ADD COLUMN IF NOT EXISTS hotel_count INTEGER DEFAULT 0,
                ADD COLUMN IF NOT EXISTS color VARCHAR(50),
                ADD COLUMN IF NOT EXISTS hotels INTEGER DEFAULT 0;
        EXCEPTION WHEN duplicate_column THEN
            -- Columns already exist, ignore
        END;
    END IF;
END $$;

-- Update game_events table if it exists
DO $$ 
BEGIN
    -- First ensure the game_events table exists
    IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'game_events') THEN
        CREATE TABLE game_events (
            id SERIAL PRIMARY KEY,
            game_id INTEGER REFERENCES games(id),
            player_id INTEGER REFERENCES players(id),
            type VARCHAR(50) NOT NULL,
            description TEXT,
            property_id INTEGER REFERENCES game_properties(id),
            related_player_id INTEGER REFERENCES players(id),
            amount INTEGER,
            position INTEGER,
            metadata JSONB DEFAULT '{}'::jsonb,
            timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    ELSE
        -- Add new columns to existing table
        ALTER TABLE game_events
            ADD COLUMN IF NOT EXISTS type VARCHAR(50),
            ADD COLUMN IF NOT EXISTS description TEXT,
            ADD COLUMN IF NOT EXISTS property_id INTEGER REFERENCES game_properties(id),
            ADD COLUMN IF NOT EXISTS related_player_id INTEGER REFERENCES players(id),
            ADD COLUMN IF NOT EXISTS amount INTEGER,
            ADD COLUMN IF NOT EXISTS position INTEGER,
            ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb,
            ADD COLUMN IF NOT EXISTS timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

        -- Then drop old columns if they exist
        ALTER TABLE game_events
            DROP COLUMN IF EXISTS event_type,
            DROP COLUMN IF EXISTS event_data;

        -- Make type NOT NULL after migration
        UPDATE game_events SET type = 'UNKNOWN' WHERE type IS NULL;
        ALTER TABLE game_events
            ALTER COLUMN type SET NOT NULL;
    END IF;
END $$;