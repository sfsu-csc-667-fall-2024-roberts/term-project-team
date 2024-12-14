import { Card } from './types';

export const CHANCE_CARDS: Card[] = [
  {
    id: 1,
    type: 'chance',
    text: 'Advance to GO (Collect $200)',
    action: { type: 'move', destination: 0 }
  },
  {
    id: 2,
    type: 'chance',
    text: 'Advance to Illinois Avenue. If you pass GO, collect $200',
    action: { type: 'move', destination: 24 }
  },
  {
    id: 3,
    type: 'chance',
    text: 'Advance to St. Charles Place. If you pass GO, collect $200',
    action: { type: 'move', destination: 11 }
  },
  {
    id: 4,
    type: 'chance',
    text: 'Advance to nearest Railroad. If unowned, you may buy it. If owned, pay owner twice the rental',
    action: { type: 'move_nearest', propertyType: 'railroad' }
  },
  {
    id: 5,
    type: 'chance',
    text: 'Advance to nearest Utility. If unowned, you may buy it. If owned, roll dice and pay owner 10 times the amount shown',
    action: { type: 'move_nearest', propertyType: 'utility' }
  },
  {
    id: 6,
    type: 'chance',
    text: 'Bank pays you dividend of $50',
    action: { type: 'collect', value: 50 }
  },
  {
    id: 7,
    type: 'chance',
    text: 'Get Out of Jail Free',
    action: { type: 'get_out_of_jail' }
  },
  {
    id: 8,
    type: 'chance',
    text: 'Go Back 3 Spaces',
    action: { type: 'move', value: -3 }
  },
  {
    id: 9,
    type: 'chance',
    text: 'Go to Jail. Go directly to Jail, do not pass GO, do not collect $200',
    action: { type: 'jail' }
  },
  {
    id: 10,
    type: 'chance',
    text: 'Make general repairs on all your property. For each house pay $25. For each hotel pay $100',
    action: { type: 'repair', value: 25, hotelValue: 100 }
  },
  {
    id: 11,
    type: 'chance',
    text: 'Speeding fine $15',
    action: { type: 'pay', value: 15 }
  },
  {
    id: 12,
    type: 'chance',
    text: 'Take a trip to Reading Railroad. If you pass GO, collect $200',
    action: { type: 'move', destination: 5 }
  },
  {
    id: 13,
    type: 'chance',
    text: 'You have been elected Chairman of the Board. Pay each player $50',
    action: { type: 'pay', collectFromEach: 50 }
  },
  {
    id: 14,
    type: 'chance',
    text: 'Your building loan matures. Collect $150',
    action: { type: 'collect', value: 150 }
  }
];

export const COMMUNITY_CHEST_CARDS: Card[] = [
  {
    id: 1,
    type: 'chest',
    text: 'Advance to GO (Collect $200)',
    action: { type: 'move', destination: 0 }
  },
  {
    id: 2,
    type: 'chest',
    text: 'Bank error in your favor. Collect $200',
    action: { type: 'collect', value: 200 }
  },
  {
    id: 3,
    type: 'chest',
    text: 'Doctor\'s fee. Pay $50',
    action: { type: 'pay', value: 50 }
  },
  {
    id: 4,
    type: 'chest',
    text: 'From sale of stock you get $50',
    action: { type: 'collect', value: 50 }
  },
  {
    id: 5,
    type: 'chest',
    text: 'Get Out of Jail Free',
    action: { type: 'get_out_of_jail' }
  },
  {
    id: 6,
    type: 'chest',
    text: 'Go to Jail. Go directly to jail, do not pass GO, do not collect $200',
    action: { type: 'jail' }
  },
  {
    id: 7,
    type: 'chest',
    text: 'Holiday fund matures. Receive $100',
    action: { type: 'collect', value: 100 }
  },
  {
    id: 8,
    type: 'chest',
    text: 'Income tax refund. Collect $20',
    action: { type: 'collect', value: 20 }
  },
  {
    id: 9,
    type: 'chest',
    text: 'It is your birthday. Collect $10 from each player',
    action: { type: 'collect_from_players', value: 10 }
  },
  {
    id: 10,
    type: 'chest',
    text: 'Life insurance matures. Collect $100',
    action: { type: 'collect', value: 100 }
  },
  {
    id: 11,
    type: 'chest',
    text: 'Pay hospital fees of $100',
    action: { type: 'pay', value: 100 }
  },
  {
    id: 12,
    type: 'chest',
    text: 'Pay school fees of $50',
    action: { type: 'pay', value: 50 }
  },
  {
    id: 13,
    type: 'chest',
    text: 'Receive $25 consultancy fee',
    action: { type: 'collect', value: 25 }
  },
  {
    id: 14,
    type: 'chest',
    text: 'You are assessed for street repair. $40 per house. $115 per hotel',
    action: { type: 'repair', value: 40, hotelValue: 115 }
  },
  {
    id: 15,
    type: 'chest',
    text: 'You have won second prize in a beauty contest. Collect $10',
    action: { type: 'collect', value: 10 }
  },
  {
    id: 16,
    type: 'chest',
    text: 'You inherit $100',
    action: { type: 'collect', value: 100 }
  }
]; 