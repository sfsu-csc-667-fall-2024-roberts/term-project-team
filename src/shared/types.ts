export interface BoardSpace {
  position: number;
  name: string;
  type: string;
  price?: number;
  houseCost?: number;
  rent?: number;
  rentLevels?: number[];
  colorGroup?: string;
  rentAmount?: number;
}

export interface Card {
  id: number;
  type: 'chance' | 'chest';
  text: string;
  action: {
    type: 'move' | 'move_nearest' | 'collect' | 'pay' | 'get_out_of_jail' | 'jail' | 'repair' | 'collect_from_players';
    destination?: number;
    value?: number;
    hotelValue?: number;
    propertyType?: 'utility' | 'railroad';
    collectFromEach?: number;
  };
}

export interface SpaceAction {
  type: 'purchase_available' | 'pay_rent' | 'card_drawn';
  property?: Property | BoardSpace;
  card?: Card;
  message?: string;
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
  playerId?: number;
  dice?: [number, number];
}

export interface Property {
  id: number;
  game_id: number;
  position: number;
  name: string;
  owner_id: number | null;
  house_count: number;
  mortgaged: boolean;
  price?: number;
  created_at: Date;
  updated_at: Date;
}

export interface GameState {
  phase: 'waiting' | 'playing';
  current_player_index: number;
  dice_rolls: PlayerWithRoll[];
  turn_order: number[];
  last_roll?: number;
  last_dice?: [number, number];
  last_doubles?: boolean;
  last_position?: number;
  drawn_card?: Card;
  jail_free_cards?: { [playerId: number]: number };
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
  dice: [number, number];
  isDoubles: boolean;
  gameState: GameState;
  newPosition?: number;
  players?: PlayerWithRoll[];
  currentPlayer?: PlayerWithRoll;
  spaceAction?: SpaceAction;
}

export interface GameData {
  gameId: number;
  currentUserId: number | null;
  currentPlayerId: number | null;
  players: Player[];
  properties: Property[];
  gameState: GameState;
}

export interface PurchaseResponse {
  success: boolean;
  property: Property;
  players: Player[];
  properties: Property[];
}

export interface ApiError {
  error: string;
} 