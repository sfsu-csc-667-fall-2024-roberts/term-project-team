import express, { Request, Response, Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { pool } from '../db/config';
import { getGame, getGamePlayers, getGameProperties, buyProperty, getPropertyByPosition, payRent } from '../db/services/dbService';
import { Game, GameState } from '../db/models/types';
import { BOARD_SPACES } from '../../shared/boardData';
import { BotService } from '../services/botService';
import session from 'express-session';
import { CardActionService } from '../services/cardActionService';
import { RentCalculationService } from '../services/rentCalculationService';
import { Card, BoardSpace } from '../../shared/types';

type TypedSession = session.Session & {
  userId?: number;
  username?: string;
  returnTo?: string;
};

const router: Router = express.Router();

async function updatePropertyState(propertyId: number, updates: Partial<{ mortgaged: boolean }>) {
  const updateFields = [];
  const values = [];
  let paramCount = 1;

  if (updates.mortgaged !== undefined) {
    updateFields.push(`mortgaged = $${paramCount}`);
    values.push(updates.mortgaged);
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
    let gameState = game.game_state || {
      phase: 'waiting',
      current_player_index: 0,
      dice_rolls: [],
      turn_order: []
    };

    // Ensure game state has all required properties
    gameState = {
      phase: gameState.phase || 'waiting',
      current_player_index: typeof gameState.current_player_index === 'number' ? gameState.current_player_index : 0,
      dice_rolls: Array.isArray(gameState.dice_rolls) ? gameState.dice_rolls : [],
      turn_order: Array.isArray(gameState.turn_order) ? gameState.turn_order : []
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
    const sortedPlayers = [...players].sort((a, b) => {
      if (a.is_bot === b.is_bot) return 0;
      return a.is_bot ? 1 : -1;
    });

    // Initialize game state if it doesn't exist
    let gameState = game.game_state || {
      phase: 'waiting',
      current_player_index: 0,
      dice_rolls: [],
      turn_order: []
    };

    // Ensure game state has all required properties
    gameState = {
      phase: gameState.phase || 'waiting',
      current_player_index: typeof gameState.current_player_index === 'number' ? gameState.current_player_index : 0,
      dice_rolls: Array.isArray(gameState.dice_rolls) ? gameState.dice_rolls : [],
      turn_order: Array.isArray(gameState.turn_order) ? gameState.turn_order : []
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
      gameState
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

    const gameId = parseInt(req.params.id);
    const typedSession = req.session as TypedSession;
    const userId = typedSession.userId!;
    const botId = req.body.botId ? parseInt(req.body.botId) : undefined;

    // Get game and validate
    const game = await getGame(gameId);
    if (!game) {
      res.status(404).json({ error: 'Game not found' });
      return;
    }

    // Get current player
    const players = await getGamePlayers(gameId);
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
        
        // Set turn order using player IDs from sorted rolls
        gameState.turn_order = sortedRolls.map(roll => roll.id);
        gameState.phase = 'playing';
        console.log('All players have rolled. Turn order:', gameState.turn_order);
      }

      // Update game state
      await client.query('UPDATE games SET game_state = $1 WHERE id = $2', [gameState, gameId]);
      
      await client.query('COMMIT');
      res.json({ roll: totalRoll, dice: [dice1, dice2], isDoubles, gameState, players });
    } else if (gameState.phase === 'playing') {
      // Move player
      const newPosition = (currentPlayer.position + totalRoll) % 40;

      // Update player position in database
      await client.query(
        'UPDATE players SET position = $1 WHERE id = $2',
        [newPosition, currentPlayer.id]
      );

      // Get updated player data
      let updatedPlayers = await getGamePlayers(gameId);
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
          const cardService = new CardActionService(gameId, updatedPlayers, gameState, await getGameProperties(gameId));
          
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
          updatedPlayers = await getGamePlayers(gameId);
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
          const property = await getPropertyByPosition(gameId, newPosition);
          console.log('Property database state:', { 
            property,
            exists: !!property,
            isOwned: !!property?.owner_id,
            ownerInfo: property?.owner_id ? 'Owned' : 'Unowned',
            propertyPrice: property?.price || spaceData.price,
            spaceType: spaceData.type,
            canAfford: currentPlayer.balance >= (property?.price || spaceData.price || 0)
          });
          
          // Property exists and is unowned
          if (property && !property.owner_id) {
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
          } else if (property && property.owner_id && property.owner_id !== currentPlayer.id) {
            // Property is owned by another player - need to pay rent
            const rentService = new RentCalculationService(await getGameProperties(gameId), updatedPlayers);
            let rentAmount = rentService.calculateRent(property);
            
            // For utilities, use the dice roll
            if (spaceData.type === 'utility') {
              rentAmount *= totalRoll;
            }
            
            spaceAction = {
              type: 'pay_rent',
              property: {
                ...property,
                type: spaceData.type,
                price: spaceData.price,
                rentAmount
              }
            };
            console.log('Created rent action:', spaceAction);

            // Update player balances
            const owner = updatedPlayers.find(p => p.id === property.owner_id);
            if (owner) {
              // Deduct rent from current player
              await client.query(
                'UPDATE players SET balance = balance - $1 WHERE id = $2',
                [rentAmount, currentPlayer.id]
              );

              // Add rent to owner's balance
              await client.query(
                'UPDATE players SET balance = balance + $1 WHERE id = $2',
                [rentAmount, owner.id]
              );

              // Get updated player data
              updatedPlayers = await getGamePlayers(gameId);
              updatedCurrentPlayer = updatedPlayers.find(p => p.id === currentPlayer.id);
            }
          } else if (!property) {
            // Property doesn't exist in database, create it
            try {
              await client.query(
                'INSERT INTO properties (game_id, position, name, owner_id, house_count, mortgaged, price) VALUES ($1, $2, $3, $4, $5, $6, $7)',
                [gameId, newPosition, spaceData.name, null, 0, false, spaceData.price]
              );
              console.log('Created unowned property in database');
              
              // Set purchase action for the newly created property
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
              console.log('Creating purchase action for new property:', spaceAction);
            } catch (error) {
              console.error('Error creating property:', error);
            }
          }
        }
      }

      // Update game state with new position
      gameState.last_roll = totalRoll;
      gameState.last_dice = [dice1, dice2];
      gameState.last_doubles = isDoubles;
      gameState.last_position = newPosition;
      await client.query('UPDATE games SET game_state = $1 WHERE id = $2', [gameState, gameId]);

      // Get final updated data
      updatedPlayers = await getGamePlayers(gameId);
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

// POST /:id/property/buy - Buy a property
router.post('/:id/property/buy', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const gameId = parseInt(req.params.id);
    const { position } = req.body;
    const typedSession = req.session as TypedSession;
    const userId = typedSession.userId;

    console.log('Processing property purchase:', {
      gameId,
      position,
      userId,
      body: req.body
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

    // Try to buy the property
    try {
      console.log('Attempting to buy property:', {
        gameId,
        position,
        playerId: currentPlayer.id,
        playerBalance: currentPlayer.balance
      });

      const result = await buyProperty(gameId, position, currentPlayer.id);
      console.log('Property purchase successful:', result);
      
      // Get updated game data
      const updatedPlayers = await getGamePlayers(gameId);
      const updatedProperties = await getGameProperties(gameId);

      await client.query('COMMIT');
      res.json({
        success: true,
        property: result,
        players: updatedPlayers,
        properties: updatedProperties
      });
    } catch (error) {
      console.error('Property purchase failed:', error);
      res.status(400).json({ error: error instanceof Error ? error.message : 'Failed to buy property' });
    }
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Buy property error:', error);
    res.status(500).json({ error: 'Failed to process property purchase' });
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
    if (property.owner_id !== currentPlayer.id) {
      res.status(403).json({ error: 'You do not own this property' });
      return;
    }

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

    // Get building cost from board data
    const spaceData = BOARD_SPACES[property.position] as BoardSpace;
    const buildingCost = spaceData.houseCost || 100; // Default to 100 if not specified

    // Check if player can afford it
    if (currentPlayer.balance < buildingCost) {
      res.status(400).json({ error: 'Insufficient funds' });
      return;
    }

    // Update property
    await client.query(
      'UPDATE properties SET house_count = $1 WHERE id = $2',
      [buildType === 'hotel' ? 5 : property.house_count + 1, propertyId]
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
    if (property.owner_id !== currentPlayer.id) {
      res.status(403).json({ error: 'You do not own this property' });
      return;
    }

    // Cannot mortgage property with houses
    if (property.house_count > 0) {
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
      if (property.mortgaged) {
        res.status(400).json({ error: 'Property is already mortgaged' });
        return;
      }

      // Update property and add money to player
      await updatePropertyState(propertyId, { mortgaged: true });
      await client.query(
        'UPDATE players SET balance = balance + $1 WHERE id = $2',
        [mortgageValue, currentPlayer.id]
      );
    } else if (action === 'unmortgage') {
      if (!property.mortgaged) {
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
      await updatePropertyState(propertyId, { mortgaged: false });
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

export default router; 