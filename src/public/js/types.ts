import { GameState as SharedGameState, Player as SharedPlayer, Property as SharedProperty } from '../../shared/types';
import { io, Socket } from "socket.io-client";

export type GameState = SharedGameState;
export type Player = SharedPlayer;
export type Property = SharedProperty;

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
  playerBalance: number;
}

export interface ApiError {
  error: string;
}

declare global {
  interface Window {
    gameData: GameData;
    socket: Socket;
    roomId: number; //get from gameData.gameId 
  }
}
