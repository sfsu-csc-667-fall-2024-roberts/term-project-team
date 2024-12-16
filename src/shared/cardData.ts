import { Card } from '../../shared/types';

export const CHANCE_CARDS: Card[] = [
  {
    type: 'chance',
    text: 'Advance to GO',
    action: {
      type: 'move',
      destination: 0
    }
  },
  {
    type: 'chance',
    text: 'Advance to Illinois Avenue',
    action: {
      type: 'move',
      destination: 24
    }
  },
  {
    type: 'chance',
    text: 'Advance to St. Charles Place',
    action: {
      type: 'move',
      destination: 11
    }
  },
  {
    type: 'chance',
    text: 'Advance to nearest Railroad',
    action: {
      type: 'move_to_nearest',
      propertyType: 'railroad'
    }
  },
  {
    type: 'chance',
    text: 'Advance to nearest Utility',
    action: {
      type: 'move_to_nearest',
      propertyType: 'utility'
    }
  },
  {
    type: 'chance',
    text: 'Bank pays you dividend of $50',
    action: {
      type: 'collect',
      value: 50
    }
  },
  {
    type: 'chance',
    text: 'Get out of Jail Free',
    action: {
      type: 'jail_free'
    }
  },
  {
    type: 'chance',
    text: 'Go Back 3 Spaces',
    action: {
      type: 'move_relative',
      value: -3
    }
  },
  {
    type: 'chance',
    text: 'Go to Jail',
    action: {
      type: 'jail'
    }
  },
  {
    type: 'chance',
    text: 'Make general repairs on all your property',
    action: {
      type: 'repairs',
      value: 25,
      hotelValue: 100
    }
  },
  {
    type: 'chance',
    text: 'Pay poor tax of $15',
    action: {
      type: 'pay',
      value: 15
    }
  },
  {
    type: 'chance',
    text: 'Take a trip to Reading Railroad',
    action: {
      type: 'move',
      destination: 5
    }
  },
  {
    type: 'chance',
    text: 'Take a walk on the Boardwalk',
    action: {
      type: 'move',
      destination: 39
    }
  },
  {
    type: 'chance',
    text: 'You have been elected Chairman of the Board',
    action: {
      type: 'collect_from_each',
      value: 50
    }
  },
  {
    type: 'chance',
    text: 'Your building loan matures',
    action: {
      type: 'collect',
      value: 150
    }
  }
];

export const COMMUNITY_CHEST_CARDS: Card[] = [
  {
    type: 'community_chest',
    text: 'Advance to GO',
    action: {
      type: 'move',
      destination: 0
    }
  },
  {
    type: 'community_chest',
    text: 'Bank error in your favor',
    action: {
      type: 'collect',
      value: 200
    }
  },
  {
    type: 'community_chest',
    text: 'Doctor\'s fees',
    action: {
      type: 'pay',
      value: 50
    }
  },
  {
    type: 'community_chest',
    text: 'From sale of stock you get $50',
    action: {
      type: 'collect',
      value: 50
    }
  },
  {
    type: 'community_chest',
    text: 'Get Out of Jail Free',
    action: {
      type: 'jail_free'
    }
  },
  {
    type: 'community_chest',
    text: 'Go to Jail',
    action: {
      type: 'jail'
    }
  },
  {
    type: 'community_chest',
    text: 'Grand Opera Night',
    action: {
      type: 'collect_from_each',
      value: 50
    }
  },
  {
    type: 'community_chest',
    text: 'Holiday Fund matures',
    action: {
      type: 'collect',
      value: 100
    }
  },
  {
    type: 'community_chest',
    text: 'Income tax refund',
    action: {
      type: 'collect',
      value: 20
    }
  },
  {
    type: 'community_chest',
    text: 'Life insurance matures',
    action: {
      type: 'collect',
      value: 100
    }
  },
  {
    type: 'community_chest',
    text: 'Hospital Fees',
    action: {
      type: 'pay',
      value: 50
    }
  },
  {
    type: 'community_chest',
    text: 'School Fees',
    action: {
      type: 'pay',
      value: 50
    }
  },
  {
    type: 'community_chest',
    text: 'Receive $25 consultancy fee',
    action: {
      type: 'collect',
      value: 25
    }
  },
  {
    type: 'community_chest',
    text: 'You are assessed for street repairs',
    action: {
      type: 'repairs',
      value: 40,
      hotelValue: 115
    }
  },
  {
    type: 'community_chest',
    text: 'You have won second prize in a beauty contest',
    action: {
      type: 'collect',
      value: 10
    }
  },
  {
    type: 'community_chest',
    text: 'You inherit $100',
    action: {
      type: 'collect',
      value: 100
    }
  }
]; 