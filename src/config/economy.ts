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
    FOOD_DELIVERY: {
      id: 'job-food-delivery',
      type: 'delivery' as const,
      title: 'Mama Buka Special Delivery',
      reward: 300,
      icon: '🍲',
      source: 'Tantalizers & Campus Buka',
      sourcePos: [-20, 0, 7] as [number, number, number],
      destination: 'COLFHEC Academic Complex',
      destinationPos: [-28, 0, -26] as [number, number, number],
      description: 'Deliver hot Jollof Rice package from Mama Buka to COLFHEC lecture foyer.',
    },
    CAMPUS_ERRAND: {
      id: 'job-medical-errand',
      type: 'errand' as const,
      title: 'Health Centre Medical Document Dispatch',
      reward: 250,
      icon: '📋',
      source: 'FUNAAB Health Centre',
      sourcePos: [-20, 0, -10] as [number, number, number],
      destination: "Senate & 'Nimbe Adedipe Library",
      destinationPos: [0, 0, -24] as [number, number, number],
      description: 'Dispatch medical records envelope from Health Centre to Senate Registry.',
    },
    SPORTS_ASSISTANT: {
      id: 'job-sports-cones',
      type: 'sports' as const,
      title: 'Sports Centre Pitch Organizer',
      reward: 200,
      icon: '⚽',
      source: 'FUNAAB Sports Centre',
      sourcePos: [-26, 0, 0] as [number, number, number],
      destination: 'Sports Centre Goalpost Area',
      destinationPos: [-36, 0, 0] as [number, number, number],
      description: 'Arrange training cones and check football goalpost nets around the turf.',
    },
    GROUNDS_CLEANUP: {
      id: 'job-grounds-cleanup',
      type: 'grounds' as const,
      title: 'Campus Litter & Notice Inspection',
      reward: 150,
      icon: '🧹',
      source: 'Main Car Park Lot',
      sourcePos: [-22, 0, 20] as [number, number, number],
      destination: 'W-Landmark Plaza',
      destinationPos: [0, 0, 20] as [number, number, number],
      description: 'Collect paper litter and inspect notice boards along the Ceremonial Walkway.',
    },
  },

  // Fares & Expenses
  KEKE_FARES: {
    SHORT: 50,
    MEDIUM: 100,
    LONG: 150,
  },

  // Rules & Fines
  LAWN_FINE: 500,

  // Peer-to-Peer Transfer Constraints
  P2P_MAX_PER_TX: 50000,
  P2P_MIN_PER_TX: 10,
};
