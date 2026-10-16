import { collegeCatalogue, locationById, type Point } from './campusLocations';

/**
 * One lecture-hall interior serves every college. Each entry only configures identity,
 * where the hall is entered/exited on campus, light theming and seating.
 */
export interface LectureHallConfig {
  id: string; // canonical hall id used by the timetable and lecture definitions
  interactableId: string; // world interactable that opens this hall's timetable board
  collegeCode: string; // exact college code from the catalogue ('CLT' for the shared theatre)
  collegeName: string;
  collegeLocationId: string; // campus location the hall belongs to (map / navigation)
  hallName: string;
  arch: Point; // outdoor entrance arch
  entrance: Point; // [E] interaction point in front of the arch
  exit: Point; // safe return point outside, clear of the arch pillars
  accent: string;
  wall: string;
  seating: { rows: number; cols: number };
  scheduleOffsetMinutes: number;
  legacyInteractable?: boolean; // interactable already defined in world.json
  facing?: number; // yaw of the college facade; arch/entrance/exit step out along it
  builtInArch?: boolean; // the college building's own doorway is the arch; draw only the label
}

export const HALL_MAX_ROWS = 5;
export const HALL_MAX_COLS = 6;
// Step `dz` metres out from a facade that faces `facing` (0 = +Z).
const offset = (p: Point, dz: number, facing = 0): Point => [p[0] + dz * Math.sin(facing), 0, p[2] + dz * Math.cos(facing)];
const collegeName = (code: string) => collegeCatalogue.find((c) => c.code === code)?.name ?? code;
const collegeColor = (code: string) => collegeCatalogue.find((c) => c.code === code)?.color ?? '#16a34a';

// Halls that already had their own campus location and timetable keep their ids and arches.
const legacyHall = (
  id: string,
  interactableId: string,
  collegeCode: string,
  collegeLocationId: string,
  hallName: string,
  rest: Pick<LectureHallConfig, 'accent' | 'wall' | 'seating' | 'scheduleOffsetMinutes'> & { collegeName?: string }
): LectureHallConfig => {
  const location = locationById(id);
  return {
    id,
    interactableId,
    collegeCode,
    collegeName: rest.collegeName ?? collegeName(collegeCode),
    collegeLocationId,
    hallName,
    arch: offset(location.position, 0),
    entrance: offset(location.entrance, 0),
    exit: offset(location.entrance, 2),
    legacyInteractable: true,
    ...rest,
  };
};

// College halls are entered through an arch set 1.5m behind the college forecourt point, between the
// facade and the walkway (walkways reach the forecourt sideways, so they pass in front of the pillars).
const collegeHall = (
  collegeLocationId: string,
  collegeCode: string,
  hallName: string,
  rest: Pick<LectureHallConfig, 'seating' | 'scheduleOffsetMinutes'> & { wall?: string }
): LectureHallConfig => {
  const { entrance: forecourt, facing } = locationById(collegeLocationId);
  return {
    id: `${collegeLocationId}-lecture-hall`,
    interactableId: `lecture-hall-${collegeLocationId}`,
    collegeCode,
    collegeName: collegeName(collegeCode),
    collegeLocationId,
    hallName,
    arch: offset(forecourt, -1.5, facing),
    entrance: offset(forecourt, 0.5, facing),
    exit: offset(forecourt, 2.5, facing),
    facing,
    builtInArch: collegeLocationId === 'colanim' || collegeLocationId === 'colplant',
    accent: collegeColor(collegeCode),
    wall: rest.wall ?? '#f1f5f9',
    seating: rest.seating,
    scheduleOffsetMinutes: rest.scheduleOffsetMinutes,
  };
};

export const LECTURE_HALLS: LectureHallConfig[] = [
  legacyHall('colfhec-lecture-hall', 'lecture-hall-colfhec', 'COLFHEC', 'colfhec', 'COLFHEC Lecture Hall 1', {
    accent: '#16a34a', wall: '#f8fafc', seating: { rows: 5, cols: 6 }, scheduleOffsetMinutes: 0,
  }),
  legacyHall('central-lecture-hall', 'lecture-hall-central', 'CLT', 'central-lecture-hall', 'Central Lecture Theatre (CLT)', {
    collegeName: 'University-wide Lecture Theatre',
    accent: '#3b82f6', wall: '#f1f5f9', seating: { rows: 5, cols: 6 }, scheduleOffsetMinutes: 5,
  }),
  legacyHall('colbios-lecture-hall', 'lecture-hall-colbios', 'COLBIOS', 'colbios', 'COLBIOS Lecture Hall A', {
    accent: '#059669', wall: '#ecfdf5', seating: { rows: 5, cols: 6 }, scheduleOffsetMinutes: 10,
  }),
  collegeHall('coleng', 'COLENG', 'COLENG Lecture Theatre', { seating: { rows: 5, cols: 6 }, scheduleOffsetMinutes: 2, wall: '#eef2f7' }),
  collegeHall('colvet', 'COLVET', 'COLVET Lecture Hall', { seating: { rows: 4, cols: 6 }, scheduleOffsetMinutes: 7 }),
  collegeHall('colanim', 'COLANIM', 'COLANIM Lecture Hall', { seating: { rows: 5, cols: 6 }, scheduleOffsetMinutes: 12, wall: '#fdf6ec' }),
  collegeHall('colplant', 'COLPLANT', 'COLPLANT Lecture Hall', { seating: { rows: 4, cols: 6 }, scheduleOffsetMinutes: 3, wall: '#f3f8ec' }),
  collegeHall('colerm', 'COLERM', 'COLERM Lecture Hall', { seating: { rows: 5, cols: 6 }, scheduleOffsetMinutes: 8, wall: '#eefaf7' }),
  collegeHall('colcoms', 'COLCOMS', 'COLCOMS Lecture Hall', { seating: { rows: 5, cols: 6 }, scheduleOffsetMinutes: 13, wall: '#eef0fb' }),
  collegeHall('collend', 'COLLEND', 'COLLEND Lecture Hall', { seating: { rows: 4, cols: 6 }, scheduleOffsetMinutes: 9, wall: '#fbf3e6' }),
  collegeHall('colamrud', 'COLAMRUD', 'COLAMRUD Lecture Hall', { seating: { rows: 4, cols: 6 }, scheduleOffsetMinutes: 11, wall: '#f1f8ec' }),
  collegeHall('colphys', 'COLPHYS', 'COLPHYS Lecture Hall', { seating: { rows: 5, cols: 6 }, scheduleOffsetMinutes: 4, wall: '#f4f0fb' }),
];

