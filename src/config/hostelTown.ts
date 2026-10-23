// The town outside your hostel (shared world:funaab:hostel, not the campus map). The compound sits at
// the origin with its gate on the +Z wall; the street runs along X in front of it. Come out of the
// gate, turn right (west, −X) and drive past houses and shops to the end of the street, where the
// road goes on to school: it comes out on the campus gate road on the Campus Bet side, and the main
// gate is a short drive east from there. Pure layout: HostelTown.tsx draws it, LocalPlayer reads it.
import type { Point } from './campusLocations';

/** Walk and drive limits for the whole town. */
export const TOWN_BOUNDS = { minX: -166, maxX: 44, minZ: -18, maxZ: 48 };

/** The street: two lanes along X, pavements both sides. */
export const TOWN_ROAD = {
  minX: -166, maxX: 44, minZ: 21, maxZ: 28,
  /** Lane centres: westbound (toward school) nearest the hostel, eastbound on the far side. */
  westLane: 22.8, eastLane: 25,
  /** Kerbside parking on the far side of the street. */
  parkingZ: 27.3,
  pavementNorth: { minZ: 18.6, maxZ: 21 },
  pavementSouth: { minZ: 28, maxZ: 30.4 },
};

/** Where the road leaves town for campus (west end) and where it comes back in. */
export const TOWN_LINK = {
  /** Town side: the "To FUNAAB" arch at the west end. Stop under it to go to school. */
  town: {
    exit: [-156, 0, 24.5] as Point,
    radius: 7,
    /** Arriving from campus: eastbound, at the wheel, or on the south pavement on foot. */
    arriveCar: { position: [-144, 0, TOWN_ROAD.eastLane] as Point, rotation: Math.PI / 2 },
    arriveFoot: [-144, 0, 29.4] as Point,
  },
  /** Campus side: the west end of the gate road, past Campus Bet. */
  campus: {
    exit: [-45, 0, 95.5] as Point,
    radius: 5,
    /** Arriving from town: heading east along the gate road toward the main gate. */
    arriveCar: { position: [-36, 0, 96.6] as Point, rotation: Math.PI / 2 },
    arriveFoot: [-36, 0, 99] as Point,
  },
};

export type TownBuilding = {
  id: string; kind: 'house' | 'shop';
  /** Centre on the ground, footprint X × Z, and the way the front faces (0 = +Z toward the south side, PI = −Z). */
  position: Point; size: [number, number]; height: number; facing: 0 | typeof Math.PI;
  wall: string; roof: string; name?: string; sign?: string;
};

const SHOPS: Array<[string, string, string]> = [
  ['Mama Put Buka', 'MAMA PUT', '#b45309'], ['Barber\'s Palace', 'BARBER', '#1d4ed8'], ['POS & Recharge', 'POS · RECHARGE', '#15803d'],
  ['Provisions Store', 'PROVISIONS', '#b91c1c'], ['Phone Repairs', 'PHONE REPAIRS', '#7c3aed'], ['Pharmacy', 'PHARMACY', '#0f766e'],
  ['Tailor', 'TAILOR', '#be185d'], ['Cyber Café', 'CYBER CAFÉ', '#334155'], ['Suya Spot', 'SUYA SPOT', '#c2410c'],
];
const WALLS = ['#e8d5a9', '#d9c7a1', '#f1e4c6', '#cfd8c4', '#e6c9b5', '#d8d2c2', '#efd9b4'];
const ROOFS = ['#7c2d12', '#334155', '#14532d', '#78350f', '#1e3a8a', '#57534e'];

/** Houses and shops along both sides of the street, set back behind the pavements. */
export const TOWN_BUILDINGS: TownBuilding[] = (() => {
  const out: TownBuilding[] = [];
  let shop = 0, n = 0;
  const add = (x: number, side: 'north' | 'south', w: number, kind: 'house' | 'shop') => {
    const d = kind === 'shop' ? 6 : 9, height = kind === 'shop' ? 3.4 : 3.8;
    const z = side === 'north' ? TOWN_ROAD.pavementNorth.minZ - 1 - d / 2 : TOWN_ROAD.pavementSouth.maxZ + 1 + d / 2;
    const s = kind === 'shop' ? SHOPS[shop++ % SHOPS.length] : null;
    out.push({
      id: `town-${side}-${n}`, kind, position: [x, 0, z], size: [w, d], height, facing: side === 'north' ? 0 : Math.PI,
      wall: s ? '#efe6d2' : WALLS[n % WALLS.length], roof: s ? s[2] : ROOFS[n % ROOFS.length], name: s?.[0], sign: s?.[1],
    });
    n++;
  };
  // North side, west of the compound wall (x < −18): a row of shops near the hostel, then houses.
  [-28, -40, -52].forEach((x) => add(x, 'north', 9, 'shop'));
  [-68, -84, -100, -116, -132].forEach((x, i) => add(x, 'north', i % 2 ? 11 : 12, i === 2 ? 'shop' : 'house'));
  // North side, east of the compound.
  [26, 38].forEach((x) => add(x, 'north', 9, 'house'));
  // South side, facing the hostel gate and on down the street.
  [32, 18, 4, -10].forEach((x, i) => add(x, 'south', i === 2 ? 10 : 11, i === 1 || i === 2 ? 'shop' : 'house'));
  [-26, -42, -58, -76, -94, -112, -130].forEach((x, i) => add(x, 'south', i % 3 === 1 ? 9 : 12, i % 3 === 1 ? 'shop' : 'house'));
  return out;
})();

