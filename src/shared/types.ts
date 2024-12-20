import { Request } from 'express';

export type GamePhase = 'WAITING' | 'ROLL' | 'ACTION' | 'END_TURN' | 'GAME_OVER';

export type GameEventType = 
  | 'roll'
  | 'property_purchase'
  | 'go_to_jail'
  | 'bankruptcy'
  | 'phase_change'
  | 'property_mortgage'
  | 'property_unmortgage'
  | 'property_improvement'
  | 'pay_rent'
  | 'collect_from_bank'
  | 'pay_to_bank'
  | 'jail_release'
  | 'pass_go'
  | 'move'
  | 'buy'
  | 'collect'
  | 'pay'
  | 'jail'
  | 'win'
  | 'custom'
  | 'player_joined'
  | 'game_start';

export interface Player {
  id: number;
  username: string;
  money: number;
  position: number;
  isJailed: boolean;
  turnsInJail: number;
  isBankrupt: boolean;
  jailFreeCards: number;
  isBot?: boolean;
  botStrategy?: string;
  gameId?: number;
  color?: string;
  properties: Property[];
}

export type PropertyType = 'property' | 'railroad' | 'utility';
export type SpaceType = PropertyType | 'tax' | 'corner' | 'chance' | 'chest';
export type SpaceActionType = 
    | 'property'
    | 'card_drawn'
    | 'pay_tax'
    | 'corner'
    | 'tax'
    | 'card'
    | 'chance'
    | 'chest'
    | 'buy'
    | 'pay_rent'
    | 'go_to_jail'
    | 'none';

export interface Property {
  id: number;
  name: string;
  position: number;
  price: number;
  rent: number;
  ownerId: number | null;
  mortgaged: boolean;
  houseCount: number;
  hotelCount: number;
  colorGroup: string;
  type: 'property' | 'railroad' | 'utility';
  houseCost: number;
  hotelCost: number;
  rentLevels: number[];
  currentRent: number;
  canBeImproved: boolean;
  maxHouses: number;
  maxHotels: number;
  houses: number;
  hotels: number;
  gameId: number;
  color: string;
}

export interface GameState {
  id: number;
  players: Player[];
  properties: Property[];
  currentPlayerId: number;
  gamePhase: GamePhase;
  winner: number | null;
  doublesCount: number;
  turnCount: number;
  bankruptPlayers: number[];
  jailFreeCards: { [key: number]: number };
  gameLog: GameEvent[];
  turnOrder: number[];
  pendingTrades: Trade[];
  diceRoll?: number[];
  lastRoll?: number;
  lastDice?: [number, number];
  lastDoubles?: boolean;
  currentPropertyDecision?: PropertyDecision;
  currentRentOwed?: RentOwed;
}

export interface GameEvent {
  type: string;
  playerId?: number;
  description: string;
  timestamp?: number;
  metadata?: any;
  propertyId?: number;
  relatedPlayerId?: number;
  amount?: number;
  position?: number;
}

export interface Trade {
  id: number;
  fromPlayerId: number;
  toPlayerId: number;
  offeredProperties: number[];
  requestedProperties: number[];
  offeredMoney: number;
  requestedMoney: number;
  status: 'pending' | 'accepted' | 'rejected';
}

export interface PropertyDecision {
  propertyId: number;
  canBuy: boolean;
  mustPayRent: boolean;
  rentAmount?: number;
}

export interface RentOwed {
  amount: number;
  fromPlayerId: number;
  toPlayerId: number;
  propertyId: number;
}

export interface Card {
  type: 'chance' | 'chest' | 'move' | 'collect' | 'pay' | 'jail';
  text: string;
  destination?: number;
  amount?: number;
  action: CardAction;
}

export interface CardAction {
  type: 'move' | 'jail' | 'collect' | 'pay' | 'repair' | 'advance' | 'move_to_nearest' | 'move_relative' | 'collect_from_each' | 'jail_free' | 'repairs';
  destination?: number;
  amount?: number;
  value?: number | string;
  propertyType?: 'railroad' | 'utility';
  houseFee?: number;
  hotelFee?: number;
  collectFromEach?: number;
  goToJail?: boolean;
  message?: string;
}

export interface DiceRoll {
  id: number;
  roll: number;
  dice: [number, number];
  success?: boolean;
  message?: string;
  newPosition?: number;
  spaceAction?: SpaceAction;
}

export interface Game {
  id: number;
  state: GameState;
  status: 'waiting' | 'in-progress' | 'finished';
  ownerId: number;
  createdAt: number;
  updatedAt: number;
  maxPlayers?: number;
  minPlayers?: number;
  name?: string;
  password?: string;
  isPrivate?: boolean;
}

