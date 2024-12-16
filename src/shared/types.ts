export type GamePhase = 
  | 'waiting'
  | 'rolling'
  | 'property_decision'
  | 'paying_rent'
  | 'in_jail'
  | 'bankrupt'
  | 'game_over'
  | 'playing'
  | 'auction'
  | 'end_turn';

export type GameEventType = 
  | 'tax'
  | 'jail'
  | 'card'
  | 'build'
  | 'mortgage'
  | 'unmortgage'
  | 'roll'
  | 'purchase'
  | 'trade'
  | 'bankruptcy'
  | 'auction_bid'
  | 'trade_proposal'
  | 'pay_rent'
  | 'move_relative'
  | 'declare_bankruptcy';

export interface GameEvent {
  type: GameEventType;
  playerId: number;
  relatedPlayerId?: number;
  propertyId?: number;
  amount?: number;
  position?: number;
  description: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface Player {
  id: number;
  gameId: number;
  userId: number;
  username: string;
  position: number;
  money: number;
  balance: number;
  inJail: boolean;
  jailTurns: number;
  isBankrupt: boolean;
  turnOrder: number;
  isBot: boolean;
  botStrategy?: 'aggressive' | 'conservative' | 'balanced';
  botDifficulty?: 'easy' | 'medium' | 'hard';
  createdAt?: Date;
  updatedAt?: Date;
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
  colorGroup: string;
  ownerId: number | null;
  isMortgaged: boolean;
  houseCount: number;
  hasHotel: boolean;
  rentAmount?: number;
}

export interface GameState {
  id: number;
  phase: GamePhase;
  currentPlayerId: number;
  currentPlayerIndex: number;
  players: Player[];
  properties: Property[];
  diceRolls: PlayerWithRoll[];
  turnOrder: number[];
  doublesCount: number;
  jailTurns: Record<number, number>;
  bankruptPlayers: number[];
  jailFreeCards: Record<number, number>;
  turnCount: number;
  freeParkingPot: number;
  lastRoll?: number;
  lastDice?: [number, number];
  lastDoubles?: boolean;
  lastPosition?: number;
  drawnCard?: Card;
  currentPropertyDecision?: {
    propertyId: number;
    playerId: number;
    type: 'purchase' | 'auction';
  };
  currentRentOwed?: {
    amount: number;
    fromPlayerId: number;
    toPlayerId: number;
    propertyId: number;
  };
  winner?: number;
  pendingTrades?: TradeProposal[];
  auction?: AuctionState;
  lastAction?: string;
  lastActionTimestamp?: string;
  gameLog?: GameEvent[];
  dice_rolls?: { id: number; roll: number }[];
}

export interface PlayerWithRoll extends Player {
  roll?: number;
  dice?: [number, number];
  hasRolled?: boolean;
}

export interface TradeProposal {
  fromPlayerId: number;
  toPlayerId: number;
  offeredProperties: number[];
  requestedProperties: number[];
  offeredMoney: number;
  requestedMoney: number;
  id?: number;
  status?: 'pending' | 'accepted' | 'rejected';
  timestamp?: string;
}

export interface AuctionState {
  propertyId: number;
  currentBid: number;
  currentBidder: number | null;
  timeRemaining: number;
  startTime: string;
}

export type CardActionType = 
  | 'move'
  | 'move_to_nearest'
  | 'collect'
  | 'pay'
  | 'repairs'
  | 'collect_from_each'
  | 'jail'
  | 'jail_free'
  | 'move_relative';

export interface CardAction {
  type: CardActionType;
  destination?: number;
  propertyType?: 'railroad' | 'utility';
  value?: number;
  hotelValue?: number;
  collectFromEach?: number;
}

export interface Card {
  id?: number;
  type: 'chance' | 'community_chest';
  text: string;
  action: CardAction;
}

export interface BoardSpace {
  position: number;
  name: string;
  type: string;
  price?: number;
  rent?: number[];
  color?: string;
  action?: string;
  rentLevels?: number[];
  houseCost?: number;
  hotelCost?: number;
  mortgageValue?: number;
  colorGroup?: string;
}

export interface ExtendedBoardSpace {
  position: number;
  name: string;
  type: 'property' | 'railroad' | 'utility' | 'tax' | 'chest' | 'chance' | 'corner' | 'jail';
  price?: number;
  rentLevels?: number[];
  houseCost?: number;
  hotelCost?: number;
  mortgageValue?: number;
  colorGroup?: string;
  color?: string;
  rent?: number;
  buildings?: number;
  isMortgaged?: boolean;
  ownerId?: number | null;
}

export type GameAction = {
  type: string;
  payload: any;
};

export type RollAction = GameAction & {
  type: 'ROLL';
  payload: {
    playerId: number;
    roll: number[];
  };
};

export type PurchaseAction = GameAction & {
  type: 'PURCHASE';
  payload: {
    playerId: number;
    propertyId: number;
  };
};

export type PayRentAction = GameAction & {
  type: 'PAY_RENT';
  payload: {
    fromPlayerId: number;
    toPlayerId: number;
    amount: number;
  };
};

export type BankruptcyAction = GameAction & {
  type: 'BANKRUPTCY';
  payload: {
    playerId: number;
  };
};

export type JailAction = GameAction & {
  type: 'JAIL';
  payload: {
    playerId: number;
    inJail: boolean;
  };
};

export type SpaceAction = {
  type: string;
  message: string;
  data?: any;
  property?: Property;
  card?: Card;
  tax?: {
    name: string;
    amount: number;
  };
  amount?: number;
};

export interface RentPaymentResult {
  success: boolean;
  message: string;
  payerBalance: number;
  ownerBalance: number;
}

export interface GameData {
  gameId: number;
  currentUserId: number | null;
  currentPlayerId: number | null;
  gameState: GameState;
  players: Player[];
  properties: Property[];
}

export interface BotDecision {
  type: 'PASS' | 'BUY' | 'BID' | 'TRADE';
  playerId: number;
  action: string;
  data: Record<string, any>;
  property?: Property;
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
  timestamp: Date;
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

export interface WebSocketMessage {
  type: 'state_update' | 'player_action';
  state?: GameState;
  players?: Player[];
  properties?: Property[];
  action?: GameAction;
}

export interface Game {
  id: number;
  gameState: GameState;
  status: 'waiting' | 'in-progress' | 'finished';
  ownerId: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface RollResponse {
  success: boolean;
  message?: string;
  roll: number;
  dice: [number, number];
  isDoubles: boolean;
  newPosition: number;
  spaceAction?: SpaceAction;
  currentPlayer: Player;
  gameState?: GameState;
  players?: Player[];
}