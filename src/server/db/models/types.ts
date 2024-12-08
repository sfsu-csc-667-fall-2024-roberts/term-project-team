export interface User {
  id: number;
  username: string;
  hashed_password: string;
  created_at: Date;
  updated_at: Date;
}

export interface Game {
  id: number;
  owner_id: number;
  status: 'waiting' | 'in-progress' | 'finished';
  created_at: Date;
  updated_at: Date;
}

export interface Player {
  id: number;
  game_id: number;
  user_id: number;
  balance: number;
  position: number;
  jailed: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface Property {
  id: number;
  game_id: number;
  name: string;
  owner_id: number | null;
  house_count: number;
  mortgaged: boolean;
  created_at: Date;
  updated_at: Date;
} 