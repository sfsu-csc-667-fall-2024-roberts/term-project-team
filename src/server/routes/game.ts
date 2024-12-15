import express, { Request, Response, Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { pool } from '../db/config';
import { getGame, getGamePlayers, getGameProperties, buyProperty, getPropertyByPosition, payRent } from '../db/services/dbService';
import { Game, Player } from '../db/models/types';
import { BOARD_SPACES } from '../../shared/boardData';
import { BotService } from '../services/botService';
import session from 'express-session';
import { CardActionService } from '../services/cardActionService';
import { RentCalculationService } from '../services/rentCalculationService';
import { Card, BoardSpace, GameState, GamePhase, GameAction, GameStateUpdate, JailAction, SpaceAction, Property } from '../../shared/types';
import * as dbService from '../db/services/dbService';

type TypedSession = session.Session & {
  userId?: number;
  username?: string;
  returnTo?: string;
};

const router: Router = express.Router();

const JAIL_POSITION = 10;
const JAIL_FINE = 50;
const MAX_JAIL_TURNS = 3;

// Move ExtendedBoardSpace interface to the top of the file
interface ExtendedBoardSpace extends BoardSpace {
  rentLevels?: number[];
  houseCost?: number;
  hotelCost?: number;
  mortgageValue?: number;
  colorGroup?: string;
  price?: number;
  type: 'property' | 'railroad' | 'utility' | 'tax' | 'corner' | 'chance' | 'chest';
}

// 1. First, let's define the DB property type to match the database schema
interface DBProperty {
  game_id: number;
  position: number;
  name: string;
  type: 'property' | 'railroad' | 'utility';
  price: number;
  rent_levels: number[];
  house_cost: number;
  hotel_cost: number;
  mortgage_value: number;
  color_group: string;
  owner_id: number | null;
  house_count: number;
  is_mortgaged: boolean;
  has_hotel: boolean;
}

function handleJailTurn(gameState: GameState, playerId: number, dice: [number, number]): JailAction {
  const jailTurns = gameState.jail_turns[playerId] || 0;
  const isDoubles = dice[0] === dice[1];
  
  if (isDoubles) {
    gameState.jail_turns[playerId] = 0;
    return {
      type: 'jail_action',
      action: 'roll_doubles',
      success: true,
      message: 'Rolled doubles! You are free from jail!'
    };
  }
  
  if (jailTurns >= MAX_JAIL_TURNS - 1) {
    // Force payment on third turn
    gameState.jail_turns[playerId] = 0;
    // TODO: Deduct money from player
    return {
      type: 'jail_action',
      action: 'pay_fine',
      success: true,
      message: `Forced to pay ${JAIL_FINE}$ fine after three turns.`
    };
  }
  
  gameState.jail_turns[playerId] = jailTurns + 1;
  return {
    type: 'jail_action',
    action: 'roll_doubles',
    success: false,
    message: `Failed to roll doubles. ${MAX_JAIL_TURNS - (jailTurns + 1)} turns remaining in jail.`
  };
}

function isInJail(gameState: GameState, playerId: number): boolean {
  return (gameState.jail_turns[playerId] || 0) > 0;
}

async function updatePropertyState(propertyId: number, updates: Partial<DBProperty>) {
  const updateFields = [];
  const values = [];
  let paramCount = 1;

  if (updates.is_mortgaged !== undefined) {
    updateFields.push(`is_mortgaged = $${paramCount}`);
    values.push(updates.is_mortgaged);
    paramCount++;
  }

  if (updates.owner_id !== undefined) {
    updateFields.push(`owner_id = $${paramCount}`);
    values.push(updates.owner_id);
    paramCount++;
  }

  if (updates.house_count !== undefined) {
    updateFields.push(`house_count = $${paramCount}`);
    values.push(updates.house_count);
    paramCount++;
  }

  if (updateFields.length === 0) return;

  values.push(propertyId);
  const query = `
    UPDATE properties 
    SET ${updateFields.join(', ')} 
    WHERE id = $${paramCount}
  `;

  await pool.query(query, values);
}

// GET /:id/state - Get game state as JSON
router.get('/:id/state', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    console.log('Getting game state for game:', req.params.id);
    const gameId = parseInt(req.params.id);
    if (isNaN(gameId)) {
      console.error('Invalid game ID:', req.params.id);
      res.status(400).json({ error: 'Invalid game ID' });
      return;
    }

    const typedSession = req.session as TypedSession;
    const userId = typedSession.userId;

    if (!userId) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const game = await getGame(gameId);
    if (!game) {
      console.error('Game not found:', gameId);
      res.status(404).json({ error: 'Game not found' });
      return;
    }

    const [players, properties] = await Promise.all([
      getGamePlayers(gameId),
      getGameProperties(gameId)
    ]);

    const currentPlayer = players.find(p => p.user_id === userId);
    if (!currentPlayer) {
      res.status(403).json({ error: 'Not in game' });
      return;
    }

    // Initialize game state if it doesn't exist
    let gameState: GameState = game.game_state || {
      phase: 'waiting',
      current_player_index: 0,
      dice_rolls: [],
      turn_order: [],
      doubles_count: 0,
      jail_turns: {},
      bankrupt_players: []
    };

    // Ensure game state has all required properties
    gameState = {
      phase: gameState.phase || 'waiting',
      current_player_index: typeof gameState.current_player_index === 'number' ? gameState.current_player_index : 0,
      dice_rolls: Array.isArray(gameState.dice_rolls) ? gameState.dice_rolls : [],
      turn_order: Array.isArray(gameState.turn_order) ? gameState.turn_order : [],
      doubles_count: gameState.doubles_count || 0,
      jail_turns: gameState.jail_turns || {},
      bankrupt_players: gameState.bankrupt_players || [],
      last_roll: gameState.last_roll,
      last_dice: gameState.last_dice,
      last_doubles: gameState.last_doubles,
      last_position: gameState.last_position,
      drawn_card: gameState.drawn_card,
      jail_free_cards: gameState.jail_free_cards || {},
      current_property_decision: gameState.current_property_decision,
      current_rent_owed: gameState.current_rent_owed,
      winner: gameState.winner
    };

    res.json({
      gameId,
      currentUserId: userId,
      currentPlayerId: currentPlayer.id,
      players,
      properties,
      gameState
    });
  } catch (error) {
    console.error('Game state error:', error);
    res.status(500).json({ error: 'Failed to get game state' });
  }
});

