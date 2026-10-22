// FUNAAB Fitness Gym: a ₦1,000 pass per session, open mornings (6–10 AM) and evenings (4–9 PM),
// Lagos time. Inside: treadmills, dumbbells, a squat rack, a punching bag and skipping mats. The
// database sells the pass (migration 055); the Worker checks you hold this session's pass and are
// at the station before a workout counts, and gives XP for each finished set.
import type { Point } from './campusLocations';

export const GYM = {
  id: 'gym',
  name: 'FUNAAB Fitness Gym',
  shortName: 'Gym',
  centre: [128, 0, -78] as Point,
  /** Outer size, world X × Z. The door is in the west wall, facing the campus road. */
  size: [20, 16] as [number, number],
  wallHeight: 4.5,
  doorHalfWidth: 1.6,
  /** Outside the door, where the walkway from the keke stop arrives. */
  entrance: [113, 0, -78] as Point,
  fee: 1000,
  /** One set at a station, in seconds. */
  setSeconds: 20,
};

export const GYM_SESSIONS = [
  { id: 'am', label: 'Morning', opens: 6 * 60, closes: 10 * 60, hours: '6–10 AM' },
  { id: 'pm', label: 'Evening', opens: 16 * 60, closes: 21 * 60, hours: '4–9 PM' },
] as const;
export type GymSession = (typeof GYM_SESSIONS)[number];

const [CX, , CZ] = GYM.centre;
const [W, D] = GYM.size;
export const GYM_BOUNDS = { minX: CX - W / 2, maxX: CX + W / 2, minZ: CZ - D / 2, maxZ: CZ + D / 2 };
/** Inside the walls (with a small margin). */
export const inGym = (p?: readonly number[] | null) =>
  !!p && p[0] > GYM_BOUNDS.minX + 0.2 && p[0] < GYM_BOUNDS.maxX && p[2] > GYM_BOUNDS.minZ && p[2] < GYM_BOUNDS.maxZ;
/** Gym-local offset (x east, z south) to world. */
export const gymPoint = (x: number, z: number): Point => [CX + x, 0, CZ + z];
/** The pass barrier just inside the door. */
export const GYM_BARRIER = { x: -W / 2 + 2, halfWidth: GYM.doorHalfWidth + 0.4 };

// ---------- Workouts ----------
export const WORKOUT_POSES = ['jog', 'lift', 'squat', 'punch', 'skip'] as const;
export type WorkoutPose = (typeof WORKOUT_POSES)[number];
export const isWorkoutPose = (v: unknown): v is WorkoutPose => WORKOUT_POSES.includes(v as WorkoutPose);

/**
 * Stations: `spot` is where you stand, `yaw` the way you face (0 faces +Z), `deck` how high the
 * floor under you is (the treadmill belt). `kind` picks the equipment drawn there.
 */
export const GYM_STATIONS = [
  { id: 'treadmill-1', kind: 'treadmill', label: 'Treadmill 1', verb: 'Run on the treadmill', pose: 'jog', spot: gymPoint(-3, -5.6), yaw: Math.PI, deck: 0.18, icon: '🏃' },
  { id: 'treadmill-2', kind: 'treadmill', label: 'Treadmill 2', verb: 'Run on the treadmill', pose: 'jog', spot: gymPoint(0, -5.6), yaw: Math.PI, deck: 0.18, icon: '🏃' },
  { id: 'dumbbells', kind: 'dumbbells', label: 'Dumbbell rack', verb: 'Lift dumbbells', pose: 'lift', spot: gymPoint(4.5, -4.6), yaw: Math.PI, deck: 0, icon: '🏋️' },
  { id: 'squat-rack', kind: 'squat', label: 'Squat rack', verb: 'Do squats', pose: 'squat', spot: gymPoint(7.2, 0), yaw: -Math.PI / 2, deck: 0, icon: '🦵' },
  { id: 'punching-bag', kind: 'bag', label: 'Punching bag', verb: 'Hit the bag', pose: 'punch', spot: gymPoint(3, 4.6), yaw: 0, deck: 0, icon: '🥊' },
  { id: 'skipping', kind: 'mat', label: 'Skipping mat', verb: 'Skip rope', pose: 'skip', spot: gymPoint(-2.5, 4.4), yaw: 0, deck: 0.02, icon: '🪢' },
] as const satisfies ReadonlyArray<{ id: string; kind: string; label: string; verb: string; pose: WorkoutPose; spot: Point; yaw: number; deck: number; icon: string }>;
export type GymStation = (typeof GYM_STATIONS)[number];
export type GymStationId = GymStation['id'];
export const gymStation = (id: unknown) => GYM_STATIONS.find((s) => s.id === id);
/** How close to a station's spot you must be to use it. */
export const STATION_REACH = 2.6;

// ---------- Hours and the pass ----------
const LAGOS_OFFSET_MS = 60 * 60 * 1000; // Africa/Lagos is UTC+1 all year
const lagos = (ms: number) => new Date(ms + LAGOS_OFFSET_MS);
const lagosMinute = (ms: number) => {
  const d = lagos(ms);
  return d.getUTCHours() * 60 + d.getUTCMinutes();
};
/** The session open right now, or null between sessions. */
export const gymSession = (ms: number): GymSession | null => {
  const m = lagosMinute(ms);
  return GYM_SESSIONS.find((s) => m >= s.opens && m < s.closes) ?? null;
};
export const gymOpen = (ms: number) => !!gymSession(ms);
/** A pass is for one session: "2026-10-22-am". Null while the gym is closed. */
export const gymPassKey = (ms: number) => {
  const s = gymSession(ms);
  return s ? `${lagos(ms).toISOString().slice(0, 10)}-${s.id}` : null;
};
/** "Open until 10 AM" / "Opens 4 PM" / "Opens 6 AM tomorrow". */
export const gymHoursLabel = (ms: number) => {
  const s = gymSession(ms);
  const clock = (min: number) => `${((Math.floor(min / 60) + 11) % 12) + 1} ${min < 720 ? 'AM' : 'PM'}`;
  if (s) return `Open until ${clock(s.closes)}`;
  const m = lagosMinute(ms);
  const next = GYM_SESSIONS.find((x) => m < x.opens);
  return next ? `Opens ${clock(next.opens)}` : `Opens ${clock(GYM_SESSIONS[0].opens)} tomorrow`;
};
