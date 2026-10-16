// Car race: COLENG → COLFHEC on the campus roads, against two AI rivals. Drive your own car to the
// start line beside COLENG, stop, and tap Race. Purely for fun and bragging rights: nothing is paid
// out, so the whole race runs on the client (your best time is kept on this device).
import { locationById, type Point } from './campusLocations';
import { nodeKey, pathLength, roadPath } from './kekeRoutes';

const from = locationById('coleng').kekeStop, to = locationById('colfhec').kekeStop;
/** The grid sits a little south of the COLENG stop so there's a run-up to the first corner. */
const gridBack = 10;
const road = roadPath(nodeKey(from), nodeKey(to));
const [a, b] = road;
const back: Point = [a[0] - Math.sign(b[0] - a[0]) * gridBack, 0, a[2] - Math.sign(b[2] - a[2]) * gridBack];

export const RACE = {
  name: 'COLENG → COLFHEC',
  /** The racing line: grid, then the road route, finish at the COLFHEC stop. */
  track: [back, ...road] as Point[],
  countdownMs: 3000,
  /** Stop within this distance of the start line to be offered the race. */
  startRadius: 7,
  /** Checkpoints every this many metres; each must be passed (within gateRadius) in order. */
  gateSpacing: 10,
  gateRadius: 7.5,
  /** Lane offsets from the centre line (right is +) for you and the rivals on the grid. */
  laneOffset: 2.6,
  /** Rivals ease off to this speed for the corners. */
  cornerSpeed: 7,
  /** Further than this from the track and you're out of the race. */
  offTrack: 18,
};
export const RACE_LENGTH = pathLength(RACE.track);

export interface Rival { name: string; car: string; paint: string; topSpeed: number; accel: number; lane: number }
export const RIVALS: Rival[] = [
  { name: 'Tunde', car: 'car_camry', paint: 'red', topSpeed: 11.8, accel: 5, lane: -1 },
  { name: 'Amaka', car: 'car_corolla', paint: 'blue', topSpeed: 10.8, accel: 5.5, lane: 1 },
];

/** Point and direction (unit dx, dz) at a distance along a polyline. */
export function pointAlong(path: Point[], dist: number): { x: number; z: number; dx: number; dz: number } {
  let left = Math.max(0, dist);
  for (let i = 1; i < path.length; i++) {
    const p = path[i - 1], q = path[i], len = Math.hypot(q[0] - p[0], q[2] - p[2]);
    if (len === 0) continue;
    const dx = (q[0] - p[0]) / len, dz = (q[2] - p[2]) / len;
    if (left <= len || i === path.length - 1) { const t = Math.min(left, len); return { x: p[0] + dx * t, z: p[2] + dz * t, dx, dz }; }
    left -= len;
  }
  return { x: path[0][0], z: path[0][2], dx: 0, dz: 1 };
}

/** Distance along the polyline of the closest point to (x, z), and how far off the line that is. */
export function projectOnto(path: Point[], x: number, z: number): { along: number; off: number } {
  let best = { along: 0, off: Infinity }, walked = 0;
  for (let i = 1; i < path.length; i++) {
    const p = path[i - 1], q = path[i], len = Math.hypot(q[0] - p[0], q[2] - p[2]);
    if (len === 0) continue;
    const t = Math.max(0, Math.min(len, ((x - p[0]) * (q[0] - p[0]) + (z - p[2]) * (q[2] - p[2])) / len));
    const cx = p[0] + (q[0] - p[0]) * t / len, cz = p[2] + (q[2] - p[2]) * t / len, off = Math.hypot(x - cx, z - cz);
    if (off < best.off) best = { along: walked + t, off };
    walked += len;
  }
  return best;
}

/** Distances along the track of its corners (where rivals slow down and keep to the centre). */
export const RACE_CORNERS: number[] = (() => {
  const out: number[] = [];
  let walked = 0;
  for (let i = 1; i < RACE.track.length - 1; i++) {
    walked += Math.hypot(RACE.track[i][0] - RACE.track[i - 1][0], RACE.track[i][2] - RACE.track[i - 1][2]);
    const p = RACE.track[i - 1], q = RACE.track[i], r = RACE.track[i + 1];
    const turn = Math.abs(Math.atan2(r[0] - q[0], r[2] - q[2]) - Math.atan2(q[0] - p[0], q[2] - p[2])) % (Math.PI * 2);
    if (turn > 0.2 && turn < Math.PI * 2 - 0.2) out.push(walked);
  }
  return out;
})();

/** Checkpoints: evenly along the track, the last one on the finish line. */
export const RACE_GATES: number[] = (() => {
  const out: number[] = [];
  for (let d = RACE.gateSpacing; d < RACE_LENGTH; d += RACE.gateSpacing) out.push(d);
  out.push(RACE_LENGTH);
  return out;
})();

/** Where a car sits on the grid for a lane (-1 left, 0 centre, 1 right), and its heading. */
export function gridSpot(lane: number): { x: number; z: number; heading: number } {
  const s = pointAlong(RACE.track, 0);
  // Right of travel direction (dx, dz) is (-dz, dx) when +Z is forward and +X is the car's left.
  return { x: s.x - s.dz * lane * RACE.laneOffset, z: s.z + s.dx * lane * RACE.laneOffset, heading: Math.atan2(s.dx, s.dz) };
}

export const formatRaceTime = (ms: number) => `${Math.floor(ms / 1000)}.${String(Math.floor((ms % 1000) / 10)).padStart(2, '0')}s`;