// GET /:id - Show game page
router.get('/:id', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const gameId = parseInt(req.params.id);
    if (isNaN(gameId)) {
      console.error('Invalid game ID:', req.params.id);
      res.redirect('/lobby?error=invalid-game');
      return;
    }

    const typedSession = req.session as TypedSession;
    const userId = typedSession.userId;

    if (!userId) {
      res.redirect('/login');
      return;
    }

    const game = await getGame(gameId);
    if (!game) {
      res.redirect('/lobby?error=game-not-found');
      return;
    }

    const [players, properties] = await Promise.all([
      getGamePlayers(gameId),
      getGameProperties(gameId)
    ]);

    const currentPlayer = players.find(p => p.user_id === userId);
    if (!currentPlayer) {
      res.redirect('/lobby?error=not-in-game');
      return;
    }

    // Sort players: humans first, then bots
    const sortedPlayers = [...players].sort((a: Player, b: Player) => {
      if (a.is_bot === b.is_bot) return 0;
      return a.is_bot ? 1 : -1;
    });

    // Initialize game state if it doesn't exist
    let gameState = game.game_state || {
      phase: 'waiting',
      current_player_index: 0,
      dice_rolls: [],
      turn_order: [],
      doubles_count: 0,
      jail_turns: {},
      bankrupt_players: []
    };

    // Ensure game state has all required properties
    gameState = {
      phase: gameState.phase || 'waiting',
      current_player_index: typeof gameState.current_player_index === 'number' ? gameState.current_player_index : 0,
      dice_rolls: Array.isArray(gameState.dice_rolls) ? gameState.dice_rolls : [],
      turn_order: Array.isArray(gameState.turn_order) ? gameState.turn_order : [],
      doubles_count: gameState.doubles_count || 0,
      jail_turns: gameState.jail_turns || {},
      bankrupt_players: gameState.bankrupt_players || [],
      last_roll: gameState.last_roll,
      last_dice: gameState.last_dice,
      last_doubles: gameState.last_doubles,
      last_position: gameState.last_position,
      drawn_card: gameState.drawn_card,
      jail_free_cards: gameState.jail_free_cards || {},
      current_property_decision: gameState.current_property_decision,
      current_rent_owed: gameState.current_rent_owed,
      winner: gameState.winner
    };

    console.log('Rendering game view:', {
      gameId,
      userId,
      currentPlayerId: currentPlayer.id,
      playerCount: sortedPlayers.length,
      gameState
    });

    res.render('game', {
      game,
      players: sortedPlayers,
      properties,
      currentUserId: userId,
      currentPlayerId: currentPlayer.id,
      gameState,
      username: typedSession.username
    });
  } catch (error) {
    console.error('Game view error:', error);
    res.redirect('/lobby?error=game-error');
  }
});

