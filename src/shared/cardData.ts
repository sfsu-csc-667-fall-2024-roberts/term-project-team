import { Card } from './types';

export const CHANCE_CARDS: Card[] = [
    {
        type: 'chance',
        text: 'Advance to GO. Collect $200.',
        action: {
            type: 'move',
            destination: 0,
            amount: 200
        }
    },
    {
        type: 'chance',
        text: 'Advance to Illinois Avenue. If you pass GO, collect $200.',
        action: {
            type: 'move',
            destination: 24,
            amount: 200
        }
    },
    {
        type: 'chance',
        text: 'Advance to St. Charles Place. If you pass GO, collect $200.',
        action: {
            type: 'move',
            destination: 11,
            amount: 200
        }
    },
    {
        type: 'chance',
        text: 'Advance to nearest Railroad. If unowned, you may buy it from the Bank. If owned, pay owner twice the rental.',
        action: {
            type: 'move_to_nearest',
            propertyType: 'railroad'
        }
    },
    {
        type: 'chance',
        text: 'Advance to nearest Utility. If unowned, you may buy it from the Bank. If owned, throw dice and pay owner 10 times the amount thrown.',
        action: {
            type: 'move_to_nearest',
            propertyType: 'utility'
        }
    },
    {
        type: 'chance',
        text: 'Bank pays you dividend of $50.',
        action: {
            type: 'collect',
            amount: 50
        }
    },
    {
        type: 'chance',
        text: 'Go Back 3 Spaces.',
        action: {
            type: 'move_relative',
            value: -3
        }
    },
    {
        type: 'chance',
        text: 'Go to Jail. Go directly to Jail, do not pass GO, do not collect $200.',
        action: {
            type: 'jail',
            goToJail: true
        }
    },
    {
        type: 'chance',
        text: 'Make general repairs on all your property. For each house pay $25. For each hotel pay $100.',
        action: {
            type: 'repairs',
            houseFee: 25,
            hotelFee: 100
        }
    },
    {
        type: 'chance',
        text: 'Speeding fine $15.',
        action: {
            type: 'pay',
            amount: 15
        }
    },
    {
        type: 'chance',
        text: 'Take a trip to Reading Railroad. If you pass GO, collect $200.',
        action: {
            type: 'move',
            destination: 5,
            amount: 200
        }
    },
    {
        type: 'chance',
        text: 'You have been elected Chairman of the Board. Pay each player $50.',
        action: {
            type: 'collect_from_each',
            collectFromEach: 50
        }
    }
];

export const COMMUNITY_CHEST_CARDS: Card[] = [
    {
        type: 'chest',
        text: 'Advance to GO. Collect $200.',
        action: {
            type: 'move',
            destination: 0,
            amount: 200
        }
    },
    {
        type: 'chest',
        text: 'Bank error in your favor. Collect $200.',
        action: {
            type: 'collect',
            amount: 200
        }
    },
    {
        type: 'chest',
        text: "Doctor's fee. Pay $50.",
        action: {
            type: 'pay',
            amount: 50
        }
    },
    {
        type: 'chest',
        text: 'From sale of stock you get $50.',
        action: {
            type: 'collect',
            amount: 50
        }
    },
    {
        type: 'chest',
        text: 'Get Out of Jail Free.',
        action: {
            type: 'jail_free'
        }
    },
    {
        type: 'chest',
        text: 'Go to Jail. Go directly to jail, do not pass GO, do not collect $200.',
        action: {
            type: 'jail',
            goToJail: true
        }
    },
    {
        type: 'chest',
        text: 'Holiday fund matures. Receive $100.',
        action: {
            type: 'collect',
            amount: 100
        }
    },
    {
        type: 'chest',
        text: 'Income tax refund. Collect $20.',
        action: {
            type: 'collect',
            amount: 20
        }
    },
    {
        type: 'chest',
        text: 'It is your birthday. Collect $10 from each player.',
        action: {
            type: 'collect_from_each',
            collectFromEach: 10
        }
    },
    {
        type: 'chest',
        text: 'Life insurance matures. Collect $100.',
        action: {
            type: 'collect',
            amount: 100
        }
    },
    {
        type: 'chest',
        text: 'Pay hospital fees of $100.',
        action: {
            type: 'pay',
            amount: 100
        }
    },
    {
        type: 'chest',
        text: 'Pay school fees of $50.',
        action: {
            type: 'pay',
            amount: 50
        }
    },
    {
        type: 'chest',
        text: 'Receive $25 consultancy fee.',
        action: {
            type: 'collect',
            amount: 25
        }
    },
    {
        type: 'chest',
        text: 'You are assessed for street repairs. $40 per house. $115 per hotel.',
        action: {
            type: 'repairs',
            houseFee: 40,
            hotelFee: 115
        }
    },
    {
        type: 'chest',
        text: 'You have won second prize in a beauty contest. Collect $10.',
        action: {
            type: 'collect',
            amount: 10
        }
    },
    {
        type: 'chest',
        text: 'You inherit $100.',
        action: {
            type: 'collect',
            amount: 100
        }
    }
]; 