export interface BotDecision {
  type: 'PASS' | 'BUY' | 'BID' | 'TRADE';
  playerId: number;
  action: string;
  data: Record<string, any>;
  property?: Property;
  amount?: number;
  confidence?: number;
  reasoning?: string;
}

export interface PlayerWithRoll extends Player {
  roll?: number;
  dice?: [number, number];
}

export interface BoardSpace {
  position: number;
  name: string;
  type: SpaceType;
  price?: number;
  rent?: number;
  colorGroup?: string;
}

export interface ExtendedBoardSpace extends BoardSpace {
  rentLevels?: number[];
  houseCost?: number;
  hotelCost?: number;
  mortgageValue?: number;
  tax?: number;
  amount?: number;
  color?: string;
}

export interface GameStatistics {
  totalTurns: number;
  mostOwnedColor: string;
  highestRentPaid: number;
  mostVisitedProperty: string;
  longestGame: number;
  bankruptcyCount: number;
  tradingVolume: number;
  auctionsSold: number;
  players: PlayerStatistics[];
  trades: TradeStatistics[];
  properties: PropertyStatistics[];
}

export interface PlayerStatistics {
  playerId: number;
  username: string;
  totalMoney: number;
  propertiesOwned: number;
  rentCollected: number;
  rentPaid: number;
  passedGo: number;
  jailVisits: number;
}

export interface TradeStatistics {
  tradeId: number;
  fromPlayerId: number;
  toPlayerId: number;
  propertiesTraded: number;
  moneyExchanged: number;
  timestamp: number;
}

export interface PropertyStatistics {
  propertyId: number;
  name: string;
  timesLandedOn: number;
  rentCollected: number;
  ownershipChanges: number;
  housesBuilt: number;
  hotelsBuilt: number;
}

export interface SpaceAction {
  type: SpaceActionType;
  amount?: number;
  card?: any;
  action?: string;
}

export interface GameData {
  gameId: number;
  currentUserId: number;
  currentPlayerId: number;
  token: string;
  players: Player[];
  properties: Property[];
  gameState: GameState;
}

export interface AuthRequest extends Request {
  user?: {
    id: number;
    username: string;
    email: string;
  };
}

declare module 'express-session' {
  interface Session {
    token?: string;
    userId?: number;
    username?: string;
    returnTo?: string;
  }
}

export type WebSocketMessageType = 
    | 'roll'
    | 'roll_result'
    | 'end_turn'
    | 'buy_property'
    | 'pay_rent'
    | 'state_update'
    | 'error'
    | 'ping'
    | 'pong'
    | 'player_joined'
    | 'player_action'
    | 'sync_request'
    | 'draw_card'
    | 'pay_tax'
    | 'jail_action'
    | 'improve_property'
    | 'sell_improvement'
    | 'tax_due'
    | 'card_drawn'
    | 'JOIN_GAME'
    | 'game_action'
    | 'game_state_update'
    | 'game_error'
    | 'gameStateUpdate'
    | 'gameEvent'
    | 'diceRoll'
    | 'spaceAction'
    | 'request_game_state';

export interface WebSocketMessage {
    type: WebSocketMessageType;
    playerId: number;
    gameId?: number;
    payload: any;
    data?: {
        propertyId?: number;
        amount?: number;
        cardType?: 'chance' | 'community_chest';
        action?: string;
        [key: string]: any;
    };
}

export interface WebSocketError {
    type: 'error';
    error: string;
}

export interface WebSocketGameAction {
    type: 'game_action';
    gameId: number;
    action: string;
    data: {
        propertyId?: number;
        amount?: number;
        cardType?: 'chance' | 'community_chest';
        action?: string;
        [key: string]: any;
    };
}

export interface RollResponse {
  success: boolean;
  message?: string;
  roll?: number;
  dice?: [number, number];
  isDoubles?: boolean;
  gameState?: GameState;
  players?: Player[];
  spaceAction?: SpaceAction;
  currentPlayer?: Player;
  newPosition?: number;
}

export interface PurchaseResponse {
  success: boolean;
  property: Property;
  playerBalance: number;
}

export interface RentPaymentResult {
  success: boolean;
  message: string;
  payerBalance: number;
  ownerBalance: number;
}

export interface TradeProposal {
  id: number;
  fromPlayerId: number;
  toPlayerId: number;
  offeredProperties: number[];
  requestedProperties: number[];
  offeredMoney: number;
  requestedMoney: number;
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: number;
  timestamp?: number;
}

export interface MonopolyGameData {
    gameId: number;
    currentUserId: number;
    currentPlayerId: number;
    token: string;
    players: Player[];
    properties: Property[];
    gameState: GameState;
    game: GameInstance;
}

export interface GameInstance {
    startGame(): Promise<void>;
    initializeGame(): Promise<void>;
    fetchAndUpdateGameState(): Promise<void>;
}