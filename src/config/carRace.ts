// Car race: the Campus Grand Prix, one lap of the campus roads against two AI rivals. Start and finish
// on the road beside COLENG; the lap runs north up the east road, across past the W landmark, down the
// central boulevard past the Library, west past COLFHEC, south to the Mosque corner, along the south
// road and back up to COLENG. Drive your own car to the START arch, stop, and tap Race.
// Prizes (₦3,000 / ₦1,500 / ₦500, three paid races a Lagos day) are paid only when the Worker has
// watched the lap itself: it follows your trusted position through the same checkpoints with
// stepRace() and works out your place against the same rivals (rivalProgress), then the database
// pays (migration 050). The game runs the race for the screen; it never says what to pay.
import { locationById, type Point } from './campusLocations';
import { pathLength } from './kekeRoutes';
import { CAR_MODELS } from './cars';

const coleng = locationById('coleng').kekeStop, mosque = locationById('mosque').kekeStop;
/** The grid sits a little south of the COLENG stop. */
const grid: Point = [coleng[0], 0, coleng[2] - 10];
export const RACE = {
  name: 'Campus Grand Prix',
  route: 'COLENG → Library → COLFHEC → Mosque → COLENG',
  /** The racing line, corner to corner along the road centre lines; it ends where it starts. */
  track: [grid, [55, 0, 45], [0, 0, 45], [0, 0, -40], [mosque[0], 0, -40], mosque, [55, 0, -85], grid] as Point[],
  /** Landmarks passed on the lap, for the signs and the progress bar. */
  landmarks: ['w-landmark', 'library', 'colfhec', 'mosque'],
  /** You need this much fuel in the tank to start (a lap burns about 2 litres). */
  minFuel: 3,
  countdownMs: 3000,
  /** Stop within this distance of the start line to be offered the race. */
  startRadius: 7,
  /** Checkpoints every this many metres; each must be passed (within gateRadius) in order. */
  gateSpacing: 10,
  gateRadius: 7.5,
  /** Lane offsets from the centre line (right is +) for you and the rivals on the grid. */
  laneOffset: 2.6,
  /** Rivals ease off to this speed for the corners. */
  cornerSpeed: 6,
  /** Further than this from the track and you're out of the race. */
  offTrack: 18,
};
export const RACE_LENGTH = pathLength(RACE.track);

