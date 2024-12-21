export interface ChanceCard {
  title: string;
  description: string;
}

export const CHANCE_CARDS: ChanceCard[] = [
  { title: "Advance to Go (Collect $200)", description: "Move your token directly to GO. Collect $200." },
  { title: "Advance to Illinois Ave.", description: "Move your token to Illinois Avenue. If you pass GO, collect $200." },
  { title: "Advance to St. Charles Place", description: "Move your token to St. Charles Place. If you pass GO, collect $200." },
  { title: "Advance to Boardwalk", description: "Move your token to Boardwalk. If you pass GO, collect $200." },
  { title: "Advance to the nearest Railroad", description: "Move your token to the nearest Railroad and pay the owner rent as per the rules." },
  { title: "Advance to the nearest Utility", description: "Move your token to the nearest Utility and pay the owner rent as per the rules." },
  { title: "Bank pays you dividend of $50", description: "Collect $50 from the bank." },
  { title: "Get Out of Jail Free", description: "This card may be kept until needed or sold. You may use it to get out of Jail." },
  { title: "Go back 3 spaces", description: "Move your token back 3 spaces." },
  { title: "Go to Jail", description: "Go directly to Jail. Do not pass GO. Do not collect $200." },
  { title: "Make general repairs on all your property", description: "You must pay $25 for each house and $100 for each hotel you own." },
  { title: "Pay poor tax of $15", description: "Pay $15 to the bank." },
  { title: "Take a trip to Reading Railroad", description: "Move your token to Reading Railroad. If you pass GO, collect $200." },
  { title: "Take a walk on the Boardwalk", description: "Move your token to Boardwalk. If you pass GO, collect $200." },
  { title: "You have been elected Chairman of the Board", description: "Pay each player $50." },
  { title: "Your building loan matures", description: "Collect $150 from the bank." }
];
