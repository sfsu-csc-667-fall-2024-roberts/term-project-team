import { GameState as SharedGameState, Player as SharedPlayer, Property as SharedProperty } from '../../shared/types';

export type GameState = SharedGameState;
export type Player = SharedPlayer;
export type Property = SharedProperty;

export interface GameData {
  gameId: number;
  currentUserId: number | null;
  currentPlayerId: number;
  players: Player[];
  properties: Property[];
  gameState: GameState;
}

export interface PurchaseResponse {
  success: boolean;
  property: Property;
  playerBalance: number;
}

export interface ApiError {
  error: string;
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
}

export interface SpaceAction {
  type: string;
  message: string;
  data?: any;
}

declare global {
  interface Window {
    monopolyGameData: GameData;
  }
}
 