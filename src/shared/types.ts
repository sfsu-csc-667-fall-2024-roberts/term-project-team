export interface GameState {
  phase: 'waiting' | 'playing';
  current_player_index: number;
  dice_rolls: Array<{ playerId: number; roll: number }>;
  turn_order: number[];
}

export interface Player {
  id: number;
  game_id: number;
  user_id: number | null;
  balance: number;
  position: number;
  jailed: boolean;
  is_bot: boolean;
  turn_order: number | null;
  username: string;
  bot_strategy?: 'aggressive' | 'conservative' | 'balanced';
  bot_difficulty?: 'easy' | 'medium' | 'hard';
  created_at: Date;
  updated_at: Date;
}

export interface PlayerWithRoll extends Player {
  roll?: number;
  hasRolled?: boolean;
}

export interface Property {
  id: number;
  game_id: number;
  position: number;
  name: string;
  owner_id: number | null;
  house_count: number;
  mortgaged: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface Game {
  id: number;
  owner_id: number;
  status: 'waiting' | 'in-progress' | 'finished';
  game_state: GameState;
  created_at: Date;
  updated_at: Date;
}

export interface RollResponse {
  roll: number;
  gameState: GameState;
  newPosition?: number;
  players?: PlayerWithRoll[];
  currentPlayer?: PlayerWithRoll;
}

export interface GameData {
  gameId: number;
  currentUserId: number | null;
  currentPlayerId: number | null;
  players: Player[];
  properties: Property[];
  gameState: GameState;
} 