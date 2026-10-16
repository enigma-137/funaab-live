// Timed campus food vendors. Single source of truth for hours, menus and placement.
// Hours and prices are mirrored in supabase/migrations/011_timed_food_vendors.sql (food_vendor_hours,
// food_vendor_items; prices updated by 012_economy_rebalance.sql); scripts/test-food-vendors-db.ts fails if the two drift apart.
// The server (database clock, Africa/Lagos) is authoritative for purchases.
import type { Point } from './campusLocations';
import { BAR } from './partyHall';

export const VENDOR_TIMEZONE = 'Africa/Lagos';

export type FoodVendorId = 'mai_suya' | 'indomie_egg' | 'party_bar';
/** Minutes after local midnight; `close` is exclusive (open at 19:00:00, closed at 23:00:00). */
export interface ServiceWindow { open: number; close: number; label: string }
export interface VendorItem { id: string; name: string; price: number }
export interface FoodVendor {
  id: FoodVendorId;
  name: string;
  icon: string;
  /** Mobile action button text when open. */
  actionLabel: string;
  closedMessage: string;
  windows: ServiceWindow[];
  items: VendorItem[];
  position: Point;
  /** Stall faces this yaw (radians); 0 = facing +z. */
  rotation: number;
  models: { stall: string; npc: string; equipment: string };
}

const hm = (h: number, m = 0) => h * 60 + m;

export const FOOD_VENDORS: Record<FoodVendorId, FoodVendor> = {
  mai_suya: {
    id: 'mai_suya',
    name: 'Mai Suya',
    icon: '🍢',
    actionLabel: 'Buy Suya',
    closedMessage: 'Mai Suya has closed for the night.',
    windows: [{ open: hm(19), close: hm(23), label: 'Night' }],
    items: [
      { id: 'vendor_suya_beef', name: 'Beef Suya', price: 4000 },
      { id: 'vendor_suya_chicken', name: 'Chicken Suya', price: 3500 },
    ],
    // North of the Food Court walkway (z=32), facing the path.
    position: [-61, 0, 37],
    rotation: Math.PI,
    models: { stall: 'vendor_mai_suya_stall', npc: 'vendor_mai_suya_npc', equipment: 'vendor_suya_grill' },
  },
  indomie_egg: {
    id: 'indomie_egg',
    name: 'Indomie & Egg',
    icon: '🍜',
    actionLabel: 'Order',
    closedMessage: 'Indomie & Egg is closed right now.',
    windows: [
      { open: hm(7), close: hm(11), label: 'Breakfast' },
      { open: hm(19), close: hm(23), label: 'Evening' },
    ],
    items: [
      { id: 'vendor_indomie_plain', name: 'Plain Indomie', price: 2500 },
      { id: 'vendor_indomie_egg', name: 'Indomie + Egg', price: 3500 },
    ],
    position: [-69, 0, 37],
    rotation: Math.PI,
    models: { stall: 'vendor_indomie_stall', npc: 'vendor_indomie_npc', equipment: 'vendor_indomie_cooker' },
  },
  // Inside The Arena (party hall); drawn by PartyHall, not as a stall. Open across midnight.
  party_bar: {
    id: 'party_bar',
    name: 'Arena Bar',
    icon: '🍹',
    actionLabel: 'Bar',
    closedMessage: 'The Arena bar opens at 7 PM.',
    windows: [
      { open: hm(0), close: hm(5), label: 'Late night' },
      { open: hm(19), close: hm(24), label: 'Night' },
    ],
    items: [
      { id: 'vendor_party_zobo', name: 'Chilled Zobo', price: 800 },
      { id: 'vendor_party_soda', name: 'Soft drink', price: 500 },
      { id: 'vendor_party_malt', name: 'Malt', price: 800 },
      { id: 'vendor_party_chapman', name: 'Chapman', price: 1500 },
      { id: 'vendor_party_energy', name: 'Energy drink', price: 1200 },
    ],
    position: BAR.centre,
    rotation: 0,
    models: { stall: 'party_bar_counter', npc: 'party_bartender', equipment: 'party_bar_fridge' },
  },
};

