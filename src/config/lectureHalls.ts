import { collegeCatalogue, locationById, type Point } from './campusLocations';

/**
 * One lecture-hall interior serves every college. Each entry only configures identity,
 * where the hall is entered/exited on campus, light theming, seating and the NPC crowd.
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
  npcs: { seated: number; standing: number };
  scheduleOffsetMinutes: number;
  legacyInteractable?: boolean; // interactable already defined in world.json
}

export const HALL_MAX_ROWS = 5;
export const HALL_MAX_COLS = 6;
const offset = (p: Point, dz: number): Point => [p[0], 0, p[2] + dz];
const collegeName = (code: string) => collegeCatalogue.find((c) => c.code === code)?.name ?? code;
const collegeColor = (code: string) => collegeCatalogue.find((c) => c.code === code)?.color ?? '#16a34a';

// Halls that already had their own campus location and timetable keep their ids and arches.
const legacyHall = (
  id: string,
  interactableId: string,
  collegeCode: string,
  collegeLocationId: string,
  hallName: string,
  rest: Pick<LectureHallConfig, 'accent' | 'wall' | 'seating' | 'npcs' | 'scheduleOffsetMinutes'> & { collegeName?: string }
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
  rest: Pick<LectureHallConfig, 'seating' | 'npcs' | 'scheduleOffsetMinutes'> & { wall?: string }
): LectureHallConfig => {
  const forecourt = locationById(collegeLocationId).entrance;
  return {
    id: `${collegeLocationId}-lecture-hall`,
    interactableId: `lecture-hall-${collegeLocationId}`,
    collegeCode,
    collegeName: collegeName(collegeCode),
    collegeLocationId,
    hallName,
    arch: offset(forecourt, -1.5),
    entrance: offset(forecourt, 0.5),
    exit: offset(forecourt, 2.5),
    accent: collegeColor(collegeCode),
    wall: rest.wall ?? '#f1f5f9',
    seating: rest.seating,
    npcs: rest.npcs,
    scheduleOffsetMinutes: rest.scheduleOffsetMinutes,
  };
};

export const LECTURE_HALLS: LectureHallConfig[] = [
  legacyHall('colfhec-lecture-hall', 'lecture-hall-colfhec', 'COLFHEC', 'colfhec', 'COLFHEC Lecture Hall 1', {
    accent: '#16a34a', wall: '#f8fafc', seating: { rows: 5, cols: 6 }, npcs: { seated: 14, standing: 3 }, scheduleOffsetMinutes: 0,
  }),
  legacyHall('central-lecture-hall', 'lecture-hall-central', 'CLT', 'central-lecture-hall', 'Central Lecture Theatre (CLT)', {
    collegeName: 'University-wide Lecture Theatre',
    accent: '#3b82f6', wall: '#f1f5f9', seating: { rows: 5, cols: 6 }, npcs: { seated: 16, standing: 2 }, scheduleOffsetMinutes: 5,
  }),
  legacyHall('colbios-lecture-hall', 'lecture-hall-colbios', 'COLBIOS', 'colbios', 'COLBIOS Lecture Hall A', {
    accent: '#059669', wall: '#ecfdf5', seating: { rows: 5, cols: 6 }, npcs: { seated: 12, standing: 3 }, scheduleOffsetMinutes: 10,
  }),
  collegeHall('coleng', 'COLENG', 'COLENG Lecture Theatre', { seating: { rows: 5, cols: 6 }, npcs: { seated: 15, standing: 3 }, scheduleOffsetMinutes: 2, wall: '#eef2f7' }),
  collegeHall('colvet', 'COLVET', 'COLVET Lecture Hall', { seating: { rows: 4, cols: 6 }, npcs: { seated: 11, standing: 2 }, scheduleOffsetMinutes: 7 }),
  collegeHall('colanim', 'COLANIM', 'COLANIM Lecture Hall', { seating: { rows: 5, cols: 6 }, npcs: { seated: 12, standing: 3 }, scheduleOffsetMinutes: 12, wall: '#fdf6ec' }),
  collegeHall('colplant', 'COLPLANT', 'COLPLANT Lecture Hall', { seating: { rows: 4, cols: 6 }, npcs: { seated: 10, standing: 3 }, scheduleOffsetMinutes: 3, wall: '#f3f8ec' }),
  collegeHall('colerm', 'COLERM', 'COLERM Lecture Hall', { seating: { rows: 5, cols: 6 }, npcs: { seated: 13, standing: 2 }, scheduleOffsetMinutes: 8, wall: '#eefaf7' }),
  collegeHall('colcoms', 'COLCOMS', 'COLCOMS Lecture Hall', { seating: { rows: 5, cols: 6 }, npcs: { seated: 14, standing: 3 }, scheduleOffsetMinutes: 13, wall: '#eef0fb' }),
  collegeHall('colphys', 'COLPHYS', 'COLPHYS Lecture Hall', { seating: { rows: 5, cols: 6 }, npcs: { seated: 13, standing: 3 }, scheduleOffsetMinutes: 4, wall: '#f4f0fb' }),
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

// Avatars face +Z by default; the board is at -Z, so anyone facing the lecturer turns by PI.
export const FACE_BOARD = Math.PI;
// Desk top spans z ±0.3 around the seat position. The chair sits behind it so a seated avatar's
// thighs (0.41m forward of the hips, ~0.52m high) slide under the 0.66m desk underside.
export const CHAIR_OFFSET_Z = 0.55;
export const CHAIR_BACK_Z = CHAIR_OFFSET_Z + 0.27;

// Side and back aisles, ≥2.4m apart and ≥1.2m from desks, walls and the standing view.
const STANDING_SPOTS: Array<{ pos: Point; rotY: number }> = [
  { pos: [-5.7, 0, -3.2], rotY: FACE_BOARD },
  { pos: [-5.7, 0, 0.4], rotY: Math.PI / 2 }, // turned toward the class
  { pos: [-5.7, 0, 3.6], rotY: FACE_BOARD - 0.4 },
  { pos: [5.7, 0, -2.4], rotY: FACE_BOARD },
  { pos: [5.7, 0, 1.2], rotY: -Math.PI / 2 },
  { pos: [-2.6, 0, 5.9], rotY: FACE_BOARD },
];

export interface HallNpc {
  id: string;
  seatNumber?: number; // seated NPCs
  pos: Point; // seated NPCs: desk position; standing NPCs: floor position
  rotY: number;
  animation: 'sit' | 'idle';
}

// Small deterministic PRNG so every visit to a hall shows the same crowd.
function rng(seedText: string) {
  let s = 2166136261;
  for (const ch of seedText) s = Math.imul(s ^ ch.charCodeAt(0), 16777619);
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** NPC students for a hall. Always leaves at least 6 seats free for real players. */
export function hallNpcPopulation(hall: Pick<LectureHallConfig, 'id' | 'seating' | 'npcs'>): HallNpc[] {
  const seats = hallSeatPositions(hall);
  const random = rng(hall.id);
  const order = seats.map((s) => s.seatNumber);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  const seatedCount = Math.max(0, Math.min(hall.npcs.seated, seats.length - 6));
  const seated: HallNpc[] = order.slice(0, seatedCount).sort((a, b) => a - b).map((seatNumber) => ({
    id: `${hall.id}-npc-${seatNumber}`,
    seatNumber,
    pos: seats[seatNumber - 1].pos,
    rotY: FACE_BOARD,
    animation: 'sit',
  }));
  const spots = [...STANDING_SPOTS];
  const standing: HallNpc[] = [];
  for (let i = 0; i < Math.min(hall.npcs.standing, spots.length); i++) {
    const [spot] = spots.splice(Math.floor(random() * spots.length), 1);
    standing.push({ id: `${hall.id}-npc-standing-${i}`, pos: spot.pos, rotY: spot.rotY, animation: 'idle' });
  }
  return [...seated, ...standing];
}

/** Seats not used by NPCs or by `taken` (real students), nearest the back door first. */
export function freeHallSeats(hall: Pick<LectureHallConfig, 'id' | 'seating' | 'npcs'>, taken: Iterable<number> = []): HallSeat[] {
  const blocked = new Set<number>(taken);
  for (const npc of hallNpcPopulation(hall)) if (npc.seatNumber) blocked.add(npc.seatNumber);
  const [vx, , vz] = HALL_STANDING_VIEW;
  return hallSeatPositions(hall)
    .filter((s) => !blocked.has(s.seatNumber))
    .sort((a, b) => Math.hypot(a.pos[0] - vx, a.pos[2] - vz) - Math.hypot(b.pos[0] - vx, b.pos[2] - vz));
}
