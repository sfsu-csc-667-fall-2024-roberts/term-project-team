import { GameState as SharedGameState } from '../../shared/types';
import { io, Socket } from "socket.io-client";

export type GameState = SharedGameState;

export interface Player {
  id: number;
  user_id: number | null;
  username: string;
  balance: number;
  position: number;
  is_bot: boolean;
  bot_strategy?: 'aggressive' | 'conservative' | 'balanced';
  bot_difficulty?: 'easy' | 'medium' | 'hard';
}

export interface GameData {
  gameId: number;
  currentUserId: number | null;
  currentPlayerId: number | null;
  players: Player[];
  properties: Property[];
  gameState: GameState;
}

export interface Property {
  id: number;
  game_id: number;
  position: number;
  name: string;
  owner_id: number | null;
  house_count: number;
  mortgaged: boolean;
}

export interface PurchaseResponse {
  success: boolean;
  property: Property;
  playerBalance: number;
}

export interface ApiError {
  error: string;
}

declare global {
  interface Window {
    gameData: GameData;
    socket: Socket;
    roomId: number;
  }
}
 