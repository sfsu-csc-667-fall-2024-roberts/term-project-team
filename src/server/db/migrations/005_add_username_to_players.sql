-- Add username column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'players' AND column_name = 'username') THEN
    ALTER TABLE players ADD COLUMN username VARCHAR(255);
    
    -- Update usernames for existing players
    UPDATE players p 
    SET username = u.username 
    FROM users u 
    WHERE p.userId = u.id;
    
    -- Make username NOT NULL
    ALTER TABLE players ALTER COLUMN username SET NOT NULL;
  END IF;
END $$;