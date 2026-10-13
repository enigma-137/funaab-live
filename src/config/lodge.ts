// Off-campus lodge ("self-contain") outside the main gate. Your same room and furniture, restyled,
// for weekly rent. Miss rent past the grace period and you move back to the free hostel room.
// Server copy: supabase/migrations/019_off_campus_lodge.sql (scripts/test-lodge-db.ts checks drift).
type Point = [number, number, number];

export const LODGE = {
  name: 'Isolu Court Lodge',
  weeklyRent: 2000,
  graceDays: 2,
  /** You can pay at most this many weeks ahead. */
  maxPrepaidWeeks: 2,
  /** Owner + guests allowed inside (the hostel allows owner + 4). */
  capacity: 8,
  hostelCapacity: 5,
  /** Building across the gate road, mirroring Campus Bet. */
  position: [22, 0, 103] as Point,
  footprint: [10, 6] as [number, number],
  door: [22, 0, 99.4] as Point,
  frontage: { minX: 15, maxX: 29, minZ: 97, maxZ: 100.5 },
};
