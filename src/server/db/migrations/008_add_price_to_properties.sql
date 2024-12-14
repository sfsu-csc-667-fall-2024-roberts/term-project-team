-- Add price column to properties table
ALTER TABLE properties ADD COLUMN IF NOT EXISTS price INTEGER; 