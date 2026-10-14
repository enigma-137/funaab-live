// The Arena: the campus night party & arcade hall. Opens every night (Lagos clock) with a ₦500
// gate fee for the night; inside are a dance floor with party lights, a bar, tic-tac-toe tables
// and a pool table. The database sells tickets and drinks (migration 033); the Worker checks you
// hold tonight's ticket and are inside before letting you play.
import type { Point } from './campusLocations';

export const PARTY_HALL = {
  id: 'party-hall',
  name: 'The Arena · Night Party & Arcade',
  shortName: 'The Arena',
  centre: [128, 0, -45] as Point,
  /** Outer size, world X × Z. The door is in the west wall, facing the campus road. */
  size: [22, 24] as [number, number],
  wallHeight: 5,
  doorHalfWidth: 1.8,
  /** Outside the door, where the walkway from the keke stop arrives. */
  entrance: [113, 0, -45] as Point,
  gateFee: 500,
  /** Open from 19:00 to 05:00, Lagos time. */
  opensMinute: 19 * 60,
  closesMinute: 5 * 60,
};
const [CX, , CZ] = PARTY_HALL.centre;
const [W, D] = PARTY_HALL.size;
export const HALL_BOUNDS = { minX: CX - W / 2, maxX: CX + W / 2, minZ: CZ - D / 2, maxZ: CZ + D / 2 };
/** Inside the walls (with a small margin). */
export const inPartyHall = (p?: readonly number[] | null) =>
  !!p && p[0] > HALL_BOUNDS.minX + 0.2 && p[0] < HALL_BOUNDS.maxX && p[2] > HALL_BOUNDS.minZ && p[2] < HALL_BOUNDS.maxZ;
/** Hall-local offset (x east, z south) to world. */
export const hallPoint = (x: number, z: number): Point => [CX + x, 0, CZ + z];

/** The ticket barrier just inside the door: you can't pass without tonight's ticket. */
export const TICKET_BARRIER = { x: -W / 2 + 2.2, halfWidth: PARTY_HALL.doorHalfWidth + 0.4 };
export const DANCE_FLOOR = { centre: hallPoint(2.5, 0), half: 4 };
export const onDanceFloor = (p?: readonly number[] | null) =>
  !!p && Math.abs(p[0] - DANCE_FLOOR.centre[0]) <= DANCE_FLOOR.half && Math.abs(p[2] - DANCE_FLOOR.centre[2]) <= DANCE_FLOOR.half;
export const DJ_BOOTH = hallPoint(9.2, 0);
/** Bar counter along the north wall; customers stand on its south side. */
export const BAR = { centre: hallPoint(-3, -9.6), length: 7 };
export const ARCADE_TABLES = [
  { id: 'ttt-1', game: 'ttt' as const, label: 'Tic-tac-toe table 1', at: hallPoint(-6.5, 8) },
  { id: 'ttt-2', game: 'ttt' as const, label: 'Tic-tac-toe table 2', at: hallPoint(-2.5, 8) },
  { id: 'pool', game: 'pool' as const, label: 'Pool table', at: hallPoint(5, 8) },
];
export type ArcadeTableId = (typeof ARCADE_TABLES)[number]['id'];
export const TTT_TABLES = ARCADE_TABLES.filter((t) => t.game === 'ttt').map((t) => t.id);
/** Pool cloth in the world is drawn at this scale (cloth 2 m × 1 m → 2.4 m × 1.2 m). */
export const POOL_TABLE_SCALE = 1.2;

// ---------- Hours and the ticket night ----------
const LAGOS_OFFSET_MS = 60 * 60 * 1000; // Africa/Lagos is UTC+1 all year
const lagosMinute = (ms: number) => {
  const d = new Date(ms + LAGOS_OFFSET_MS);
  return d.getUTCHours() * 60 + d.getUTCMinutes();
};
export const partyOpen = (ms: number) => {
  const m = lagosMinute(ms);
  return m >= PARTY_HALL.opensMinute || m < PARTY_HALL.closesMinute;
};
/** A ticket is for one night: 19:00 tonight until 05:00 tomorrow share tonight's date. */
export const partyNight = (ms: number) => new Date(ms + LAGOS_OFFSET_MS - 12 * 3600000).toISOString().slice(0, 10);
/** "Opens 7 PM" / "Open until 5 AM". */
export const partyHoursLabel = (ms: number) => (partyOpen(ms) ? 'Open until 5 AM' : 'Opens 7 PM tonight');
