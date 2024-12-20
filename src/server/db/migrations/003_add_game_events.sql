-- Update game_events foreign key constraints and ensure metadata column exists
DO $$ 
BEGIN
    -- Ensure ON DELETE CASCADE for game_id foreign key
    ALTER TABLE game_events
        DROP CONSTRAINT IF EXISTS game_events_game_id_fkey,
        ADD CONSTRAINT game_events_game_id_fkey 
        FOREIGN KEY (game_id) 
        REFERENCES games(id) 
        ON DELETE CASCADE;

    -- Ensure metadata column exists with default value
    ALTER TABLE game_events
        ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;
END $$;