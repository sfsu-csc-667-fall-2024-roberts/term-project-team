-- Fix column names in properties table
DO $$
BEGIN
    -- Fix gameId to game_id
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'properties' AND column_name = 'gameid'
    ) THEN
        ALTER TABLE properties RENAME COLUMN gameid TO game_id;
    END IF;

    -- Fix ownerId to owner_id
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'properties' AND column_name = 'ownerid'
    ) THEN
        ALTER TABLE properties RENAME COLUMN ownerid TO owner_id;
    END IF;

    -- Fix houseCount to house_count
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'properties' AND column_name = 'housecount'
    ) THEN
        ALTER TABLE properties RENAME COLUMN housecount TO house_count;
    END IF;
END $$; 