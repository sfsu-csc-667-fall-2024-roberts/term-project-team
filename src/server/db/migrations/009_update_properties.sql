-- Rename existing columns to match code if they exist
DO $$ 
BEGIN 
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'properties' AND column_name = 'mortgaged'
  ) THEN
    ALTER TABLE properties RENAME COLUMN mortgaged TO is_mortgaged;
  ELSE
    ALTER TABLE properties ADD COLUMN IF NOT EXISTS is_mortgaged BOOLEAN NOT NULL DEFAULT FALSE;
  END IF;
END $$;

-- Add new columns to properties table
ALTER TABLE properties ADD COLUMN IF NOT EXISTS type VARCHAR(50) NOT NULL DEFAULT 'property';
ALTER TABLE properties ADD COLUMN IF NOT EXISTS rent_levels INTEGER[] NOT NULL DEFAULT '{}';
ALTER TABLE properties ADD COLUMN IF NOT EXISTS color_group VARCHAR(50);
ALTER TABLE properties ADD COLUMN IF NOT EXISTS house_cost INTEGER;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS hotel_cost INTEGER;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS mortgage_value INTEGER;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS has_hotel BOOLEAN NOT NULL DEFAULT FALSE;

-- Add constraint to type column if it doesn't exist
DO $$ 
BEGIN 
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'valid_property_type'
  ) THEN
    ALTER TABLE properties ADD CONSTRAINT valid_property_type 
      CHECK (type IN ('property', 'railroad', 'utility'));
  END IF;
END $$;