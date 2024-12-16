import express, { Request, Response, Router } from 'express';
import { Pool } from 'pg';
import {
  GameState,
  Player,
  Property,
  SpaceAction,
  GameAction,
  Card,
  TradeProposal,
  AuctionState,
  RentPaymentResult,
  GameData,
  BotDecision,
  ExtendedBoardSpace,
  RollAction,
  PurchaseAction,
  PayRentAction,
  BankruptcyAction,
  JailAction,
  WebSocketMessage,
  Game
} from '../../shared/types';
import { gameService } from '../services/gameService';
import { cardService } from '../services/cardService';
import { botService } from '../services/botService';
import { gameHistoryService } from '../services/gameHistoryService';
import { gameWebSocket } from '../websocket/gameWebSocket';
import { requireAuth } from '../middleware/auth';

// Interface for database game response
interface DBGame {
  id: number;
  owner_id: number;
  status: 'waiting' | 'in-progress' | 'finished';
  createdat: Date;
  updatedat: Date;
  game_state: GameState;
}

// Convert Game type to DBGame type
const convertToDBGame = (game: Game | null): DBGame | null => {
  if (!game) return null;
  return {
    id: game.id,
    owner_id: game.ownerId,
    status: game.status,
    createdat: game.createdAt,
    updatedat: game.updatedAt,
    game_state: game.gameState
  };
};

const router: Router = express.Router();

// Helper functions for SpaceAction
const createSpaceAction = (type: string, message: string, data?: any): SpaceAction => ({
  type,
  message,
  data
});

// Route handlers with proper typing
router.get('/:gameId', requireAuth, async (req: Request<{ gameId: string }>, res: Response): Promise<void> => {
  const gameId = parseInt(req.params.gameId);
  console.log('\n=== Game Route Handler ===');
  console.log('Accessing game:', gameId);
  console.log('User:', (req as any).user);
  console.log('Session:', req.session);
  
  try {
    console.log('Fetching game data...');
    const gameResult = await gameService.getGameById(gameId);
    const game = convertToDBGame(gameResult);
    console.log('Game data:', JSON.stringify(game, null, 2));
    
    if (!game) {
      console.log('Game not found');
      res.status(404).send('Game not found');
      return;
    }

    console.log('Fetching players...');
    const players = await gameService.getGamePlayers(gameId);
    console.log('Players:', JSON.stringify(players, null, 2));
    
    console.log('Fetching properties...');
    const properties = await gameService.getGameProperties(gameId);
    console.log('Properties:', JSON.stringify(properties, null, 2));

    const typedSession = req.session as any;
    const currentPlayer = players.find(p => p.userId === typedSession.userId);
    const currentPlayerId = currentPlayer?.id || -1;
    console.log('Current player ID:', currentPlayerId);

    // Initialize default game state with proper structure
    const defaultGameState: GameState = {
      id: gameId,
      phase: 'waiting',
      currentPlayerId: currentPlayerId,
      currentPlayerIndex: 0,
      players: players,
      properties: properties,
      diceRolls: [],
      turnOrder: [],
      doublesCount: 0,
      jailTurns: {},
      bankruptPlayers: [],
      jailFreeCards: {},
      turnCount: 0,
      freeParkingPot: 0,
      lastRoll: undefined,
      lastDice: undefined,
      lastDoubles: undefined,
      lastPosition: undefined,
      drawnCard: undefined,
      currentPropertyDecision: undefined,
      currentRentOwed: undefined,
      winner: undefined,
      pendingTrades: [],
      auction: undefined,
      lastAction: undefined,
      lastActionTimestamp: undefined,
      gameLog: []
    };

    // Ensure game state has all required properties
    const gameState: GameState = {
      ...defaultGameState,
      ...(game.game_state || {}),
      currentPlayerId: game.game_state?.currentPlayerId || currentPlayerId,
      diceRolls: game.game_state?.diceRolls || [],
      players: players,
      properties: properties
    };

    // Update game state in database if needed
    if (JSON.stringify(gameState) !== JSON.stringify(game.game_state)) {
      await gameService.updateGameState(gameId, gameState);
      game.game_state = gameState;
    }

    // Validate game state before rendering
    console.log('Validating game state before render:', {
      phase: gameState.phase,
      diceRolls: gameState.diceRolls,
      players: players.length,
      currentPlayerId: currentPlayerId
    });

    // Ensure diceRolls is an array
    if (!Array.isArray(gameState.diceRolls)) {
      gameState.diceRolls = [];
    }

    console.log('Rendering game view...');
    res.render('game', {
      game,
      players,
      properties,
      currentUserId: typedSession.userId,
      currentPlayerId,
      gameState,
      username: typedSession.username
    });
    console.log('Game view rendered successfully');
  } catch (error) {
    console.error('Error in game route:', error);
    res.status(500).send('Server error');
  }
});

