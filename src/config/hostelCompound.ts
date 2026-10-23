// Hostel compound exterior (shared world:funaab:hostel). Pure layout + cosmetic room identity.
// The door numbers are storytelling: entering always goes to world:funaab:hostel-room:<ownerUserId>,
// and room access stays enforced server-side by owner id (hostel_can_enter), never by room number.
import type { Point } from './campusLocations';

export const HOSTEL_COMPOUND_ASSET = 'hostel_compound_main';
/** Courtyard walk limit (square, ±). LocalPlayer clamps to it; the perimeter wall sits just outside. */
export const HOSTEL_COURTYARD_BOUND = 16;
export const HOSTEL_SPAWN: Point = [0, 0, 8];

export const FLOOR_HEIGHT = 3;
export const ROOM_WIDTH = 3.2;
export const ROOMS_PER_FLOOR = 6;
export const FLOORS = 2;
export const BUILDING = {
  minX: -(ROOMS_PER_FLOOR * ROOM_WIDTH) / 2, // -9.6
  maxX: (ROOMS_PER_FLOOR * ROOM_WIDTH) / 2, // 9.6
  backZ: -12.4,
  facadeZ: -7.6, // doors sit on this face
  corridorFrontZ: -5.6, // edge of the ground walkway / upper balcony
};
/** One external flight up the left end: bottom at z=-0.4 on the ground, top lands on floor 1. */
export const STAIRS = { minX: -12.2, maxX: -10.4, bottomZ: -0.4, topZ: BUILDING.corridorFrontZ, steps: 12 };
export const LANDING = { minX: STAIRS.minX, maxX: BUILDING.minX, minZ: BUILDING.facadeZ, maxZ: BUILDING.corridorFrontZ };

export const IYA_IBEJI = { position: [12.6, 0, -1] as Point, door: [10.2, 0, -1] as Point };
export const SECURITY_POST: Point = [8.5, 0, 12.5];
export const SECURITY_RADIUS = 3;

/** Carport in the east corner by the perimeter wall, open toward the gate. Your car lives here
 *  unless you rent at the estate; drive out to campus from it, or tap Park at hostel on campus. */
export const HOSTEL_GARAGE = {
  minX: 12.2, maxX: 16.4, backZ: 4.2, frontZ: 10.8, roofY: 2.7,
  car: [14.3, 0, 7.4] as Point,
  /** Facing +Z: nose out of the carport. */
  rotation: 0,
  /** Where you stand after parking (in front of the carport). */
  stepOut: [13.4, 0, 11.4] as Point,
  /** Drive out prompt: from the car's centre, so standing just in front of the carport counts. */
  radius: 4.6,
};

/** Courtyard seats: the four plastic chairs round the table and two per tree bench.
 *  `rotation` is the way a seated student faces (0 = +Z). */
export const HOSTEL_SEATS = [
  ...[-6.8, -5.2].map((x, i) => ({ id: `hostel-chair-s${i}`, label: 'Plastic Chair', position: [x, 0, 2.2] as Point, rotation: 0 })),
  ...[-6.8, -5.2].map((x, i) => ({ id: `hostel-chair-n${i}`, label: 'Plastic Chair', position: [x, 0, 3.8] as Point, rotation: Math.PI })),
  ...[2.5, 3.5].map((z, i) => ({ id: `hostel-bench-w${i}`, label: 'Tree Bench', position: [3.2, 0, z] as Point, rotation: -Math.PI / 2 })),
  ...[2.5, 3.5].map((z, i) => ({ id: `hostel-bench-e${i}`, label: 'Tree Bench', position: [6.8, 0, z] as Point, rotation: Math.PI / 2 })),
];

export interface HostelDoor { number: number; floor: number; position: Point; stand: Point }
/** Room 1–6 ground floor left→right, 7–12 first floor. `position` is the door's base centre. */
export const HOSTEL_DOORS: HostelDoor[] = Array.from({ length: FLOORS * ROOMS_PER_FLOOR }, (_, i) => {
  const floor = Math.floor(i / ROOMS_PER_FLOOR), k = i % ROOMS_PER_FLOOR;
  const x = BUILDING.minX + ROOM_WIDTH * (k + 0.5) - 0.65, y = floor * FLOOR_HEIGHT;
  return { number: i + 1, floor, position: [x, y, BUILDING.facadeZ], stand: [x, y, BUILDING.facadeZ + 1] };
});

export interface HostelRoomAssignment { block: string; room: number; label: string; short: string }
/** Stable cosmetic room for a user (same id → same door on every device). Shared numbers are fine. */
export function hostelRoomFor(userId: string): HostelRoomAssignment {
  let h = 2166136261;
  for (const c of userId) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  const room = ((h >>> 0) % HOSTEL_DOORS.length) + 1;
  return { block: 'A', room, label: `Block A · Room ${room}`, short: `A${room}` };
}
export const doorFor = (room: number) => HOSTEL_DOORS[room - 1];

/** True when standing in front of a door on the same floor (feet height decides the floor). */
export function isAtDoor(door: HostelDoor, feet: Point, radius = 1.6) {
  return Math.abs(feet[1] - door.position[1]) < 1.2
    && Math.hypot(feet[0] - door.stand[0], feet[2] - door.stand[2]) < radius;
}

