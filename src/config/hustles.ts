// Student hustles: five ways to earn beyond campus jobs. The database pays (migration 019), the
// Worker proves presence/time where it matters, and everything shares one daily hustle cap.
// scripts/test-hustles-db.ts checks these numbers against the migration.
import type { Point } from './campusLocations';
import { LOVE_GARDEN } from './loveGarden';
import { FOOTBALL_PITCH } from './football';

export const HUSTLE_RULES = {
  /** Total 'hustle_pay' a student can earn per Lagos day (room shop, POS, tutoring, photos). */
  DAILY_CAP: 2500,
};

/** Room shop: buy a carton from Iya Ibeji, it sells itself while you're away. */
export const SHOP_STOCK = {
  snacks: { id: 'snacks', title: 'Snack carton', icon: '🍪', cost: 600, units: 10, unitPrice: 90 },
  data: { id: 'data', title: 'Data bundle cards', icon: '📶', cost: 1000, units: 10, unitPrice: 130 },
} as const;
export type ShopStockId = keyof typeof SHOP_STOCK;
export const SHOP_RULES = { MINUTES_PER_SALE: 20, MAX_UNITS_IN_SHOP: 30, MAX_SALES_PER_DAY: 15 };

/** POS / recharge kiosk outside the Microfinance Bank. Stay for the whole shift. */
export const POS_KIOSK = {
  booth: [33.2, 0, 77.6] as Point,
  serviceSpot: [31.6, 0, 76.4] as Point,
  radius: 3.5,
  shiftSeconds: 60,
  pay: 250,
  cooldownMinutes: 5,
};

/** Library tutoring: answer 3 questions from the lecture banks while in the Library. */
export const TUTORING = { questions: 3, payPerCorrect: 80, cooldownMinutes: 10, answerMinutes: 5 };

/** Photo spots: your "clients" are the real students standing nearby. */
export const PHOTO_SPOTS: Array<{ id: string; title: string; position: Point; radius: number }> = [
  { id: 'photo-love-garden', title: 'Love Garden photo spot', position: [LOVE_GARDEN.centre[0] - 2.5, 0, LOVE_GARDEN.centre[2] + 6.4], radius: 3 },
  { id: 'photo-sports-centre', title: 'Sports Centre photo spot', position: [FOOTBALL_PITCH.centre[0] + 7, 0, FOOTBALL_PITCH.goalLineZ + 11], radius: 3 },
];
export const PHOTO_RULES = { base: 100, perClient: 100, maxClients: 3, clientRadius: 12, cooldownMinutes: 3 };

/** Player errands: preset tasks only (no free text), reward held in escrow, paid on handover. */
export const ERRAND_KINDS = [
  { id: 'buy_food', title: 'Buy me food', icon: '🍲' },
  { id: 'bring_notes', title: 'Bring my lecture notes', icon: '📒' },
  { id: 'carry_load', title: 'Help me carry my load', icon: '📦' },
  { id: 'queue_for_me', title: 'Hold my spot in the queue', icon: '🧍' },
  { id: 'deliver_message', title: 'Deliver a message', icon: '✉️' },
] as const;
export const ERRAND_RULES = { minReward: 50, maxReward: 1000, maxOpenPerStudent: 2, expiresMinutes: 120, handoverRadius: 5 };
export type ErrandKind = (typeof ERRAND_KINDS)[number]['id'];
