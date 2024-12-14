import { BoardSpace } from './types';

export { BoardSpace };
export const BOARD_SPACES: BoardSpace[] = [
  // Bottom row (right to left)
  { name: "GO", type: "corner", position: 0 },
  { name: "Mediterranean Avenue", type: "property", position: 1, price: 60, color: "brown", rentLevels: [2, 10, 30, 90, 160, 250] },
  { name: "Community Chest", type: "chest", position: 2 },
  { name: "Baltic Avenue", type: "property", position: 3, price: 60, color: "brown", rentLevels: [4, 20, 60, 180, 320, 450] },
  { name: "Income Tax", type: "tax", position: 4, price: 200 },
  { name: "Reading Railroad", type: "railroad", position: 5, price: 200, rentLevels: [25, 50, 100, 200] },
  { name: "Oriental Avenue", type: "property", position: 6, price: 100, color: "light-blue", rentLevels: [6, 30, 90, 270, 400, 550] },
  { name: "Chance", type: "chance", position: 7 },
  { name: "Vermont Avenue", type: "property", position: 8, price: 100, color: "light-blue", rentLevels: [6, 30, 90, 270, 400, 550] },
  { name: "Connecticut Avenue", type: "property", position: 9, price: 120, color: "light-blue", rentLevels: [8, 40, 100, 300, 450, 600] },
  
  // Left column (bottom to top)
  { name: "Jail", type: "corner", position: 10 },
  { name: "St. Charles Place", type: "property", position: 11, price: 140, color: "pink", rentLevels: [10, 50, 150, 450, 625, 750] },
  { name: "Electric Company", type: "utility", position: 12, price: 150 },
  { name: "States Avenue", type: "property", position: 13, price: 140, color: "pink", rentLevels: [10, 50, 150, 450, 625, 750] },
  { name: "Virginia Avenue", type: "property", position: 14, price: 160, color: "pink", rentLevels: [12, 60, 180, 500, 700, 900] },
  { name: "Pennsylvania Railroad", type: "railroad", position: 15, price: 200, rentLevels: [25, 50, 100, 200] },
  { name: "St. James Place", type: "property", position: 16, price: 180, color: "orange", rentLevels: [14, 70, 200, 550, 750, 950] },
  { name: "Community Chest", type: "chest", position: 17 },
  { name: "Tennessee Avenue", type: "property", position: 18, price: 180, color: "orange", rentLevels: [14, 70, 200, 550, 750, 950] },
  { name: "New York Avenue", type: "property", position: 19, price: 200, color: "orange", rentLevels: [16, 80, 220, 600, 800, 1000] },
  
  // Top row (left to right)
  { name: "Free Parking", type: "corner", position: 20 },
  { name: "Kentucky Avenue", type: "property", position: 21, price: 220, color: "red", rentLevels: [18, 90, 250, 700, 875, 1050] },
  { name: "Chance", type: "chance", position: 22 },
  { name: "Indiana Avenue", type: "property", position: 23, price: 220, color: "red", rentLevels: [18, 90, 250, 700, 875, 1050] },
  { name: "Illinois Avenue", type: "property", position: 24, price: 240, color: "red", rentLevels: [20, 100, 300, 750, 925, 1100] },
  { name: "B. & O. Railroad", type: "railroad", position: 25, price: 200, rentLevels: [25, 50, 100, 200] },
  { name: "Atlantic Avenue", type: "property", position: 26, price: 260, color: "yellow", rentLevels: [22, 110, 330, 800, 975, 1150] },
  { name: "Ventnor Avenue", type: "property", position: 27, price: 260, color: "yellow", rentLevels: [22, 110, 330, 800, 975, 1150] },
  { name: "Water Works", type: "utility", position: 28, price: 150 },
  { name: "Marvin Gardens", type: "property", position: 29, price: 280, color: "yellow", rentLevels: [24, 120, 360, 850, 1025, 1200] },
  
  // Right column (top to bottom)
  { name: "Go To Jail", type: "corner", position: 30 },
  { name: "Pacific Avenue", type: "property", position: 31, price: 300, color: "green", rentLevels: [26, 130, 390, 900, 1100, 1275] },
  { name: "North Carolina Avenue", type: "property", position: 32, price: 300, color: "green", rentLevels: [26, 130, 390, 900, 1100, 1275] },
  { name: "Community Chest", type: "chest", position: 33 },
  { name: "Pennsylvania Avenue", type: "property", position: 34, price: 320, color: "green", rentLevels: [28, 150, 450, 1000, 1200, 1400] },
  { name: "Short Line", type: "railroad", position: 35, price: 200, rentLevels: [25, 50, 100, 200] },
  { name: "Chance", type: "chance", position: 36 },
  { name: "Park Place", type: "property", position: 37, price: 350, color: "blue", rentLevels: [35, 175, 500, 1100, 1300, 1500] },
  { name: "Luxury Tax", type: "tax", position: 38, price: 100 },
  { name: "Boardwalk", type: "property", position: 39, price: 400, color: "blue", rentLevels: [50, 200, 600, 1400, 1700, 2000] }
]; 