export const DEFAULT_LECTURE_HALL_ID = 'colfhec-lecture-hall';

export const getLectureHall = (id?: string | null): LectureHallConfig =>
  LECTURE_HALLS.find((h) => h.id === id) ?? LECTURE_HALLS[0];

export const lectureHallForCollege = (collegeCode: string) =>
  LECTURE_HALLS.find((h) => h.collegeCode === collegeCode.toUpperCase());

// ─── Shared interior layout (room is 14m wide, 16m deep; stage and board at -Z) ───

export interface HallSeat {
  seatNumber: number;
  pos: Point;
}

/** Desk grid, centred across the room; rows run from the front (-Z) to the back. */
export function hallSeatPositions(hall: Pick<LectureHallConfig, 'seating'>): HallSeat[] {
  const rows = Math.max(1, Math.min(HALL_MAX_ROWS, hall.seating.rows));
  const cols = Math.max(1, Math.min(HALL_MAX_COLS, hall.seating.cols));
  const seats: HallSeat[] = [];
  let seatNumber = 1;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      seats.push({ seatNumber: seatNumber++, pos: [(c - (cols - 1) / 2) * 1.5, 0, -4 + r * 1.8] });
    }
  }
  return seats;
}

/** Where a player stands after walking in through the back door. Clear of desks and NPC spots. */
export const HALL_STANDING_VIEW: Point = [3.2, 2.5, 7.1];

/** Floor spot just inside the back door where you stand on walking in. */
export const HALL_DOOR_SPOT: Point = [4.6, 0, 6.2];

// Walkable floor: inside the walls, in front of the stage edge (z -5.24).
export const HALL_FLOOR = { minX: -6.55, maxX: 6.55, minZ: -4.95, maxZ: 7.55 };

/** Push a standing person (radius `r`) out of the walls, stage and every desk+chair block. */
export function clampToHallFloor(hall: Pick<LectureHallConfig, 'seating'>, x: number, z: number, r = 0.22): [number, number] {
  x = Math.min(HALL_FLOOR.maxX, Math.max(HALL_FLOOR.minX, x));
  z = Math.min(HALL_FLOOR.maxZ, Math.max(HALL_FLOOR.minZ, z));
  for (const { pos } of hallSeatPositions(hall)) {
    // Desk top z -0.3..0.3, chair back at +0.84; desk is 1.1m wide.
    const x0 = pos[0] - 0.56 - r, x1 = pos[0] + 0.56 + r, z0 = pos[2] - 0.32 - r, z1 = pos[2] + 0.86 + r;
    if (x <= x0 || x >= x1 || z <= z0 || z >= z1) continue;
    // Leave by the shortest way out.
    const out = [x - x0, x1 - x, z - z0, z1 - z];
    const m = Math.min(...out);
    if (m === out[0]) x = x0; else if (m === out[1]) x = x1; else if (m === out[2]) z = z0; else z = z1;
  }
  return [x, z];
}

// Avatars face +Z by default; the board is at -Z, so anyone facing the lecturer turns by PI.
export const FACE_BOARD = Math.PI;
// Desk top spans z ±0.3 around the seat position. The chair sits behind it so a seated avatar's
// thighs (0.41m forward of the hips, ~0.52m high) slide under the 0.66m desk underside.
export const CHAIR_OFFSET_Z = 0.55;
export const CHAIR_BACK_Z = CHAIR_OFFSET_Z + 0.27;

/** Seats not taken by real students, nearest the back door first. Every student in a hall is a real player. */
export function freeHallSeats(hall: Pick<LectureHallConfig, 'id' | 'seating'>, taken: Iterable<number> = []): HallSeat[] {
  const blocked = new Set<number>(taken);
  const [vx, , vz] = HALL_STANDING_VIEW;
  return hallSeatPositions(hall)
    .filter((s) => !blocked.has(s.seatNumber))
    .sort((a, b) => Math.hypot(a.pos[0] - vx, a.pos[2] - vz) - Math.hypot(b.pos[0] - vx, b.pos[2] - vz));
}
