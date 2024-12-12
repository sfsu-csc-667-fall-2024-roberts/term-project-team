-- Modify players table to support bot players
DO $$ 
BEGIN
    -- Drop foreign key if it exists
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints 
               WHERE constraint_name = 'players_user_id_fkey') THEN
        ALTER TABLE players DROP CONSTRAINT players_user_id_fkey;
    END IF;

    -- Modify user_id to be nullable if not already
    ALTER TABLE players ALTER COLUMN user_id DROP NOT NULL;

    -- Add is_bot column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                  WHERE table_name = 'players' AND column_name = 'is_bot') THEN
        ALTER TABLE players ADD COLUMN is_bot BOOLEAN NOT NULL DEFAULT false;
    END IF;

    -- Add bot_strategy column for different bot behaviors
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                  WHERE table_name = 'players' AND column_name = 'bot_strategy') THEN
        ALTER TABLE players ADD COLUMN bot_strategy VARCHAR(50);
        ALTER TABLE players ADD CONSTRAINT bot_strategy_check 
            CHECK (bot_strategy IN ('aggressive', 'conservative', 'balanced') OR bot_strategy IS NULL);
    END IF;

    -- Add bot_difficulty column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                  WHERE table_name = 'players' AND column_name = 'bot_difficulty') THEN
        ALTER TABLE players ADD COLUMN bot_difficulty VARCHAR(20);
        ALTER TABLE players ADD CONSTRAINT bot_difficulty_check 
            CHECK (bot_difficulty IN ('easy', 'medium', 'hard') OR bot_difficulty IS NULL);
    END IF;

    -- Add username column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                  WHERE table_name = 'players' AND column_name = 'username') THEN
        ALTER TABLE players ADD COLUMN username VARCHAR(255);
        
        -- Update usernames for existing players
        UPDATE players p 
        SET username = u.username 
        FROM users u 
        WHERE p.user_id = u.id;
        
        -- Make username NOT NULL
        ALTER TABLE players ALTER COLUMN username SET NOT NULL;
    END IF;

    -- Re-add foreign key with ON DELETE CASCADE
    ALTER TABLE players ADD CONSTRAINT players_user_id_fkey 
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
END $$;