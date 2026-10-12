// Central game-economy values (virtual Naira only). Leaf module: no imports, so any config can use it.
//
// Server-authoritative copies live in supabase/migrations/012_economy_rebalance.sql (starter wallet,
// daily reward, lecture allowance, job rewards + first-job bonus, Game Den rewards, both food menus).
// scripts/test-economy-db.ts replays every migration and fails if the database drifts from this file.
// Prices for Mai Suya / Indomie live in foodVendors.ts and hostel prices in hostelItems.ts, each with
// its own drift test. The client only ever displays these numbers; it never sends an amount to be paid.

export type MenuItem = {
  id: string;
  name: string;
  price: number;
  icon: string;
  type: 'food' | 'drink';
};

// Delivery pay scales with the walking distance between pickup and drop-off (metres).
export const DELIVERY_REWARD_TIERS = [
  { maxDistance: 60, reward: 300 }, // short
  { maxDistance: 100, reward: 400 }, // medium
  { maxDistance: Infinity, reward: 500 }, // long
] as const;
export const deliveryReward = (from: readonly number[], to: readonly number[]) => {
  const distance = Math.hypot(from[0] - to[0], from[2] - to[2]);
  return DELIVERY_REWARD_TIERS.find((t) => distance <= t.maxDistance)!.reward;
};

export const ECONOMY_CONFIG = {
  // Granted once, when a student's wallet is first created. Existing wallets are never topped up.
  STARTER_BALANCE: 7500,
  // Claimable once per 20 hours.
  DAILY_RESUMPTION_ALLOWANCE: 300,
  // Extra pay for the first campus job completed each Africa/Lagos calendar day.
  FIRST_JOB_DAILY_BONUS: 200,
  // Lecture attendance: small, once per lecture per hour, at most this many paid lectures a day.
  ATTENDANCE_ALLOWANCE: 100,
  ATTENDANCE_DAILY_LIMIT: 3,

  // Floral World Restaurant (COLFHEC area). Ids are stable database keys.
  FLORAL_WORLD_MENU: [
    { id: 'fw_jollof_chicken', name: 'Jollof Rice + Chicken', price: 500, icon: '🍗', type: 'food' },
    { id: 'fw_fried_chicken', name: 'Fried Rice + Chicken', price: 500, icon: '🍚', type: 'food' },
    { id: 'fw_rice_beef', name: 'Rice + Beef', price: 450, icon: '🥩', type: 'food' },
    { id: 'fw_spaghetti', name: 'Spaghetti Special', price: 350, icon: '🍝', type: 'food' },
    { id: 'fw_water', name: 'Chilled Bottled Water', price: 50, icon: '💧', type: 'drink' },
    { id: 'fw_malt', name: 'Chilled Malt Drink', price: 150, icon: '🥤', type: 'drink' },
  ] as MenuItem[],

  // Tantalizers / Mama Buka food court stall.
  FOOD_COURT_MENU: [
    { id: 'jollof_chicken', name: 'Jollof Rice & Crispy Chicken', price: 500, icon: '🍗', type: 'food' },
    { id: 'shawarma_beef', name: 'Campus Special Beef Shawarma', price: 600, icon: '🌯', type: 'food' },
    { id: 'suya_spicy', name: 'FUNAAB Evening Beef Suya', price: 400, icon: '🥩', type: 'food' },
    { id: 'cold_water', name: 'Chilled Bottle Water', price: 50, icon: '💧', type: 'drink' },
    { id: 'malt_drink', name: 'Chilled Malt Drink', price: 150, icon: '🥤', type: 'drink' },
  ] as MenuItem[],

  // Campus job pay (database ids). Delivery pay comes from DELIVERY_REWARD_TIERS by route length.
  JOB_REWARDS: {
    'job-medical-errand': 350, // campus errand
    'job-sports-cones': 300, // sports centre task
    'job-game-den': 250, // short controller shift next to the Game Den
  } as Record<string, number>,

  // Game Den penalty matches: non-gambling participation pay, capped per day and per opponent.
  GAME_DEN: {
    WINNER: 250,
    LOSER: 100,
    DRAW: 150,
    DAILY_REWARDED_MATCHES: 6,
    SAME_OPPONENT_DAILY_MATCHES: 2,
    COOLDOWN_MINUTES: 2,
  },

  // Rules & fines
  LAWN_FINE: 500,

  // Iya Ibeji hostel credit: debt is 110% of the price, total open debt capped.
  HOSTEL_CREDIT_LIMIT: 1500,
  HOSTEL_CREDIT_MARKUP_PERCENT: 110,

  // Peer-to-Peer Transfer Constraints
  P2P_MAX_PER_TX: 50000,
  P2P_MIN_PER_TX: 10,
};

// Integer maths to match SQL's exact numeric ceil(price*1.1): in JS 1500*1.1 = 1650.0000000000002.
export const hostelCreditDebt = (price: number) => Math.ceil((price * ECONOMY_CONFIG.HOSTEL_CREDIT_MARKUP_PERCENT) / 100);
export const canBuyOnCredit = (price: number, openDebt = 0) =>
  hostelCreditDebt(price) + openDebt <= ECONOMY_CONFIG.HOSTEL_CREDIT_LIMIT;
export const formatNaira = (amount: number) => `₦${amount.toLocaleString('en-NG')}`;
