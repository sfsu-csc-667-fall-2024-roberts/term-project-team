interface Player {
  id: number;
  user_id: number;
  username: string;
  balance: number;
  position: number;
  jailed: boolean;
}

interface Property {
  id: number;
  game_id: number;
  name: string;
  owner_id: number;
  position: number;
  house_count: number;
  mortgaged: boolean;
}

interface GameData {
  gameId: number;
  players: Player[];
  currentUserId: number;
  properties: Property[];
}

interface PurchaseResponse {
  success: boolean;
  property: Property;
  playerBalance: number;
}

interface ApiError {
  error: string;
}

declare global {
  interface Window {
    gameData: GameData;
  }
}

export type { GameData, PurchaseResponse, ApiError, Player, Property }; 