// POST /:id/roll - Handle dice roll
router.post('/:id/roll', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    currentGameId = parseInt(req.params.id);
    const typedSession = req.session as TypedSession;
    const userId = typedSession.userId!;
    const botId = req.body.botId ? parseInt(req.body.botId) : undefined;

    // Get game and validate
    const game = await getGame(currentGameId);
    if (!game) {
      res.status(404).json({ error: 'Game not found' });
      return;
    }

    // Get current player
    const players = await getGamePlayers(currentGameId);
    let currentPlayer;
    
    if (botId) {
      // If botId provided, get the bot player
      currentPlayer = players.find(p => p.id === botId && p.is_bot);
      if (!currentPlayer) {
        res.status(404).json({ error: 'Bot not found' });
        return;
      }
    } else {
      // Otherwise get the human player
      currentPlayer = players.find(p => p.user_id === userId);
      if (!currentPlayer) {
        res.status(403).json({ error: 'Not in game' });
        return;
      }
    }

    let gameState = game.game_state;

    // Check if it's the player's turn
    if (gameState.phase === 'playing' && gameState.turn_order[gameState.current_player_index] !== currentPlayer.id) {
      res.status(400).json({ error: 'Not your turn' });
      return;
    }

    // Check if player has already rolled this turn
    if (gameState.phase === 'playing' && gameState.last_roll !== undefined) {
      res.status(400).json({ error: 'You have already rolled this turn' });
      return;
    }

    // Generate roll
    const dice1 = Math.floor(Math.random() * 6) + 1;
    const dice2 = Math.floor(Math.random() * 6) + 1;
    const totalRoll = dice1 + dice2;
    const isDoubles = dice1 === dice2;
    
    console.log(`Player ${currentPlayer.username} rolled a ${totalRoll}`);

    if (gameState.phase === 'waiting') {
      // Check if player has already rolled
      const hasRolled = gameState.dice_rolls.some(r => r.id === currentPlayer.id);
      if (hasRolled) {
        res.status(400).json({ error: 'Already rolled for turn order' });
        return;
      }

      // Add roll to initial rolls
      gameState.dice_rolls.push({
        ...currentPlayer,
        roll: totalRoll,
        dice: [dice1, dice2],
        hasRolled: true
      });

      // Check if all players have rolled
      if (gameState.dice_rolls.length === players.length) {
        // Sort players by roll value (descending) to determine turn order
        const sortedRolls = [...gameState.dice_rolls].sort((a, b) => {
          const rollA = a.roll || 0;
          const rollB = b.roll || 0;
          return rollB - rollA;
        });
        
        // Check for ties
        const tiedRolls = new Map<number, number[]>();
        sortedRolls.forEach((roll) => {
          const rollValue = roll.roll || 0;
          if (!tiedRolls.has(rollValue)) {
            tiedRolls.set(rollValue, []);
          }
          tiedRolls.get(rollValue)?.push(roll.id);
        });

        // If there are ties, reset rolls for tied players and keep phase as waiting
        let hasTies = false;
        tiedRolls.forEach((playerIds, rollValue) => {
          if (playerIds.length > 1) {
            hasTies = true;
            console.log(`Tie detected for roll ${rollValue} between players:`, playerIds);
            // Reset rolls for tied players
            gameState.dice_rolls = gameState.dice_rolls.filter(roll => 
              !playerIds.includes(roll.id)
            );
          }
        });

        if (!hasTies) {
          // No ties, proceed with turn order
          gameState.turn_order = sortedRolls.map(roll => roll.id);
          gameState.phase = 'playing';
          console.log('All players have rolled. Turn order:', gameState.turn_order);
        } else {
          console.log('Ties detected, players need to reroll');
        }
      }

      // Update game state
      await client.query('UPDATE games SET game_state = $1 WHERE id = $2', [gameState, currentGameId]);
      
      await client.query('COMMIT');
      res.json({ roll: totalRoll, dice: [dice1, dice2], isDoubles, gameState, players });
    } else if (gameState.phase === 'playing') {
      // Get current position before moving
      const oldPosition = currentPlayer.position;
      
      // Calculate new position
      const newPosition = (currentPlayer.position + totalRoll) % 40;

      // Check if passed GO (player moved from higher number to lower number, excluding jail movement)
      if (newPosition < oldPosition && !isDoubles) {
        // Award $200 for passing GO
        await client.query(
          'UPDATE players SET balance = balance + $1 WHERE id = $2',
          [200, currentPlayer.id]
        );
        console.log(`Player ${currentPlayer.username} passed GO, awarded $200`);
      }

      // Update player position in database
      await client.query(
        'UPDATE players SET position = $1 WHERE id = $2',
        [newPosition, currentPlayer.id]
      );

      // Get updated player data
      let updatedPlayers = await getGamePlayers(currentGameId);
      let updatedCurrentPlayer = updatedPlayers.find(p => p.id === currentPlayer.id);

      if (!updatedCurrentPlayer) {
        throw new Error('Player not found after update');
      }

      // Get the space type and check for property actions
      const spaceData = BOARD_SPACES.find(space => space.position === newPosition);
      let spaceAction = null;

      console.log('\n=== Processing Roll and Space ===');
      console.log('Roll details:', {
        playerId: currentPlayer.id,
        playerName: currentPlayer.username,
        fromPosition: currentPlayer.position,
        toPosition: newPosition,
        dice1,
        dice2,
        totalRoll,
        isDoubles
      });

      console.log('Space details:', { 
        position: newPosition, 
        spaceData,
        spaceType: spaceData?.type,
        spacePrice: spaceData?.price,
        spaceName: spaceData?.name,
        currentPlayerId: currentPlayer.id,
        currentPlayerBalance: currentPlayer.balance
      });

      if (spaceData) {
        if (spaceData.type === 'chance' || spaceData.type === 'chest') {
          // Create card action service
          const cardService = new CardActionService(
            currentGameId,
            updatedPlayers,
            gameState,
            await getGameProperties(currentGameId)
          );
          
          // Draw a card
          const card = spaceData.type === 'chance' ? drawChanceCard() : drawCommunityChestCard();
          gameState.drawn_card = card;
          
          // Execute card action
          const actionResult = await cardService.executeCardAction(card, updatedCurrentPlayer);
          
          // Update game state with action results
          gameState = actionResult.gameState;
          updatedPlayers = actionResult.players;
          
          // Create space action for UI
          spaceAction = {
            type: 'card_drawn',
            card,
            message: actionResult.message
          };
          
          console.log('Card action executed:', {
            cardType: spaceData.type,
            card,
            result: actionResult
          });
        } else if (spaceData.type === 'tax') {
          // Handle tax spaces
          const taxAmount = spaceData.price || 0;
          
          // Deduct tax from player
          await client.query(
            'UPDATE players SET balance = balance - $1 WHERE id = $2',
            [taxAmount, currentPlayer.id]
          );

          // Get updated player data
          updatedPlayers = await getGamePlayers(currentGameId);
          updatedCurrentPlayer = updatedPlayers.find(p => p.id === currentPlayer.id);

          spaceAction = {
            type: 'pay_tax',
            tax: {
              name: spaceData.name,
              amount: taxAmount
            }
          };

          console.log('Created tax action:', spaceAction);
        } else if (spaceData.type === 'property' || spaceData.type === 'railroad' || spaceData.type === 'utility') {
          // Check if property exists and is unowned
          const property = await getPropertyByPosition(currentGameId, newPosition);
          console.log('Property database state:', { 
            property,
            exists: !!property,
            isOwned: !!property?.ownerId,
            ownerInfo: property?.ownerId ? 'Owned' : 'Unowned',
            propertyPrice: property?.price || spaceData.price,
            spaceType: spaceData.type,
            canAfford: currentPlayer.balance >= (property?.price || spaceData.price || 0)
          });
          
          // Property exists and is unowned
          if (property && !property.ownerId) {
            spaceAction = {
              type: 'purchase_available',
              property: {
                ...spaceData,
                price: spaceData.price,
                position: newPosition,
                name: spaceData.name,
                type: spaceData.type
              }
            };
            console.log('Creating purchase action:', spaceAction);
          } else if (property && property.ownerId && property.ownerId !== currentPlayer.id) {
            // Property is owned by another player - need to pay rent
            const rentService = new RentCalculationService(await getGameProperties(currentGameId), updatedPlayers);
            let rentAmount = rentService.calculateRent(property);
            
            // Process rent payment
            const rentResult = await dbService.processRentPayment(
              currentGameId,
              currentPlayer.id,
              property.ownerId!,
              rentAmount
            );

            // Update game state
            gameState.current_rent_owed = {
              amount: rentAmount,
              from: currentPlayer.id,
              to: property.ownerId,
              property
            };

            // Update player balances
            currentPlayer.balance = rentResult.payerBalance;
            const owner = updatedPlayers.find(p => p.id === property.ownerId);
            if (owner) {
              owner.balance = rentResult.ownerBalance;
            }

            // Update UI message
            spaceAction = {
              type: 'pay_rent',
              property,
              message: `Paid $${rentAmount} rent to ${owner?.username || 'owner'}`
            };
          } else if (!property) {
            // Property doesn't exist in database, create it
            console.log('Creating new property in database:', {
              position: newPosition,
              spaceData
            });

            try {
              const newProperty = await dbService.createProperty(currentGameId, {
                position: newPosition,
                name: spaceData.name,
                type: spaceData.type as 'property' | 'railroad' | 'utility',
                price: spaceData.price || 0,
                rentLevels: spaceData.rentLevels || [],
                houseCost: spaceData.houseCost || 0,
                hotelCost: spaceData.hotelCost || 0,
                mortgageValue: spaceData.mortgageValue || 0,
                colorGroup: spaceData.colorGroup || '',
                ownerId: null,
                houseCount: 0,
                isMortgaged: false,
                hasHotel: false
              });

              spaceAction = {
                type: 'purchase_available',
                property: newProperty
              };
            } catch (error) {
              console.error('Error creating property:', error);
              spaceAction = { type: 'property_action' };
            }
          }
        }
      }

      // Update game state with new position
      gameState.last_roll = totalRoll;
      gameState.last_dice = [dice1, dice2];
      gameState.last_doubles = isDoubles;
      gameState.last_position = newPosition;
      await client.query('UPDATE games SET game_state = $1 WHERE id = $2', [gameState, currentGameId]);

      // Get final updated data
      updatedPlayers = await getGamePlayers(currentGameId);
      updatedCurrentPlayer = updatedPlayers.find(p => p.id === currentPlayer.id);

      if (!updatedCurrentPlayer) {
        throw new Error('Player not found after final update');
      }

      const response = {
        roll: totalRoll,
        dice: [dice1, dice2],
        isDoubles,
        gameState,
        newPosition,
        spaceAction,
        currentPlayer: updatedCurrentPlayer,
        players: updatedPlayers
      };

      console.log('=== Roll Response ===');
      console.log(response);

      await client.query('COMMIT');
      res.json(response);
    }
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Roll error:', error);
    res.status(500).json({ error: 'Failed to process roll' });
  } finally {
    client.release();
  }
});

