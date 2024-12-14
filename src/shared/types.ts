export interface BoardSpace {
  id?: number;
  position: number;
  name: string;
  type: 'property' | 'railroad' | 'utility' | 'tax' | 'chance' | 'chest' | 'corner' | 'jail';
  price?: number;
  houseCost?: number;
  hotelCost?: number;
  rentLevels?: number[];
  colorGroup?: string;
  mortgageValue?: number;
  color?: string;
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
  type: 'purchase_available' | 'pay_rent' | 'card_drawn' | 'go_to_jail' | 'jail_action' | 'property_action';
  property?: Property | BoardSpace;
  propertyAction?: PropertyAction;
  card?: Card;
  message?: string;
  jailAction?: JailAction;
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
  gameId: number;
  position: number;
  name: string;
  type: 'property' | 'railroad' | 'utility';
  price: number;
  rentLevels: number[];
  houseCost: number;
  hotelCost: number;
  mortgageValue: number;
  isMortgaged: boolean;
  houseCount: number;
  hasHotel: boolean;
  colorGroup: string;
  ownerId: number | null;
  createdAt?: Date;
  updatedAt?: Date;
  rentAmount?: number;
  colorSet?: string[];
  newBalance?: number;
}

export interface PropertyAction {
  type: 'mortgage' | 'unmortgage' | 'build' | 'sell';
  propertyId: number;
  success?: boolean;
  message?: string;
  cost?: number;
}

export interface PropertySet {
  color: string;
  properties: Property[];
  completed: boolean;
  canBuildHouses: boolean;
}

export type GamePhase = 
  | 'waiting'
  | 'rolling'
  | 'property_decision'
  | 'paying_rent'
  | 'in_jail'
  | 'bankrupt'
  | 'game_over'
  | 'playing';

export interface GameState {
  phase: GamePhase;
  current_player_index: number;
  dice_rolls: PlayerWithRoll[];
  turn_order: number[];
  last_roll?: number;
  last_dice?: [number, number];
  last_doubles?: boolean;
  last_position?: number;
  drawn_card?: Card;
  jail_free_cards?: { [playerId: number]: number };
  doubles_count: number;
  jail_turns: { [playerId: number]: number };
  current_property_decision?: Property;
  current_rent_owed?: {
    amount: number;
    to: number;
    from: number;
    property: Property;
  };
  bankrupt_players: number[];
  winner?: number;
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
  inJail?: boolean;
  jailRoll?: boolean;
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

export interface JailAction {
  type: 'jail_action';
  action: 'pay_fine' | 'use_card' | 'roll_doubles';
  success?: boolean;
  message?: string;
}

export interface GameStateUpdate {
  type: 'state_update';
  state: GameState;
  message: string;
}

export interface GameAction {
  type: 'roll' | 'purchase' | 'pay_rent' | 'declare_bankruptcy' | 'end_turn';
  playerId: number;
  propertyId?: number;
  amount?: number;
} 