-- Add game state management
ALTER TABLE games ADD COLUMN IF NOT EXISTS game_state jsonb DEFAULT '{"phase": "waiting", "current_player_index": 0, "dice_rolls": [], "turn_order": []}'::jsonb;

-- Add turn order to players
ALTER TABLE players ADD COLUMN IF NOT EXISTS turn_order INTEGER; 