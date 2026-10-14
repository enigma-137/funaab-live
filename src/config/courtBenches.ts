// Courtside benches at the Sports Centre courts. One list drives both the 3D benches and the
// sit spots, so every bench you can see is one you can sit on (two students per bench).
import { BASKETBALL_COURT } from './basketball';
import { VOLLEYBALL_COURT } from './volleyball';

type Point = [number, number, number];
export interface CourtBench {
  id: string;
  court: 'basketball' | 'volleyball';
  /** Centre of the seat plank on the ground. */
  position: Point;
  /** Direction a seated student faces (0 = +Z, PI/2 = +X), i.e. toward the court. */
  rotation: number;
}

export const BENCH_LENGTH = 2.6;
/** Seats along each bench, from its centre (metres, along the plank). */
const SEAT_OFFSETS = [-0.65, 0.65];

const [bx, , bz] = BASKETBALL_COURT.centre;
const southZ = bz + BASKETBALL_COURT.width / 2 + 1.3;
const northZ = bz - BASKETBALL_COURT.width / 2 - 1.3;
const [vx, , vz] = VOLLEYBALL_COURT.centre;
const westX = vx - VOLLEYBALL_COURT.width / 2 - 1.5;
const eastX = vx + VOLLEYBALL_COURT.width / 2 + 1.1;

export const COURT_BENCHES: CourtBench[] = [
  // Basketball: south sideline (facing north, either side of the court sign) and north sideline.
  ...[-115, -104, -99].map((x, i) => ({ id: `bb-south-${i}`, court: 'basketball' as const, position: [x, 0, southZ] as Point, rotation: Math.PI })),
  ...[-113, -107, -101].map((x, i) => ({ id: `bb-north-${i}`, court: 'basketball' as const, position: [x, 0, northZ] as Point, rotation: 0 })),
  // Volleyball: both long sidelines.
  ...[vz - 4, vz + 4].map((z, i) => ({ id: `vb-west-${i}`, court: 'volleyball' as const, position: [westX, 0, z] as Point, rotation: Math.PI / 2 })),
  ...[vz - 5.5, vz].map((z, i) => ({ id: `vb-east-${i}`, court: 'volleyball' as const, position: [eastX, 0, z] as Point, rotation: -Math.PI / 2 })),
];

/** A point `along` the plank and `ahead` of it (toward the court), in world space. */
export function benchLocal(b: CourtBench, along: number, ahead = 0): Point {
  const s = Math.sin(b.rotation), c = Math.cos(b.rotation);
  // Plank runs along the bench's local X = (cos r, -sin r); it faces local Z = (sin r, cos r).
  return [b.position[0] + c * along + s * ahead, 0, b.position[2] - s * along + c * ahead];
}

export const courtBenchSeats = COURT_BENCHES.flatMap((b) =>
  SEAT_OFFSETS.map((along, i) => ({
    id: `court-bench-${b.id}-${i}`,
    type: 'bench' as const,
    label: b.court === 'basketball' ? 'Basketball Courtside Bench' : 'Volleyball Courtside Bench',
    actionText: 'Sit & Watch',
    position: benchLocal(b, along),
    radius: 1.2,
    rotation: b.rotation,
  })),
);
