import { CAMPUS_JOBS } from './campusJobs';
export const ECONOMY_CONFIG = {
  // Allowances & Starter
  STARTER_BALANCE: 5000,
  DAILY_RESUMPTION_ALLOWANCE: 200,
  ATTENDANCE_ALLOWANCE: 100,

  // Floral World Restaurant Menu (COLFHEC Area)
  FLORAL_WORLD_MENU: [
    { id: 'fw_jollof_chicken', name: 'Jollof Rice + Chicken', price: 1000, icon: '🍗', type: 'food' as const, restaurant: 'floral_world' as const },
    { id: 'fw_fried_chicken', name: 'Fried Rice + Chicken', price: 1000, icon: '🍚', type: 'food' as const, restaurant: 'floral_world' as const },
    { id: 'fw_rice_beef', name: 'Rice + Beef', price: 800, icon: '🥩', type: 'food' as const, restaurant: 'floral_world' as const },
    { id: 'fw_spaghetti', name: 'Spaghetti Special', price: 700, icon: '🍝', type: 'food' as const, restaurant: 'floral_world' as const },
    { id: 'fw_water', name: 'Chilled Bottled Water', price: 150, icon: '💧', type: 'drink' as const, restaurant: 'floral_world' as const },
    { id: 'fw_malt', name: 'Chilled Malt Drink', price: 400, icon: '🥤', type: 'drink' as const, restaurant: 'floral_world' as const },
  ],

  // Campus Job Rewards
  JOBS: {
    FOOD_DELIVERY:CAMPUS_JOBS[0], CAMPUS_ERRAND:CAMPUS_JOBS[1],
    SPORTS_ASSISTANT:CAMPUS_JOBS[2], GROUNDS_CLEANUP:CAMPUS_JOBS[3],
  },

  // Rules & Fines
  LAWN_FINE: 500,

  // Peer-to-Peer Transfer Constraints
  P2P_MAX_PER_TX: 50000,
  P2P_MIN_PER_TX: 10,
};