// POST /:id/bot/:botId/action - Handle bot actions
router.post('/:id/bot/:botId/action', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const gameId = parseInt(req.params.id);
    const botId = parseInt(req.params.botId);
    const typedSession = req.session as TypedSession;
    const userId = typedSession.userId!;

    // Get game and validate
    const game = await getGame(gameId);
    if (!game) {
      res.status(404).json({ error: 'Game not found' });
      return;
    }

    // Get players
    const players = await getGamePlayers(gameId);
    const bot = players.find(p => p.id === botId && p.is_bot);
    const requestingPlayer = players.find(p => p.user_id === userId);

    if (!bot || !bot.is_bot) {
      res.status(404).json({ error: 'Bot not found' });
      return;
    }

    if (!requestingPlayer) {
      res.status(403).json({ error: 'Not in game' });
      return;
    }

    // Get current property if any
    const currentProperty = await getPropertyByPosition(gameId, bot.position);
    const properties = await getGameProperties(gameId);

    // Get bot's decision
    const decision = await BotService.makeDecision(bot, game.game_state, currentProperty, properties);
    console.log(`Bot ${bot.username} decision:`, decision);

    let success = false;
    let message = '';

    // Execute bot's decision
    switch (decision.action) {
      case 'buy':
        if (decision.property) {
          try {
            await buyProperty(gameId, decision.property.position, bot.id);
            success = true;
            message = 'Property purchased';
          } catch (error) {
            success = false;
            message = 'Failed to buy property';
            console.error('Bot purchase error:', error);
          }
        }
        break;
      case 'pay_rent':
        if (decision.property) {
          try {
            await payRent(gameId, bot.id, decision.property.position);
            success = true;
            message = 'Rent paid';
          } catch (error) {
            success = false;
            message = 'Failed to pay rent';
          }
        }
        break;
      case 'end_turn':
        success = true;
        message = 'Turn ended';
        break;
      default:
        success = true;
        message = 'No action taken';
    }

    // Get updated game state
    const updatedGame = await getGame(gameId);
    const updatedPlayers = await getGamePlayers(gameId);

    if (!updatedGame) {
      throw new Error('Game not found after update');
    }

    await client.query('COMMIT');
    res.json({ 
      success, 
      message, 
      gameState: updatedGame.game_state,
      players: updatedPlayers
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Bot action error:', error);
    res.status(400).json({ error: error instanceof Error ? error.message : 'Failed to execute bot action' });
  } finally {
    client.release();
  }
});

// POST /:id/end-turn - End current player's turn
router.post('/:id/end-turn', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const gameId = parseInt(req.params.id);
    const playerId = parseInt(req.body.playerId);
    const typedSession = req.session as TypedSession;
    const userId = typedSession.userId!;

    // Get game and validate
    const game = await getGame(gameId);
    if (!game) {
      res.status(404).json({ error: 'Game not found' });
      return;
    }

    // Get players
    const players = await getGamePlayers(gameId);
    const currentPlayer = players.find(p => p.id === playerId);
    const requestingPlayer = players.find(p => p.user_id === userId);

    if (!currentPlayer) {
      res.status(404).json({ error: 'Player not found' });
      return;
    }

    // If it's a bot turn, allow any player in the game to end it
    // If it's a human turn, only allow that player to end it
    if (!currentPlayer.is_bot && (!requestingPlayer || requestingPlayer.id !== currentPlayer.id)) {
      res.status(403).json({ error: 'Not authorized to end turn' });
      return;
    }

    // Get game state
    let gameState = game.game_state;
    if (!gameState || !gameState.turn_order || !Array.isArray(gameState.turn_order)) {
      res.status(400).json({ error: 'Invalid game state' });
      return;
    }

    // Validate it's the player's turn
    if (gameState.turn_order[gameState.current_player_index] !== playerId) {
      res.status(400).json({ error: 'Not your turn' });
      return;
    }

    // Move to next player
    gameState.current_player_index = (gameState.current_player_index + 1) % gameState.turn_order.length;
    // Clear last roll when ending turn
    delete gameState.last_roll;
    delete gameState.last_position;

    // Update game state
    await client.query('UPDATE games SET game_state = $1 WHERE id = $2', [gameState, gameId]);

    // Get updated players
    const updatedPlayers = await getGamePlayers(gameId);

    await client.query('COMMIT');
    res.json({ 
      success: true,
      gameState,
      players: updatedPlayers,
      nextPlayerId: gameState.turn_order[gameState.current_player_index]
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('End turn error:', error);
    res.status(500).json({ error: 'Failed to end turn' });
  } finally {
    client.release();
  }
});

// Define the property purchase response type
interface PropertyPurchaseResponse {
  success: boolean;
  property: Property;
  player: Player;
  error?: string;
}

// Remove duplicate routes and keep only one clean implementation
router.post('/:id/property/buy', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const gameId = parseInt(req.params.id);
    const { position } = req.body;
    const typedSession = req.session as TypedSession;
    const userId = typedSession.userId;

    if (!userId) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    // Get current player
    const players = await getGamePlayers(gameId);
    const currentPlayer = players.find(p => p.user_id === userId);
    if (!currentPlayer) {
      res.status(403).json({ error: 'Not in game' });
      return;
    }

    // Get game and validate
    const game = await getGame(gameId);
    if (!game) {
      res.status(404).json({ error: 'Game not found' });
      return;
    }

    // Validate it's the player's turn
    const gameState = game.game_state;
    if (gameState.turn_order[gameState.current_player_index] !== currentPlayer.id) {
      res.status(400).json({ error: 'Not your turn' });
      return;
    }

    // Get property
    const property = await getPropertyByPosition(gameId, position);
    if (!property) {
      res.status(404).json({ error: 'Property not found' });
      return;
    }

    // Validate property is available
    if (property.ownerId !== null) {
      res.status(400).json({ error: 'Property already owned' });
      return;
    }

    // Validate player can afford it
    if (currentPlayer.balance < property.price) {
      res.status(400).json({ error: 'Insufficient funds' });
      return;
    }

    // Validate player is on the property
    if (currentPlayer.position !== position) {
      res.status(400).json({ error: 'Must be on property to purchase' });
      return;
    }

    // Perform purchase
    const result = await buyProperty(gameId, currentPlayer.id, position);
    
    // Get updated state
    const [updatedPlayers, updatedProperties] = await Promise.all([
      getGamePlayers(gameId),
      getGameProperties(gameId)
    ]);

    const updatedPlayer = updatedPlayers.find(p => p.id === currentPlayer.id);
    const updatedProperty = updatedProperties.find(p => p.position === position);

    if (!updatedPlayer || !updatedProperty) {
      throw new Error('Failed to get updated state after purchase');
    }

    await client.query('COMMIT');
    res.json({
      success: true,
      property: updatedProperty,
      player: updatedPlayer
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Property purchase error:', error);
    res.status(500).json({ error: 'Failed to purchase property' });
  } finally {
    client.release();
  }
});