/** Cars parked along the kerbs (static, solid). Rotation: the way the nose points. */
export const TOWN_PARKED_CARS: Array<{ car: string; paint: string | null; position: Point; rotation: number }> = [
  { car: 'car_corolla', paint: 'white', position: [-34, 0, 27.3], rotation: Math.PI / 2 },
  { car: 'car_camry', paint: null, position: [-63, 0, 27.3], rotation: Math.PI / 2 },
  { car: 'car_picanto', paint: 'blue', position: [12, 0, 27.3], rotation: Math.PI / 2 },
  { car: 'car_lexus', paint: null, position: [-104, 0, 27.3], rotation: Math.PI / 2 },
  { car: 'car_corolla', paint: 'green', position: [-122, 0, 27.3], rotation: Math.PI / 2 },
];

/** Through traffic: cars that run the street end to end, slowing behind anyone on the road. */
export const TOWN_TRAFFIC: Array<{ id: string; car: string; paint: string | null; lane: 'west' | 'east'; speed: number; offset: number }> = [
  { id: 'traffic-1', car: 'car_corolla', paint: 'yellow', lane: 'west', speed: 8, offset: 0 },
  { id: 'traffic-2', car: 'car_camry', paint: 'silver', lane: 'east', speed: 7, offset: 0.35 },
  { id: 'traffic-3', car: 'car_picanto', paint: 'red', lane: 'west', speed: 6.5, offset: 0.6 },
  { id: 'traffic-4', car: 'car_gwagon', paint: null, lane: 'east', speed: 9, offset: 0.85 },
];

/** People walking up and down the pavements (between two X marks). */
export const TOWN_WALKERS: Array<{ id: string; z: number; from: number; to: number; speed: number; offset: number }> = [
  { id: 'town-walker-ade', z: 19.6, from: -150, to: -8, speed: 1.3, offset: 0.1 },
  { id: 'town-walker-bisi', z: 29.3, from: -140, to: 36, speed: 1.1, offset: 0.4 },
  { id: 'town-walker-chidi', z: 20.1, from: -120, to: -20, speed: 1.4, offset: 0.7 },
  { id: 'town-walker-dupe', z: 29.6, from: -60, to: 40, speed: 1.2, offset: 0.2 },
  { id: 'town-walker-emeka', z: 19.4, from: 6, to: 42, speed: 1, offset: 0.55 },
  { id: 'town-walker-funke', z: 29.1, from: -150, to: -70, speed: 1.25, offset: 0.9 },
];

/** Street lamps every so often along both pavements. */
export const TOWN_LAMPS: Point[] = Array.from({ length: 11 }, (_, i) => -150 + i * 19).flatMap((x) => [[x, 0, 19.2] as Point, [x + 9, 0, 29.8] as Point]);

export const inTown = (p: Point) => p[0] >= TOWN_BOUNDS.minX && p[0] <= TOWN_BOUNDS.maxX && p[2] >= TOWN_BOUNDS.minZ && p[2] <= TOWN_BOUNDS.maxZ;

/** The shared hostel-and-town world. You can drive here and on campus (never in rooms or the library). */
export const TOWN_ROOM = 'world:funaab:hostel';
export const CAMPUS_ROOM = 'world:funaab:main';
export const canDriveIn = (room: string) => room === CAMPUS_ROOM || room === TOWN_ROOM;

/** Passed under an arch, walking or driving: which way the road takes you (null: not crossed).
 *  Town: anywhere west of the TO FUNAAB arch. Campus: west of the HOSTEL · TOWN arch, on the gate road. */
export function crossedRoad(room: string, x: number, z: number): 'campus' | 'town' | null {
  if (room === TOWN_ROOM) return x < TOWN_LINK.town.exit[0] ? 'campus' : null;
  if (room === CAMPUS_ROOM) return x < TOWN_LINK.campus.exit[0] - 1 && Math.abs(z - TOWN_LINK.campus.exit[2]) < TOWN_LINK.campus.radius ? 'town' : null;
  return null;
}
