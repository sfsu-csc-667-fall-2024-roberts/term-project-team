-- Fix column names in games table
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'games' AND column_name = 'ownerid'
    ) THEN
        ALTER TABLE games RENAME COLUMN ownerid TO owner_id;
    END IF;
END $$;

-- Fix column names in players table
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'players' AND column_name = 'userid'
    ) THEN
        ALTER TABLE players RENAME COLUMN userid TO user_id;
    END IF;

    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'players' AND column_name = 'isbot'
    ) THEN
        ALTER TABLE players RENAME COLUMN isbot TO is_bot;
    END IF;

    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'players' AND column_name = 'botstrategy'
    ) THEN
        ALTER TABLE players RENAME COLUMN botstrategy TO bot_strategy;
    END IF;

    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'players' AND column_name = 'botdifficulty'
    ) THEN
        ALTER TABLE players RENAME COLUMN botdifficulty TO bot_difficulty;
    END IF;
END $$; 