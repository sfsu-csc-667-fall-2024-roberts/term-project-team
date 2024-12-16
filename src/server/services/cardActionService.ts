import { GameState, Card, Player, Property } from '../../shared/types';
import { updatePlayerPosition, updatePlayerMoney, updatePlayerInJail } from '../db/services/dbService';

class CardActionService {
  async executeCardAction(
    gameState: GameState,
    card: Card,
    player: Player,
    properties: Property[]
  ): Promise<void> {
    switch (card.action.type) {
      case 'move':
        if (card.action.destination !== undefined) {
          await updatePlayerPosition(player.id, card.action.destination);
        }
        break;

      case 'move_to_nearest':
        if (card.action.propertyType) {
          const nearestPosition = this.findNearestPropertyPosition(
            player.position,
            properties,
            card.action.propertyType
          );
          if (nearestPosition !== null) {
            await updatePlayerPosition(player.id, nearestPosition);
          }
        }
        break;

      case 'collect':
        if (card.action.value) {
          await updatePlayerMoney(player.id, player.money + card.action.value);
        }
        break;

      case 'pay':
        if (card.action.value) {
          await updatePlayerMoney(player.id, player.money - card.action.value);
        }
        break;

      case 'repairs':
        if (card.action.value && card.action.hotelValue) {
          const ownedProperties = properties.filter(p => p.ownerId === player.id);
          const totalCost = this.calculateRepairsCost(
            ownedProperties,
            card.action.value,
            card.action.hotelValue
          );
          await updatePlayerMoney(player.id, player.money - totalCost);
        }
        break;

      case 'collect_from_each':
        if (card.action.collectFromEach) {
          const otherPlayers = gameState.players.filter(p => p.id !== player.id);
          const totalCollected = card.action.collectFromEach * otherPlayers.length;
          await updatePlayerMoney(player.id, player.money + totalCollected);
          for (const otherPlayer of otherPlayers) {
            await updatePlayerMoney(otherPlayer.id, otherPlayer.money - card.action.collectFromEach);
          }
        }
        break;

      case 'jail':
        await updatePlayerInJail(player.id, true);
        await updatePlayerPosition(player.id, 10); // Jail position
        break;

      case 'jail_free':
        // Add jail free card to player's inventory
        gameState.jailFreeCards[player.id] = (gameState.jailFreeCards[player.id] || 0) + 1;
        break;

      case 'move_relative':
        if (card.action.value) {
          const newPosition = (player.position + card.action.value + 40) % 40;
          await updatePlayerPosition(player.id, newPosition);
        }
        break;
    }
  }

  private findNearestPropertyPosition(
    currentPosition: number,
    properties: Property[],
    propertyType: 'railroad' | 'utility'
  ): number | null {
    const typeProperties = properties.filter(p => p.type === propertyType);
    if (typeProperties.length === 0) return null;

    let nearestPosition = typeProperties[0].position;
    let minDistance = this.calculateDistance(currentPosition, nearestPosition);

    for (const property of typeProperties) {
      const distance = this.calculateDistance(currentPosition, property.position);
      if (distance < minDistance) {
        minDistance = distance;
        nearestPosition = property.position;
      }
    }

    return nearestPosition;
  }

  private calculateDistance(from: number, to: number): number {
    const forward = (to - from + 40) % 40;
    const backward = (from - to + 40) % 40;
    return Math.min(forward, backward);
  }

  private calculateRepairsCost(
    properties: Property[],
    houseCost: number,
    hotelCost: number
  ): number {
    return properties.reduce((total, property) => {
      if (property.hasHotel) {
        return total + hotelCost;
      }
      return total + (property.houseCount * houseCost);
    }, 0);
  }
}

export const cardActionService = new CardActionService(); 