// POST /:id/property/build - Build a house or hotel
router.post('/:id/property/build', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const gameId = parseInt(req.params.id);
    const { propertyId, buildType } = req.body;
    const typedSession = req.session as TypedSession;
    const userId = typedSession.userId;

    if (!userId) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    // Get current player
    const players = await getGamePlayers(gameId);
    const currentPlayer = players.find(p => p.user_id === userId);
    if (!currentPlayer) {
      res.status(403).json({ error: 'Not in game' });
      return;
    }

    // Get game and validate
    const game = await getGame(gameId);
    if (!game) {
      res.status(404).json({ error: 'Game not found' });
      return;
    }

    // Get property
    const properties = await getGameProperties(gameId);
    const property = properties.find(p => p.id === propertyId);
    if (!property) {
      res.status(404).json({ error: 'Property not found' });
      return;
    }

    // Validate ownership
    if (property.ownerId !== currentPlayer.id) {
      res.status(403).json({ error: 'You do not own this property' });
      return;
    }

    // Get building cost from board data
    const spaceData = BOARD_SPACES[property.position] as BoardSpace;
    if (!spaceData || !spaceData.houseCost) {
      res.status(400).json({ error: 'Invalid property or building cost not defined' });
      return;
    }

    // Calculate building cost based on type
    const buildingCost = buildType === 'hotel' ? 
      (spaceData.hotelCost || spaceData.houseCost * 5) : // Hotel costs 5x house cost if not specified
      spaceData.houseCost;

    // Create rent service to validate building
    const rentService = new RentCalculationService(properties, players);

    // Check if building is allowed
    if (buildType === 'hotel') {
      if (!rentService.canBuildHotel(property)) {
        res.status(400).json({ error: 'Cannot build hotel on this property' });
        return;
      }
    } else if (buildType === 'house') {
      if (!rentService.canBuildHouse(property)) {
        res.status(400).json({ error: 'Cannot build house on this property' });
        return;
      }
    } else {
      res.status(400).json({ error: 'Invalid build type' });
      return;
    }

    // Check if player can afford it
    if (currentPlayer.balance < buildingCost) {
      res.status(400).json({ 
        error: 'Insufficient funds', 
        required: buildingCost,
        balance: currentPlayer.balance
      });
      return;
    }

    // Update property
    await client.query(
      'UPDATE properties SET house_count = $1 WHERE id = $2',
      [buildType === 'hotel' ? 5 : property.houseCount + 1, propertyId]
    );

    // Deduct cost from player
    await client.query(
      'UPDATE players SET balance = balance - $1 WHERE id = $2',
      [buildingCost, currentPlayer.id]
    );

    // Get updated data
    const updatedPlayers = await getGamePlayers(gameId);
    const updatedProperties = await getGameProperties(gameId);

    await client.query('COMMIT');
    res.json({
      success: true,
      players: updatedPlayers,
      properties: updatedProperties,
      buildType,
      property: updatedProperties.find(p => p.id === propertyId)
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Build error:', error);
    res.status(500).json({ error: 'Failed to build' });
  } finally {
    client.release();
  }
});

// POST /:id/property/mortgage - Mortgage or unmortgage a property
router.post('/:id/property/mortgage', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const gameId = parseInt(req.params.id);
    const { propertyId, action } = req.body; // action can be 'mortgage' or 'unmortgage'
    const typedSession = req.session as TypedSession;
    const userId = typedSession.userId;

    console.log('Processing property mortgage action:', {
      gameId,
      propertyId,
      action,
      userId
    });

    if (!userId) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    // Get current player
    const players = await getGamePlayers(gameId);
    const currentPlayer = players.find(p => p.user_id === userId);
    if (!currentPlayer) {
      res.status(403).json({ error: 'Not in game' });
      return;
    }

    // Get property
    const properties = await getGameProperties(gameId);
    const property = properties.find(p => p.id === propertyId);
    if (!property) {
      res.status(404).json({ error: 'Property not found' });
      return;
    }

    // Validate ownership
    if (property.ownerId !== currentPlayer.id) {
      res.status(403).json({ error: 'You do not own this property' });
      return;
    }

    // Cannot mortgage property with houses
    if (property.houseCount > 0) {
      res.status(400).json({ error: 'Cannot mortgage property with houses. Sell houses first.' });
      return;
    }

    // Get property data from board spaces
    const spaceData = BOARD_SPACES.find(space => space.position === property.position);
    if (!spaceData || !spaceData.price) {
      res.status(400).json({ error: 'Invalid property data' });
      return;
    }

    const mortgageValue = Math.floor(spaceData.price / 2);

    if (action === 'mortgage') {
      if (property.isMortgaged) {
        res.status(400).json({ error: 'Property is already mortgaged' });
        return;
      }

      // Update property and add money to player
      await updatePropertyState(propertyId, { is_mortgaged: true });
      await client.query(
        'UPDATE players SET balance = balance + $1 WHERE id = $2',
        [mortgageValue, currentPlayer.id]
      );
    } else if (action === 'unmortgage') {
      if (!property.isMortgaged) {
        res.status(400).json({ error: 'Property is not mortgaged' });
        return;
      }

      const unmortgageCost = Math.floor(mortgageValue * 1.1); // 10% interest
      
      // Check if player can afford to unmortgage
      if (currentPlayer.balance < unmortgageCost) {
        res.status(400).json({ error: 'Insufficient funds to unmortgage property' });
        return;
      }

      // Update property and deduct money from player
      await updatePropertyState(propertyId, { is_mortgaged: false });
      await client.query(
        'UPDATE players SET balance = balance - $1 WHERE id = $2',
        [unmortgageCost, currentPlayer.id]
      );
    } else {
      res.status(400).json({ error: 'Invalid action' });
      return;
    }

    // Get updated data
    const updatedPlayers = await getGamePlayers(gameId);
    const updatedProperties = await getGameProperties(gameId);

    await client.query('COMMIT');
    res.json({
      success: true,
      players: updatedPlayers,
      properties: updatedProperties,
      action,
      property: updatedProperties.find(p => p.id === propertyId)
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Mortgage action error:', error);
    res.status(500).json({ error: 'Failed to process mortgage action' });
  } finally {
    client.release();
  }
});

// Helper functions to draw cards
function drawChanceCard(): Card {
  const chanceCards: Card[] = [
    {
      id: 1,
      type: 'chance',
      text: 'Advance to GO',
      action: {
        type: 'move',
        destination: 0
      }
    },
    {
      id: 2,
      type: 'chance',
      text: 'Advance to Illinois Avenue',
      action: {
        type: 'move',
        destination: 24
      }
    },
    {
      id: 3,
      type: 'chance',
      text: 'Advance to St. Charles Place',
      action: {
        type: 'move',
        destination: 11
      }
    },
    {
      id: 4,
      type: 'chance',
      text: 'Advance to nearest Utility',
      action: {
        type: 'move_nearest',
        propertyType: 'utility'
      }
    },
    {
      id: 5,
      type: 'chance',
      text: 'Advance to nearest Railroad',
      action: {
        type: 'move_nearest',
        propertyType: 'railroad'
      }
    },
    {
      id: 6,
      type: 'chance',
      text: 'Bank pays you dividend of $50',
      action: {
        type: 'collect',
        value: 50
      }
    },
    {
      id: 7,
      type: 'chance',
      text: 'Get out of Jail Free',
      action: {
        type: 'get_out_of_jail'
      }
    },
    {
      id: 8,
      type: 'chance',
      text: 'Go Back 3 Spaces',
      action: {
        type: 'move',
        value: -3
      }
    },
    {
      id: 9,
      type: 'chance',
      text: 'Go to Jail',
      action: {
        type: 'jail'
      }
    },
    {
      id: 10,
      type: 'chance',
      text: 'Make general repairs on all your property. For each house pay $25. For each hotel pay $100',
      action: {
        type: 'repair',
        value: 25,
        hotelValue: 100
      }
    }
  ];
  
  return chanceCards[Math.floor(Math.random() * chanceCards.length)];
}

