-- Fix column names for consistent naming
DO $$
BEGIN
    -- Add hashed_password column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'hashed_password') THEN
        ALTER TABLE users ADD COLUMN hashed_password VARCHAR(255);
    END IF;

    -- Ensure gameId is properly named in players table
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'players' AND column_name = 'gameid') THEN
        ALTER TABLE players RENAME COLUMN gameid TO game_id;
    END IF;

    -- Copy passwordHash to hashed_password if it exists
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'passwordhash') THEN
        UPDATE users SET hashed_password = passwordhash;
        ALTER TABLE users DROP COLUMN passwordhash;
    END IF;
END $$; 