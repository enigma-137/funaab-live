// Campus worship: the Central Mosque (open Fridays) and the Chapel of Grace (open Sundays).
// Both stand all week; on other days their doors stay shut and a sign says when they open.
// Days follow Nigeria time (Africa/Lagos, UTC+1 all year), never the phone's own timezone.
import type { Point } from './campusLocations';

export type WorshipId = 'mosque' | 'chapel';

export interface WorshipPlace {
  id: WorshipId;
  name: string;
  shortName: string;
  /** Centre of the building on campus. The door is in the south (+Z) wall, facing the campus. */
  centre: Point;
  /** Outer size, world X × Z. */
  size: [number, number];
  wallHeight: number;
  doorHalfWidth: number;
  /** Lagos weekday it opens: 0 Sunday … 6 Saturday. */
  openDay: number;
  dayName: string;
}

export const MOSQUE: WorshipPlace = {
  id: 'mosque', name: 'Central Mosque', shortName: 'Mosque',
  centre: [-62, 0, -126], size: [22, 18], wallHeight: 6, doorHalfWidth: 1.8, openDay: 5, dayName: 'Friday',
};
export const CHAPEL: WorshipPlace = {
  id: 'chapel', name: 'Chapel of Grace', shortName: 'Chapel',
  centre: [62, 0, -125], size: [16, 20], wallHeight: 6, doorHalfWidth: 1.6, openDay: 0, dayName: 'Sunday',
};
export const WORSHIP_PLACES = [MOSQUE, CHAPEL];

const LAGOS_OFFSET_MS = 60 * 60 * 1000;
/** Day of the week in Lagos (0 Sunday … 6 Saturday), whatever the device timezone. */
export const lagosWeekday = (ms: number) => new Date(ms + LAGOS_OFFSET_MS).getUTCDay();
export const worshipOpen = (place: WorshipPlace, ms: number) => lagosWeekday(ms) === place.openDay;
/** What the sign at the door says. */
export const worshipSign = (place: WorshipPlace, ms: number) =>
  worshipOpen(place, ms)
    ? place.id === 'mosque' ? "Open today · Jumu'ah" : 'Open today · Sunday service'
    : `Opens on ${place.dayName}`;

export const worshipBounds = (place: WorshipPlace) => {
  const [cx, , cz] = place.centre, [w, d] = place.size;
  return { minX: cx - w / 2, maxX: cx + w / 2, minZ: cz - d / 2, maxZ: cz + d / 2 };
};
export const inWorshipPlace = (place: WorshipPlace, p?: readonly number[] | null) => {
  if (!p) return false;
  const b = worshipBounds(place);
  return p[0] > b.minX && p[0] < b.maxX && p[2] > b.minZ && p[2] < b.maxZ;
};
/** Just outside the door, where the walkway arrives. */
export const worshipEntrance = (place: WorshipPlace): Point => [place.centre[0], 0, place.centre[2] + place.size[1] / 2 + 2.5];

// ---------- Interior layouts (building-local: x east, z south, door at +Z) ----------

/** Prayer mats in rows facing the qibla wall (north, -Z); walkways run between the rows. */
export const MOSQUE_MATS = (() => {
  const mats: Array<{ x: number; z: number }> = [];
  for (let r = 0; r < 6; r++) for (let c = 0; c < 8; c++) mats.push({ x: -7 + c * 2, z: -4.6 + r * 1.75 });
  return mats;
})();
export const MAT_SIZE: [number, number] = [1.1, 1.3];
/** The Imam stands before the mihrab, leading the rows. */
export const IMAM_SPOT: Point = [0, 0, -7];

/** Pews either side of a central aisle, front row nearest the pulpit. */
export const CHAPEL_PEWS = (() => {
  const pews: Array<{ x: number; z: number }> = [];
  for (let r = 0; r < 7; r++) for (const s of [-1, 1]) pews.push({ x: s * 3.4, z: -3.6 + r * 1.55 });
  return pews;
})();
export const PEW_SIZE: [number, number] = [3.6, 0.55];
/** Raised chancel at the north end with the pulpit; the Pastor stands behind it. */
export const CHANCEL = { minZ: -10, maxZ: -6.6, height: 0.35 };
export const PULPIT: Point = [0, 0, -7.2];
export const PASTOR_SPOT: Point = [0, 0, -8.1];

/** Building-local point to world. */
export const worshipPoint = (place: WorshipPlace, x: number, z: number): Point => [place.centre[0] + x, 0, place.centre[2] + z];
/** Three seats per pew, facing the pulpit (north): sit during the Sunday service. */
export const chapelPewSeats = CHAPEL_PEWS.flatMap((p, i) =>
  [-1.1, 0, 1.1].map((dx, j) => ({
    id: `chapel-pew-${i}-${j}`,
    type: 'bench' as const,
    label: 'Chapel pew',
    actionText: 'Sit',
    position: worshipPoint(CHAPEL, p.x + dx, p.z),
    radius: 0.8,
    rotation: Math.PI,
  })),
);