export const FOOD_VENDOR_LIST = Object.values(FOOD_VENDORS);
export const vendorItem = (vendorId: FoodVendorId, itemId: string) => FOOD_VENDORS[vendorId]?.items.find((i) => i.id === itemId);

/** Where customers stand: 1.7 m in front of the stall, along its facing direction. */
export const vendorCounter = (v: FoodVendor): Point =>
  [v.position[0] + Math.sin(v.rotation) * 1.7, 0, v.position[2] + Math.cos(v.rotation) * 1.7];

/** Paved plaza around both stalls so the food spot is legal ground (no lawn fines). */
export const VENDOR_PLAZA = { minX: -73, maxX: -57, minZ: 33, maxZ: 40 };

// ---------- Schedule ----------
const DAY_MS = 86400000;

/** Wall-clock parts in Africa/Lagos for an instant, via the IANA database (device timezone ignored). */
function lagosParts(ms: number) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: VENDOR_TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date(ms));
  const get = (t: string) => Number(parts.find((p) => p.type === t)!.value);
  return { y: get('year'), mo: get('month'), d: get('day'), h: get('hour'), mi: get('minute'), s: get('second') };
}
/** UTC instant of local midnight (Africa/Lagos) for the day containing `ms`. */
function lagosMidnight(ms: number) {
  const p = lagosParts(ms);
  const asUtc = Date.UTC(p.y, p.mo - 1, p.d, p.h, p.mi, p.s);
  const offset = asUtc - Math.floor(ms / 1000) * 1000; // local − UTC
  return Date.UTC(p.y, p.mo - 1, p.d) - offset;
}

export interface VendorStatus {
  isOpen: boolean;
  currentWindow: ServiceWindow | null;
  /** Epoch ms when the current window ends (only when open). */
  closesAt: number | null;
  /** Epoch ms of the next opening (only when closed). */
  nextOpensAt: number | null;
  /** e.g. "Open until 11 PM", "Opens 7:00 PM", "Opens 7:00 AM tomorrow". */
  label: string;
  /** Compact form for buttons: "Open until 11 PM" or "Closed · Opens 7 PM". */
  shortLabel: string;
}

const clockLabel = (minutes: number, withMinutes: boolean) => {
  const h = Math.floor(minutes / 60) % 24, m = minutes % 60;
  const hour = h % 12 === 0 ? 12 : h % 12, ampm = h < 12 ? 'AM' : 'PM';
  return withMinutes || m ? `${hour}:${String(m).padStart(2, '0')} ${ampm}` : `${hour} ${ampm}`;
};

export function getVendorStatus(vendorId: FoodVendorId, now: number = Date.now()): VendorStatus {
  const vendor = FOOD_VENDORS[vendorId];
  const midnight = lagosMidnight(now);
  const minute = Math.floor((now - midnight) / 60000);
  const current = vendor.windows.find((w) => minute >= w.open && minute < w.close) ?? null;
  if (current) {
    // A window ending at midnight that carries on in an early-morning window closes then instead.
    const carry = current.close === 1440 ? vendor.windows.find((w) => w.open === 0) : undefined;
    const closesAt = carry ? lagosMidnight(midnight + DAY_MS + 3600000) + carry.close * 60000 : midnight + current.close * 60000;
    const label = `Open until ${clockLabel(carry ? carry.close : current.close, false)}`;
    return { isOpen: true, currentWindow: current, closesAt, nextOpensAt: null, label, shortLabel: label };
  }
  const today = vendor.windows.find((w) => w.open > minute);
  const next = today ?? vendor.windows[0];
  const nextOpensAt = (today ? midnight : lagosMidnight(midnight + DAY_MS + 3600000)) + next.open * 60000;
  const when = today ? '' : ' tomorrow';
  return { isOpen: false, currentWindow: null, closesAt: null, nextOpensAt,
    label: `Opens ${clockLabel(next.open, true)}${when}`, shortLabel: `Closed · Opens ${clockLabel(next.open, false)}${when}` };
}

/** Next instant (epoch ms) at which any vendor opens or closes — lets the world re-render exactly on time. */
export function nextVendorTransition(now: number = Date.now()) {
  return Math.min(...FOOD_VENDOR_LIST.map((v) => { const s = getVendorStatus(v.id, now); return (s.closesAt ?? s.nextOpensAt)!; }));
}