// ---------- Collision (single source for the renderer and scripts/test-hostel-compound.ts) ----------
export interface BoxCollider { id: string; half: Point; pos: Point; rot?: Point }
export const STAIR_GEOMETRY = (() => {
  const run = STAIRS.bottomZ - STAIRS.topZ, rise = FLOOR_HEIGHT;
  return { run, rise, angle: Math.atan2(rise, run), hyp: Math.hypot(rise, run), stepRise: rise / STAIRS.steps, stepRun: run / STAIRS.steps,
    width: STAIRS.maxX - STAIRS.minX, cx: (STAIRS.minX + STAIRS.maxX) / 2 };
})();
export const WALL_AT = HOSTEL_COURTYARD_BOUND + 0.6;

export function hostelCompoundColliders(): BoxCollider[] {
  const { minX, maxX, backZ, facadeZ, corridorFrontZ } = BUILDING;
  const H = FLOOR_HEIGHT * 2, cx = (minX + maxX) / 2;
  const slabW = maxX - LANDING.minX, slabCx = (maxX + LANDING.minX) / 2, slabD = corridorFrontZ - facadeZ, slabCz = (corridorFrontZ + facadeZ) / 2;
  const s = STAIR_GEOMETRY, midY = s.rise / 2, midZ = (STAIRS.bottomZ + STAIRS.topZ) / 2;
  const railY = FLOOR_HEIGHT + 0.55, railFrom = STAIRS.maxX;
  const out: BoxCollider[] = [
    { id: 'ground', half: [WALL_AT + 0.5, 0.2, WALL_AT + 0.5], pos: [0, -0.2, 0] },
    { id: 'wall-back', half: [WALL_AT, 1, 0.15], pos: [0, 1, -WALL_AT] },
    { id: 'wall-front', half: [WALL_AT, 1, 0.15], pos: [0, 1, WALL_AT] },
    { id: 'wall-left', half: [0.15, 1, WALL_AT], pos: [-WALL_AT, 1, 0] },
    { id: 'wall-right', half: [0.15, 1, WALL_AT], pos: [WALL_AT, 1, 0] },
    { id: 'room-block', half: [(maxX - minX) / 2, H / 2, (facadeZ - backZ) / 2], pos: [cx, H / 2, (backZ + facadeZ) / 2] },
    { id: 'upper-slab', half: [slabW / 2, 0.1, slabD / 2], pos: [slabCx, FLOOR_HEIGHT - 0.1, slabCz] },
    { id: 'rail-front', half: [(maxX - railFrom) / 2, 0.55, 0.05], pos: [(maxX + railFrom) / 2, railY, corridorFrontZ - 0.05] },
    { id: 'rail-end', half: [0.05, 0.55, slabD / 2], pos: [maxX - 0.05, railY, slabCz] },
    { id: 'rail-landing-side', half: [0.05, 0.55, slabD / 2], pos: [LANDING.minX + 0.05, railY, slabCz] },
    { id: 'rail-landing-back', half: [(LANDING.maxX - LANDING.minX) / 2, 0.55, 0.05], pos: [(LANDING.maxX + LANDING.minX) / 2, railY, LANDING.minZ + 0.05] },
    { id: 'stair-ramp', half: [s.width / 2, 0.05, s.hyp / 2], pos: [s.cx, midY - 0.05, midZ], rot: [s.angle, 0, 0] },
    { id: 'stair-rail-outer', half: [0.05, 0.55, s.hyp / 2], pos: [STAIRS.minX, midY + 0.55, midZ], rot: [s.angle, 0, 0] },
    { id: 'stair-rail-inner', half: [0.05, 0.55, s.hyp / 2], pos: [STAIRS.maxX, midY + 0.55, midZ], rot: [s.angle, 0, 0] },
    { id: 'planter', half: [1.6, 0.2, 1.6], pos: [5, 0.2, 3] },
    { id: 'tree', half: [0.2, 1.5, 0.2], pos: [5, 1.5, 3] },
    { id: 'table', half: [0.45, 0.38, 0.45], pos: [-6, 0.38, 3] },
    { id: 'water-tank', half: [1.1, 1.6, 1.1], pos: [-14, 1.6, -14] },
    { id: 'iya-ibeji', half: [2.2, 1.5, 3], pos: [IYA_IBEJI.position[0], 1.5, IYA_IBEJI.position[2]] },
    { id: 'security-post', half: [1, 1.2, 1], pos: [SECURITY_POST[0], 1.2, SECURITY_POST[2]] },
    { id: 'garage-back', half: [(HOSTEL_GARAGE.maxX - HOSTEL_GARAGE.minX) / 2, HOSTEL_GARAGE.roofY / 2, 0.12], pos: [(HOSTEL_GARAGE.minX + HOSTEL_GARAGE.maxX) / 2, HOSTEL_GARAGE.roofY / 2, HOSTEL_GARAGE.backZ] },
    ...[HOSTEL_GARAGE.backZ + 0.3, HOSTEL_GARAGE.frontZ - 0.2].map((z, i) => ({ id: `garage-post-${i}`, half: [0.1, HOSTEL_GARAGE.roofY / 2, 0.1] as Point, pos: [HOSTEL_GARAGE.minX, HOSTEL_GARAGE.roofY / 2, z] as Point })),
  ];
  // Columns along the balcony edge.
  for (let i = 0; i <= ROOMS_PER_FLOOR; i++) out.push({ id: `column-${i}`, half: [0.14, H / 2, 0.14], pos: [minX + i * ROOM_WIDTH, H / 2, corridorFrontZ - 0.12] });
  // Solid fill under the ramp so nobody walks into the space beneath the stairs.
  for (let i = 1; i < STAIRS.steps; i++) {
    const top = i * s.stepRise;
    out.push({ id: `stair-fill-${i}`, half: [s.width / 2, top / 2, s.stepRun / 2], pos: [s.cx, top / 2, STAIRS.bottomZ - (i + 0.5) * s.stepRun] });
  }
  return out;
}
