import { Player, Property, GameState, Game } from '../../../shared/types';

export interface User {
  id: number;
  username: string;
  hashed_password: string;
  createdAt: Date;
  updatedAt: Date;
}

export { Player, Property, GameState, Game }; 