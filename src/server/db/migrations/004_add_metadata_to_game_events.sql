-- Ensure metadata column exists and has correct default value
DO $$ 
BEGIN
    -- Add metadata column if it doesn't exist
    ALTER TABLE game_events
        ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

    -- Update existing rows that have NULL metadata
    UPDATE game_events 
    SET metadata = '{}'::jsonb 
    WHERE metadata IS NULL;

    -- Set default value for future rows
    ALTER TABLE game_events
        ALTER COLUMN metadata SET DEFAULT '{}'::jsonb;
END $$; 