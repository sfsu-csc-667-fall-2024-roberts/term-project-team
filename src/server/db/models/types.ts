import { Player, Property, GameState, Game } from '../../../shared/types';

export interface User {
  id: number;
  username: string;
  hashed_password: string;
  created_at: Date;
  updated_at: Date;
}

export { Player, Property, GameState, Game }; 