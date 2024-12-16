-- Add game state management
ALTER TABLE games ADD COLUMN IF NOT EXISTS gameState jsonb DEFAULT '{"phase": "waiting", "currentPlayerIndex": 0, "diceRolls": [], "turnOrder": []}'::jsonb;

-- Add turn order to players
ALTER TABLE players ADD COLUMN IF NOT EXISTS turn_order INTEGER; 