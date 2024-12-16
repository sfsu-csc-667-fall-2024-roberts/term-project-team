-- Drop foreign key constraint if it exists
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.constraint_column_usage 
    WHERE constraint_name = 'players_userid_fkey') THEN
    ALTER TABLE players DROP CONSTRAINT players_userid_fkey;
  END IF;
END $$;

-- Modify userId to be nullable if not already
ALTER TABLE players ALTER COLUMN userid DROP NOT NULL;

-- Add isBot column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'players' AND column_name = 'isBot') THEN
    ALTER TABLE players ADD COLUMN isBot BOOLEAN NOT NULL DEFAULT false;
  END IF;
END $$;

-- Add bot strategy and difficulty columns if they don't exist
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'players' AND column_name = 'botStrategy') THEN
    ALTER TABLE players ADD COLUMN botStrategy VARCHAR(50);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'players' AND column_name = 'botDifficulty') THEN
    ALTER TABLE players ADD COLUMN botDifficulty VARCHAR(50);
  END IF;
END $$;

-- Update existing players to have usernames from users table
UPDATE players p 
SET username = u.username 
FROM users u 
WHERE p.userid = u.id;

-- Add username column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'players' AND column_name = 'username') THEN
    ALTER TABLE players ADD COLUMN username VARCHAR(255);
  END IF;
END $$;

-- Re-add foreign key constraint
ALTER TABLE players ADD CONSTRAINT players_userid_fkey
FOREIGN KEY (userid) REFERENCES users(id) ON DELETE CASCADE;