import { ExtendedBoardSpace } from './types';

export const BOARD_SPACES: ExtendedBoardSpace[] = [
  {
    position: 0,
    name: 'GO',
    type: 'corner',
  },
  {
    position: 1,
    name: 'Mediterranean Avenue',
    type: 'property',
    price: 60,
    rentLevels: [2, 10, 30, 90, 160, 250],
    houseCost: 50,
    hotelCost: 50,
    mortgageValue: 30,
    colorGroup: 'brown'
  },
  {
    position: 2,
    name: 'Community Chest',
    type: 'chest',
  },
  {
    position: 3,
    name: 'Baltic Avenue',
    type: 'property',
    price: 60,
    rentLevels: [4, 20, 60, 180, 320, 450],
    houseCost: 50,
    hotelCost: 50,
    mortgageValue: 30,
    colorGroup: 'brown'
  },
  {
    position: 4,
    name: 'Income Tax',
    type: 'tax',
  },
  {
    position: 5,
    name: 'Reading Railroad',
    type: 'railroad',
    price: 200,
    rentLevels: [25, 50, 100, 200],
  },
  {
    position: 6,
    name: 'Oriental Avenue',
    type: 'property',
    price: 100,
    rentLevels: [6, 30, 90, 270, 400, 550],
    colorGroup: 'lightblue'
  },
  {
    position: 7,
    name: 'Chance',
    type: 'chance',
  },
  {
    position: 8,
    name: 'Vermont Avenue',
    type: 'property',
    price: 100,
    rentLevels: [6, 30, 90, 270, 400, 550],
    colorGroup: 'lightblue'
  },
  {
    position: 9,
    name: 'Connecticut Avenue',
    type: 'property',
    price: 120,
    rentLevels: [8, 40, 100, 300, 450, 600],
    colorGroup: 'lightblue'
  },
  {
    position: 10,
    name: 'Jail',
    type: 'corner',
  },
  {
    position: 11,
    name: 'St. Charles Place',
    type: 'property',
    price: 140,
    rentLevels: [10, 50, 150, 450, 625, 750],
    colorGroup: 'pink'
  },
  {
    position: 12,
    name: 'Electric Company',
    type: 'utility',
    price: 150,
    rentLevels: [4, 10],
  },
  {
    position: 13,
    name: 'States Avenue',
    type: 'property',
    price: 140,
    rentLevels: [10, 50, 150, 450, 625, 750],
    colorGroup: 'pink'
  },
  {
    position: 14,
    name: 'Virginia Avenue',
    type: 'property',
    price: 160,
    rentLevels: [12, 60, 180, 500, 700, 900],
    colorGroup: 'pink'
  },
  {
    position: 15,
    name: 'Pennsylvania Railroad',
    type: 'railroad',
    price: 200,
    rentLevels: [25, 50, 100, 200],
  },
  {
    position: 16,
    name: 'St. James Place',
    type: 'property',
    price: 180,
    rentLevels: [14, 70, 200, 550, 750, 950],
    colorGroup: 'orange'
  },
  {
    position: 17,
    name: 'Community Chest',
    type: 'chest',
  },
  {
    position: 18,
    name: 'Tennessee Avenue',
    type: 'property',
    price: 180,
    rentLevels: [14, 70, 200, 550, 750, 950],
    colorGroup: 'orange'
  },
  {
    position: 19,
    name: 'New York Avenue',
    type: 'property',
    price: 200,
    rentLevels: [16, 80, 220, 600, 800, 1000],
    colorGroup: 'orange'
  },
  {
    position: 20,
    name: 'Free Parking',
    type: 'corner',
  },
  {
    position: 21,
    name: 'Kentucky Avenue',
    type: 'property',
    price: 220,
    rentLevels: [18, 90, 250, 700, 875, 1050],
    colorGroup: 'red'
  },
  {
    position: 22,
    name: 'Chance',
    type: 'chance',
  },
  {
    position: 23,
    name: 'Indiana Avenue',
    type: 'property',
    price: 220,
    rentLevels: [18, 90, 250, 700, 875, 1050],
    colorGroup: 'red'
  },
  {
    position: 24,
    name: 'Illinois Avenue',
    type: 'property',
    price: 240,
    rentLevels: [20, 100, 300, 750, 925, 1100],
    colorGroup: 'red'
  },
  {
    position: 25,
    name: 'B. & O. Railroad',
    type: 'railroad',
    price: 200,
    rentLevels: [25, 50, 100, 200],
  },
  {
    position: 26,
    name: 'Atlantic Avenue',
    type: 'property',
    price: 260,
    rentLevels: [22, 110, 330, 800, 975, 1150],
    colorGroup: 'yellow'
  },
  {
    position: 27,
    name: 'Ventnor Avenue',
    type: 'property',
    price: 260,
    rentLevels: [22, 110, 330, 800, 975, 1150],
    colorGroup: 'yellow'
  },
  {
    position: 28,
    name: 'Water Works',
    type: 'utility',
    price: 150,
    rentLevels: [4, 10],
  },
  {
    position: 29,
    name: 'Marvin Gardens',
    type: 'property',
    price: 280,
    rentLevels: [24, 120, 360, 850, 1025, 1200],
    colorGroup: 'yellow'
  },
  {
    position: 30,
    name: 'Go To Jail',
    type: 'corner',
  },
  {
    position: 31,
    name: 'Pacific Avenue',
    type: 'property',
    price: 300,
    rentLevels: [26, 130, 390, 900, 1100, 1275],
    colorGroup: 'green'
  },
  {
    position: 32,
    name: 'North Carolina Avenue',
    type: 'property',
    price: 300,
    rentLevels: [26, 130, 390, 900, 1100, 1275],
    colorGroup: 'green'
  },
  {
    position: 33,
    name: 'Community Chest',
    type: 'chest',
  },
  {
    position: 34,
    name: 'Pennsylvania Avenue',
    type: 'property',
    price: 320,
    rentLevels: [28, 150, 450, 1000, 1200, 1400],
    colorGroup: 'green'
  },
  {
    position: 35,
    name: 'Short Line',
    type: 'railroad',
    price: 200,
    rentLevels: [25, 50, 100, 200],
  },
  {
    position: 36,
    name: 'Chance',
    type: 'chance',
  },
  {
    position: 37,
    name: 'Park Place',
    type: 'property',
    price: 350,
    rentLevels: [35, 175, 500, 1100, 1300, 1500],
    colorGroup: 'blue'
  },
  {
    position: 38,
    name: 'Luxury Tax',
    type: 'tax',
  },
  {
    position: 39,
    name: 'Boardwalk',
    type: 'property',
    price: 400,
    rentLevels: [50, 200, 600, 1400, 1700, 2000],
    colorGroup: 'blue'
  }
]; 