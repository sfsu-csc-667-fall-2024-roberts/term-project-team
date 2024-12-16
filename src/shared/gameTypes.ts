import { GamePhase, Card, TradeProposal, GameEvent, Player, Property, GameState } from '../../shared/types';

export interface GameStateBase extends GameState {
  // Any server-specific extensions to GameState can go here
}

export interface DBGame {
  id: number;
  ownerId: number;
  status: 'waiting' | 'in-progress' | 'finished';
  gameState: GameStateBase;
  createdAt: Date;
  updatedAt: Date;
}

export interface PlayerWithRoll extends Player {
  roll?: number;
  dice?: [number, number];
  hasRolled?: boolean;
}

export { Player, Property }; 