import { 
  GameState as SharedGameState, 
  Player as SharedPlayer, 
  Property as SharedProperty,
  Card,
  GamePhase,
  TradeProposal,
  AuctionState,
  GameAction,
  SpaceAction
} from '../../shared/types';

export interface GameData {
  gameId: number;
  currentUserId: number;
  currentPlayerId: number;
  gameState: SharedGameState;
  players: SharedPlayer[];
  properties: SharedProperty[];
}

export interface RollResponse {
  success: boolean;
  message: string;
  roll: number;
  dice: [number, number];
  isDoubles: boolean;
  gameState: SharedGameState;
  players: SharedPlayer[];
  newPosition?: number;
  spaceAction?: SpaceAction;
  actionMessage?: string;
}

export type { 
  SharedGameState as GameState,
  SharedPlayer as Player,
  SharedProperty as Property,
  Card,
  GamePhase,
  TradeProposal,
  AuctionState,
  GameAction,
  SpaceAction
}; 