export interface Rival { name: string; car: string; paint: string; topSpeed: number; accel: number; lane: number }
export const RIVALS: Rival[] = [
  { name: 'Tunde', car: 'car_camry', paint: 'red', topSpeed: 11, accel: 4.5, lane: -1 },
  { name: 'Amaka', car: 'car_corolla', paint: 'blue', topSpeed: 10.4, accel: 5, lane: 1 },
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

/**
 * Distance along the polyline of the closest point to (x, z), and how far off the line that is.
 * `range` limits the search to part of the line (the lap starts and ends in the same place, so the
 * race only looks near where you should be).
 */
export function projectOnto(path: Point[], x: number, z: number, range: [number, number] = [-Infinity, Infinity]): { along: number; off: number } {
  let best = { along: 0, off: Infinity }, walked = 0;
  for (let i = 1; i < path.length; i++) {
    const p = path[i - 1], q = path[i], len = Math.hypot(q[0] - p[0], q[2] - p[2]);
    if (len === 0) continue;
    const lo = Math.max(0, range[0] - walked), hi = Math.min(len, range[1] - walked);
    if (lo <= hi) {
      const t = Math.max(lo, Math.min(hi, ((x - p[0]) * (q[0] - p[0]) + (z - p[2]) * (q[2] - p[2])) / len));
      const cx = p[0] + (q[0] - p[0]) * t / len, cz = p[2] + (q[2] - p[2]) * t / len, off = Math.hypot(x - cx, z - cz);
      if (off < best.off) best = { along: walked + t, off };
    }
    walked += len;
  }
  return best;
}

/** Over the finish line: at or past it along the final straight, and on the road. */
export function crossedFinish(x: number, z: number): boolean {
  const f = pointAlong(RACE.track, RACE_LENGTH);
  return (x - f.x) * f.dx + (z - f.z) * f.dz >= -0.3 && Math.abs((x - f.x) * f.dz - (z - f.z) * f.dx) < RACE.gateRadius;
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

/** Prize by place (1st, 2nd, 3rd), paid at most this many times a Lagos day. Mirrored in migration 050. */
export const RACE_PRIZES = [3000, 1500, 500];
export const RACE_PRIZE_DAILY_LIMIT = 3;
/** No car can lap faster than its top speed all the way round: anything quicker is not paid. */
export const minLapMs = (car: string) => Math.ceil((RACE_LENGTH / (CAR_MODELS[car]?.topSpeed ?? 16)) * 1000);

/** Rivals ease off for corners: the fastest they may go this far before the next one. */
function rivalLimit(dist: number, top: number) {
  const next = RACE_CORNERS.find((c) => c > dist - 3);
  if (next === undefined) return top;
  // v² = corner² + 2·brake·gap, with a gentle 6 m/s² brake.
  return Math.min(top, Math.sqrt(RACE.cornerSpeed ** 2 + 12 * Math.max(0, next - dist)));
}

/** The rivals' laps, stepped once at 60 Hz: distance covered by each 1/60 s, and their finish times. */
const STEP_MS = 1000 / 60;
const rivalTables: number[][] = RIVALS.map((r) => {
  const out = [0];
  let d = 0, v = 0;
  while (d < RACE_LENGTH && out.length < 60 * 300) {
    v = Math.min(rivalLimit(d, r.topSpeed), v + r.accel / 60);
    d = Math.min(RACE_LENGTH, d + v / 60);
    out.push(d);
  }
  return out;
});
/** Where rival i is (metres along the lap) this long after the green light. Same on every device. */
export function rivalProgress(i: number, ms: number): number {
  const t = rivalTables[i], k = Math.max(0, ms) / STEP_MS, j = Math.floor(k);
  if (j >= t.length - 1) return t[t.length - 1];
  return t[j] + (t[j + 1] - t[j]) * (k - j);
}
export const RIVAL_FINISH_MS = rivalTables.map((t) => Math.round((t.length - 1) * STEP_MS));
/** Your place if you cross the line this long after the green light (1 = won). */
export const finishPlace = (ms: number) => 1 + RIVAL_FINISH_MS.filter((f) => f < ms).length;

/** Closest distance from (px, pz) to the move from a to b. */
function sweptDistance(px: number, pz: number, ax: number, az: number, bx: number, bz: number) {
  const dx = bx - ax, dz = bz - az, len2 = dx * dx + dz * dz;
  const t = len2 > 0 ? Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / len2)) : 0;
  return Math.hypot(px - (ax + dx * t), pz - (az + dz * t));
}

/**
 * One move during the race, from (fromX, fromZ) to (x, z): the checkpoints passed (a slow phone can
 * jump metres in a frame, so the whole move counts), where you are on the lap (looking only near your
 * last checkpoint, since start and finish share a spot), and whether you've left the route or finished.
 * The game and the Worker both run this, so they agree on every checkpoint.
 */
export function stepRace(gate: number, fromX: number, fromZ: number, x: number, z: number): { gate: number; along: number; off: boolean; finished: boolean } {
  while (gate < RACE_GATES.length) {
    const g = pointAlong(RACE.track, RACE_GATES[gate]);
    const passed = gate === RACE_GATES.length - 1 ? crossedFinish(x, z) : sweptDistance(g.x, g.z, fromX, fromZ, x, z) < RACE.gateRadius;
    if (!passed) break;
    gate++;
  }
  const last = gate > 0 ? RACE_GATES[gate - 1] : 0;
  const me = projectOnto(RACE.track, x, z, [last - 20, last + RACE.gateSpacing + 20]);
  return { gate, along: me.along, off: me.off > RACE.offTrack, finished: gate >= RACE_GATES.length };
}

export const formatRaceTime = (ms: number) => `${Math.floor(ms / 1000)}.${String(Math.floor((ms % 1000) / 10)).padStart(2, '0')}s`;