function drawCommunityChestCard(): Card {
  const communityChestCards: Card[] = [
    {
      id: 1,
      type: 'chest',
      text: 'Advance to GO',
      action: {
        type: 'move',
        destination: 0
      }
    },
    {
      id: 2,
      type: 'chest',
      text: 'Bank error in your favor. Collect $200',
      action: {
        type: 'collect',
        value: 200
      }
    },
    {
      id: 3,
      type: 'chest',
      text: 'Doctor\'s fee. Pay $50',
      action: {
        type: 'pay',
        value: 50
      }
    },
    {
      id: 4,
      type: 'chest',
      text: 'Get out of Jail Free',
      action: {
        type: 'get_out_of_jail'
      }
    },
    {
      id: 5,
      type: 'chest',
      text: 'Go to Jail',
      action: {
        type: 'jail'
      }
    },
    {
      id: 6,
      type: 'chest',
      text: 'Holiday fund matures. Receive $100',
      action: {
        type: 'collect',
        value: 100
      }
    },
    {
      id: 7,
      type: 'chest',
      text: 'Income tax refund. Collect $20',
      action: {
        type: 'collect',
        value: 20
      }
    },
    {
      id: 8,
      type: 'chest',
      text: 'Life insurance matures. Collect $100',
      action: {
        type: 'collect',
        value: 100
      }
    },
    {
      id: 9,
      type: 'chest',
      text: 'Pay hospital fees of $100',
      action: {
        type: 'pay',
        value: 100
      }
    },
    {
      id: 10,
      type: 'chest',
      text: 'Pay school fees of $50',
      action: {
        type: 'pay',
        value: 50
      }
    }
  ];
  
  return communityChestCards[Math.floor(Math.random() * communityChestCards.length)];
}

// Game state transitions
async function handleGameAction(state: GameState, action: GameAction): Promise<GameStateUpdate> {
  const currentPlayer = state.turn_order[state.current_player_index];
  
  try {
    switch (action.type) {
      case 'roll': {
        if (state.phase !== 'rolling' || action.playerId !== currentPlayer) {
          return {
            type: 'state_update',
            state,
            message: 'Invalid action: Not your turn to roll'
          };
        }
        
        // Handle roll logic here
        const dice: [number, number] = [
          Math.floor(Math.random() * 6) + 1,
          Math.floor(Math.random() * 6) + 1
        ];
        const roll = dice[0] + dice[1];
        const isDoubles = dice[0] === dice[1];
        
        // Update state with roll
        state.last_roll = roll;
        state.last_dice = dice;
        state.last_doubles = isDoubles;
        
        // Handle jail
        if (isInJail(state, currentPlayer)) {
          const jailAction = handleJailTurn(state, currentPlayer, dice);
          if (!jailAction.success) {
            return advanceTurn(state);
          }
        }
        
        // Handle doubles
        if (isDoubles) {
          state.doubles_count++;
          if (state.doubles_count >= 3) {
            sendToJail(state, currentPlayer);
            return advanceTurn(state);
          }
        } else {
          state.doubles_count = 0;
        }
        
        // Move player
        const newPosition = calculateNewPosition(state.last_position || 0, roll);
        state.last_position = newPosition;
        
        // Handle landing on space
        const spaceAction = await handleLandOnSpace(state, currentPlayer, newPosition);
        if (spaceAction) {
          switch (spaceAction.type) {
            case 'purchase_available':
              state.phase = 'property_decision';
              state.current_property_decision = spaceAction.property as Property;
              break;
            case 'pay_rent':
              state.phase = 'paying_rent';
              if (spaceAction.property && 'ownerId' in spaceAction.property) {
                const propertyWithOwner = spaceAction.property as Property;
                if (propertyWithOwner.ownerId !== null) {
                  const rentAmount = await calculateRent(propertyWithOwner);
                  state.current_rent_owed = {
                    amount: rentAmount,
                    to: propertyWithOwner.ownerId,
                    from: currentPlayer,
                    property: propertyWithOwner
                  };
                }
              }
              break;
            case 'go_to_jail':
              sendToJail(state, currentPlayer);
              return advanceTurn(state);
          }
        }
        
        return {
          type: 'state_update',
          state,
          message: `Rolled ${roll} (${dice[0]}, ${dice[1]})`
        };
      }
      
      case 'purchase': {
        if (state.phase !== 'property_decision' || action.playerId !== currentPlayer) {
          return {
            type: 'state_update',
            state,
            message: 'Invalid action: Cannot purchase property now'
          };
        }
        
        const property = state.current_property_decision;
        if (!property) {
          return {
            type: 'state_update',
            state,
            message: 'No property available for purchase'
          };
        }

        // Purchase the property
        await buyProperty(currentGameId, property.position, currentPlayer);
        state.current_property_decision = undefined;
        
        if (!state.last_doubles) {
          return advanceTurn(state);
        } else {
          state.phase = 'rolling';
          return {
            type: 'state_update',
            state,
            message: `Purchased ${property.name}`
          };
        }
      }
      
      case 'pay_rent': {
        if (state.phase !== 'paying_rent' || action.playerId !== currentPlayer) {
          return {
            type: 'state_update',
            state,
            message: 'Invalid action: Cannot pay rent now'
          };
        }
        
        const rent = state.current_rent_owed;
        if (!rent) {
          return {
            type: 'state_update',
            state,
            message: 'No rent to pay'
          };
        }

        // Process rent payment
        await payRent(currentGameId, currentPlayer, rent.property.position);
        state.current_rent_owed = undefined;
        
        if (!state.last_doubles) {
          return advanceTurn(state);
        } else {
          state.phase = 'rolling';
          return {
            type: 'state_update',
            state,
            message: `Paid $${rent.amount} rent to Player ${rent.to}`
          };
        }
      }
      
      case 'declare_bankruptcy': {
        handleBankruptcy(state, action.playerId);
        if (shouldEndGame(state)) {
          endGame(state);
        }
        return {
          type: 'state_update',
          state,
          message: `Player ${action.playerId} declared bankruptcy`
        };
      }
      
      case 'end_turn': {
        if (action.playerId !== currentPlayer) {
          return {
            type: 'state_update',
            state,
            message: 'Invalid action: Not your turn'
          };
        }
        return advanceTurn(state);
      }

      default:
        return {
          type: 'state_update',
          state,
          message: 'Invalid action'
        };
    }
  } catch (error) {
    console.error('Error handling game action:', error);
    return {
      type: 'state_update',
      state,
      message: 'Error processing action'
    };
  }
}