// Add a new route for getting game state via API
router.get('/:gameId/state', requireAuth, async (req: Request<{ gameId: string }>, res: Response): Promise<void> => {
  const gameId = parseInt(req.params.gameId);
  
  try {
    const gameResult = await gameService.getGameById(gameId);
    const game = convertToDBGame(gameResult);
    if (!game) {
      res.status(404).json({ error: 'Game not found' });
      return;
    }

    const players = await gameService.getGamePlayers(gameId);
    const properties = await gameService.getGameProperties(gameId);
    const typedSession = req.session as any;

    const gameData: GameData = {
      gameId,
      currentUserId: typedSession.userId || null,
      currentPlayerId: game.game_state.currentPlayerId || null,
      gameState: game.game_state,
      players,
      properties
    };

    res.json(gameData);
  } catch (error) {
    console.error('Error getting game:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

interface RollRequestBody {
  playerId: number;
}

router.post('/:gameId/roll', requireAuth, (req: Request<{ gameId: string }, any, RollRequestBody>, res: Response) => {
  const gameId = parseInt(req.params.gameId);
  const playerId = req.body.playerId;
  
  Promise.resolve().then(async () => {
    try {
      const rollResponse = await gameService.processRoll(gameId, playerId);

      const rollAction: RollAction = {
        type: 'ROLL',
        payload: {
          playerId,
          roll: rollResponse.dice
        }
      };

      await gameWebSocket.broadcastGameAction(gameId, rollAction);
      await broadcastGameState(gameId);

      res.json(rollResponse);
    } catch (error) {
      console.error('Error processing roll:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });
});

interface BuyRequestBody {
  playerId: string;
  propertyId: string;
}

router.post('/:gameId/buy', requireAuth, (req: Request<{ gameId: string }, any, BuyRequestBody>, res: Response) => {
  const gameId = parseInt(req.params.gameId);
  
  Promise.resolve().then(async () => {
    try {
      const playerId = parseInt(req.body.playerId);
      const propertyId = parseInt(req.body.propertyId);

      const property = await gameService.getPropertyByPosition(gameId, propertyId);
      const player = await gameService.getPlayerById(playerId);

      if (!property || !player) {
        return res.status(400).json({ error: 'Invalid property or player' });
      }

      if (player.money < property.price) {
        return res.status(400).json({ error: 'Insufficient funds' });
      }

      await gameService.updatePlayer(playerId, { money: player.money - property.price });
      await gameService.updateProperty(propertyId, { ownerId: playerId });

      const updatedPlayer = await gameService.getPlayerById(playerId);
      const updatedProperty = await gameService.getPropertyByPosition(gameId, propertyId);
      const gameState = await gameService.getGameState(gameId);

      const purchaseAction: PurchaseAction = {
        type: 'PURCHASE',
        payload: {
          playerId,
          propertyId
        }
      };

      await gameWebSocket.broadcastGameAction(gameId, purchaseAction);
      await broadcastGameState(gameId);

      res.json({
        success: true,
        player: updatedPlayer,
        property: updatedProperty,
        gameState
      });
    } catch (error) {
      console.error('Error buying property:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });
});

interface PayRentRequestBody {
  fromPlayerId: number;
  toPlayerId: number;
  amount: number;
}

router.post('/:gameId/pay-rent', requireAuth, (req: Request<{ gameId: string }, any, PayRentRequestBody>, res: Response) => {
  const gameId = parseInt(req.params.gameId);
  const { fromPlayerId, toPlayerId, amount } = req.body;

  Promise.resolve().then(async () => {
    try {
      const result = await gameService.payRent(gameService.pool, fromPlayerId, toPlayerId, amount);
      const gameState = await gameService.getGameState(gameId);

      const payRentAction: PayRentAction = {
        type: 'PAY_RENT',
        payload: {
          fromPlayerId,
          toPlayerId,
          amount
        }
      };

      await gameWebSocket.broadcastGameAction(gameId, payRentAction);
      await broadcastGameState(gameId);

      res.json({
        ...result,
        gameState
      });
    } catch (error) {
      console.error('Error paying rent:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });
});

// Helper function to broadcast game state update
const broadcastGameState = async (gameId: number): Promise<void> => {
  const [gameState, players, properties] = await Promise.all([
    gameService.getGameState(gameId),
    gameService.getGamePlayers(gameId),
    gameService.getGameProperties(gameId)
  ]);

  const message: WebSocketMessage = {
    type: 'state_update',
    players,
    properties
  };

  if (gameState) {
    message.state = gameState;
  }

  await gameWebSocket.broadcast(gameId, message);
};

export default router; 