function advanceTurn(state: GameState): GameStateUpdate {
  state.current_player_index = (state.current_player_index + 1) % state.turn_order.length;
  state.phase = 'rolling';
  state.last_doubles = false;
  state.doubles_count = 0;
  
  // Skip bankrupt players
  while (state.bankrupt_players.includes(state.turn_order[state.current_player_index])) {
    state.current_player_index = (state.current_player_index + 1) % state.turn_order.length;
  }
  
  return {
    type: 'state_update',
    state,
    message: `Player ${state.turn_order[state.current_player_index]}'s turn`
  };
}

function handleBankruptcy(state: GameState, playerId: number) {
  state.bankrupt_players.push(playerId);
  
  // Transfer all properties to bank or creditor
  // TODO: Implement property transfer logic
}

function shouldEndGame(state: GameState): boolean {
  const activePlayers = state.turn_order.filter(id => !state.bankrupt_players.includes(id));
  return activePlayers.length === 1;
}

function endGame(state: GameState) {
  state.phase = 'game_over';
  state.winner = state.turn_order.find(id => !state.bankrupt_players.includes(id))!;
}

// Update existing routes to use new game flow
router.post('/action', async (req: Request, res: Response) => {
  try {
    const { action } = req.body;
    const gameId = parseInt(req.params.id);
    const gameState = await getGameState(gameId);
    
    if (!gameState) {
      res.status(404).json({ error: 'Game not found' });
      return;
    }
    
    const update = await handleGameAction(gameState, action);
    await dbService.updateGameState(gameId, update.state);
    res.json(update);
  } catch (error) {
    console.error('Error handling game action:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Helper functions
function sendToJail(gameState: GameState, playerId: number): void {
  gameState.jail_turns[playerId] = 1;
}

function calculateNewPosition(currentPosition: number, roll: number): number {
  const newPosition = (currentPosition + roll) % 40;
  return newPosition;
}

async function handleLandOnSpace(gameState: GameState, playerId: number, position: number): Promise<SpaceAction> {
  const boardSpace = BOARD_SPACES[position] as ExtendedBoardSpace;
  
  try {
    switch (boardSpace.type) {
      case 'property':
      case 'railroad':
      case 'utility': {
        const spaceAction = await handlePropertySpace(gameState, playerId, position);
        return spaceAction;
      }
      case 'tax':
        return handleTaxSpace(gameState, playerId, position);
      case 'chance':
      case 'chest':
        return await handleCardSpace(gameState, playerId, boardSpace.type);
      case 'corner':
        if (boardSpace.name === 'Jail') {
          sendToJail(gameState, playerId);
          return { type: 'go_to_jail' };
        }
        return { type: 'property_action' };
      default:
        return { type: 'property_action' };
    }
  } catch (error) {
    console.error('Error in handleLandOnSpace:', error);
    return { type: 'property_action' };
  }
}

async function calculateRent(property: Property, dice?: [number, number]): Promise<number> {
  const [properties, players] = await Promise.all([
    getGameProperties(currentGameId),
    getGamePlayers(currentGameId)
  ]);
  const rentCalculationService = new RentCalculationService(properties, players);
  return rentCalculationService.calculateRent(property);
}

let currentGameId: number;

async function handlePropertySpace(gameState: GameState, playerId: number, position: number): Promise<SpaceAction> {
  const boardSpace = BOARD_SPACES[position];
  if (!boardSpace || !['property', 'railroad', 'utility'].includes(boardSpace.type)) {
    return { type: 'property_action' };
  }

  try {
    const dbProperty = await getPropertyByPosition(currentGameId, position);
    if (!dbProperty) {
      // Convert boardSpace to Property type
      const propertyData: Partial<Property> = {
        gameId: currentGameId,
        position: boardSpace.position,
        name: boardSpace.name,
        type: boardSpace.type as 'property' | 'railroad' | 'utility',
        price: boardSpace.price || 0,
        rentLevels: boardSpace.rentLevels || [],
        houseCost: boardSpace.houseCost || 0,
        hotelCost: boardSpace.hotelCost || 0,
        mortgageValue: boardSpace.mortgageValue || 0,
        colorGroup: boardSpace.colorGroup || '',
        ownerId: null,
        houseCount: 0,
        isMortgaged: false,
        hasHotel: false
      };
      
      const newProperty = await createProperty(currentGameId, propertyData);
      return {
        type: 'purchase_available',
        property: newProperty
      };
    }

    if (!dbProperty.ownerId) {
      return {
        type: 'purchase_available',
        property: dbProperty
      };
    }

    if (dbProperty.ownerId !== playerId && !dbProperty.isMortgaged) {
      const rentAmount = await calculateRent(dbProperty);
      return {
        type: 'pay_rent',
        property: dbProperty,
        message: `Pay $${rentAmount} rent to ${dbProperty.ownerId}`
      };
    }

    return { type: 'property_action' };
  } catch (error) {
    console.error('Error in handlePropertySpace:', error);
    return { type: 'property_action' };
  }
}

function handleTaxSpace(gameState: GameState, playerId: number, position: number): SpaceAction {
  const boardSpace = BOARD_SPACES[position];
  const taxAmount = boardSpace.type === 'tax' ? (boardSpace.price || 0) : 0;
  
  return {
    type: 'property_action',
    message: `Pay $${taxAmount} in tax`
  };
}

async function handleCardSpace(gameState: GameState, playerId: number, cardType: 'chance' | 'chest'): Promise<SpaceAction> {
  const [properties, players] = await Promise.all([
    getGameProperties(currentGameId),
    getGamePlayers(currentGameId)
  ]);
  const cardActionService = new CardActionService(currentGameId, players, gameState, properties);
  const card = cardType === 'chance' ? drawChanceCard() : drawCommunityChestCard();
  gameState.drawn_card = card;
  return {
    type: 'card_drawn',
    card,
    message: card.text
  };
}

// Update game state
router.post('/:id/state', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const gameId = parseInt(req.params.id);
    const gameState = await getGameState(gameId);
    
    if (!gameState) {
      res.status(404).json({ error: 'Game not found' });
      return;
    }

    await dbService.updateGameState(gameId, gameState);
    res.json({ success: true });
  } catch (error) {
    console.error('Update game state error:', error);
    res.status(500).json({ error: 'Failed to update game state' });
  }
});

// Helper function to get game state
async function getGameState(gameId: number): Promise<GameState | null> {
  const game = await getGame(gameId);
  if (!game) return null;
  return game.game_state;
}

// Fix property field references in property purchase
router.post('/:id/purchase', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    currentGameId = parseInt(req.params.id);
    const position = parseInt(req.body.position);
    const typedSession = req.session as TypedSession;
    const userId = typedSession.userId!;

    // Get game and validate
    const game = await getGame(currentGameId);
    if (!game) {
      res.status(404).json({ error: 'Game not found' });
      return;
    }

    // Get current player
    const players = await getGamePlayers(currentGameId);
    const currentPlayer = players.find(p => p.user_id === userId);
    if (!currentPlayer) {
      res.status(403).json({ error: 'Not in game' });
      return;
    }

    // Get property
    const property = await getPropertyByPosition(currentGameId, position);
    if (!property || property.ownerId !== null) {
      res.status(400).json({ error: 'Property not available for purchase' });
      return;
    }

    // Check if player can afford property
    if (currentPlayer.balance < property.price) {
      res.status(400).json({ error: 'Insufficient funds' });
      return;
    }

    // Update property owner
    await dbService.updatePropertyState(property.id, {
      ownerId: currentPlayer.id,
      houseCount: 0,
      isMortgaged: false
    });

    // Update player balance
    await client.query(
      'UPDATE players SET balance = balance - $1 WHERE id = $2',
      [property.price, currentPlayer.id]
    );

    await client.query('COMMIT');

    // Get updated data
    const [updatedPlayers, updatedProperties] = await Promise.all([
      getGamePlayers(currentGameId),
      getGameProperties(currentGameId)
    ]);

    res.json({
      success: true,
      players: updatedPlayers,
      properties: updatedProperties,
      message: `Successfully purchased ${property.name} for $${property.price}`
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Property purchase error:', error);
    res.status(500).json({ error: 'Failed to purchase property' });
  } finally {
    client.release();
  }
});

// Fix createProperty to use DBProperty type
async function createProperty(gameId: number, propertyData: Partial<Property>): Promise<Property> {
  try {
    // Ensure all required fields are present
    if (!propertyData.position || !propertyData.name || !propertyData.type) {
      throw new Error('Missing required property fields');
    }

    const propertyToCreate: Partial<Property> = {
      gameId,
      position: propertyData.position,
      name: propertyData.name,
      type: propertyData.type,
      price: propertyData.price || 0,
      rentLevels: propertyData.rentLevels || [],
      houseCost: propertyData.houseCost || 0,
      hotelCost: propertyData.hotelCost || 0,
      mortgageValue: propertyData.mortgageValue || 0,
      colorGroup: propertyData.colorGroup || '',
      ownerId: null,
      houseCount: 0,
      isMortgaged: false,
      hasHotel: false
    };

    return await dbService.createProperty(gameId, propertyToCreate);
  } catch (error) {
    console.error('Error creating property:', error);
    throw error;
  }
}

// GET /:id/property/:position - Get property state
router.get('/:id/property/:position', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const client = await pool.connect();
  try {
    const gameId = parseInt(req.params.id);
    const position = parseInt(req.params.position);

    console.log('Checking property state:', { gameId, position });

    const property = await getPropertyByPosition(gameId, position);
    
    if (!property) {
      res.status(404).json({ error: 'Property not found' });
      return;
    }

    console.log('Property state:', property);
    res.json(property);
  } catch (error) {
    console.error('Property state check error:', error);
    res.status(500).json({ error: 'Failed to check property state' });
  } finally {
    client.release();
  }
});

// POST /:gameId/buy-property - Buy a property
router.post('/:gameId/buy-property', requireAuth, async (req: Request, res: Response): Promise<void> => {
  console.log('\n=== Buy Property Request ===');
  const gameId = parseInt(req.params.gameId, 10);
  const { playerId, position } = req.body;
  const numericPlayerId = parseInt(playerId, 10);
  const numericPosition = parseInt(position, 10);

  try {
    console.log('Request details:', {
      gameId,
      playerId: numericPlayerId,
      position: numericPosition,
      timestamp: new Date().toISOString()
    });

    // Validate request parameters
    if (isNaN(gameId) || isNaN(numericPlayerId) || isNaN(numericPosition)) {
      console.error('Invalid numeric parameters:', { gameId, playerId, position });
      res.status(400).json({ error: 'Invalid numeric parameters' });
      return;
    }

    // Get current game state
    const game = await getGame(gameId);
    if (!game) {
      console.error('Game not found:', gameId);
      res.status(404).json({ error: 'Game not found' });
      return;
    }

    const gameState = game.game_state;
    console.log('Current game state:', {
      phase: gameState.phase,
      currentPlayerIndex: gameState.current_player_index,
      turnOrder: gameState.turn_order
    });

    // Verify it's the player's turn
    const currentPlayerId = gameState.turn_order[gameState.current_player_index];
    if (currentPlayerId !== numericPlayerId) {
      console.error('Not player\'s turn:', {
        expectedPlayer: currentPlayerId,
        requestingPlayer: numericPlayerId
      });
      res.status(403).json({ error: 'Not your turn' });
      return;
    }

    // Get the property details
    const property = await getPropertyByPosition(gameId, numericPosition);
    if (!property) {
      console.error('Property not found:', {
        gameId,
        position: numericPosition
      });
      res.status(404).json({ error: 'Property not found' });
      return;
    }

    console.log('Property details:', {
      name: property.name,
      position: property.position,
      price: property.price,
      ownerId: property.ownerId
    });

    // Verify property is not already owned
    if (property.ownerId !== null) {
      console.error('Property already owned:', {
        propertyId: property.id,
        currentOwnerId: property.ownerId,
        attemptingPlayerId: numericPlayerId
      });
      res.status(400).json({ error: 'Property is already owned' });
      return;
    }

    // Get the player
    const player = await getGamePlayers(gameId).then(players => 
      players.find(p => p.id === numericPlayerId)
    );
    if (!player) {
      console.error('Player not found:', {
        gameId,
        playerId: numericPlayerId
      });
      res.status(404).json({ error: 'Player not found' });
      return;
    }

    console.log('Player details:', {
      username: player.username,
      balance: player.balance,
      position: player.position
    });

    // Verify player has enough money
    if (player.balance < property.price) {
      console.error('Insufficient funds:', {
        required: property.price,
        available: player.balance
      });
      res.status(400).json({ error: 'Insufficient funds' });
      return;
    }

    // Verify player is on the property
    if (player.position !== numericPosition) {
      console.error('Player not on property:', {
        playerPosition: player.position,
        propertyPosition: numericPosition
      });
      res.status(400).json({ error: 'You must be on the property to purchase it' });
      return;
    }

    console.log('Starting purchase transaction');

    // Perform the purchase transaction
    const result = await buyProperty(gameId, numericPlayerId, numericPosition);
    
    if (!result.success) {
      console.error('Purchase failed:', result.error);
      res.status(400).json({ error: result.error });
      return;
    }

    console.log('Purchase transaction completed successfully');
    console.log('Updated state:', {
      property: result.property,
      player: result.player
    });

    res.json({
      success: true,
      property: result.property,
      player: result.player
    });
  } catch (error) {
    console.error('Purchase error:', error);
    res.status(500).json({ error: 'Failed to purchase property' });
  }
});

export default router; 