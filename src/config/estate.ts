// Royal Gardens Estate: the big-boys option, off campus north of the gate road. Rent a room for
// ₦10,000 a week: your room moves there, doubles in size and gets the estate finish. When the paid
// week runs out you move back to the hostel (your things come with you). Anyone can rent; there is
// always a free room. Server copy: supabase/migrations/044_estate.sql (scripts/test-estate-db.ts).
type Point = [number, number, number];

export const ESTATE = {
  name: 'Royal Gardens Estate',
  shortName: 'Royal Gardens',
  weeklyRent: 10000,
  /** You can pay at most this many weeks ahead. */
  maxPrepaidWeeks: 2,
  /** Owner + guests allowed inside an estate room. */
  capacity: 12,
  /** Walled compound (world X × Z). The gate is in the middle of the south wall, facing campus. */
  bounds: { minX: -42, maxX: 42, minZ: 124, maxZ: 170 },
  wallHeight: 2.6,
  gateHalfWidth: 4,
  /** Private road from the gate road (z≈98) up to the estate gate. */
  accessRoad: { minX: -3.5, maxX: 3.5, minZ: 98, maxZ: 124 },
  /** Inside: driveway from the gate and a street along the houses. */
  driveway: { minX: -3.5, maxX: 3.5, minZ: 124, maxZ: 152 },
  street: { minX: -38, maxX: 38, minZ: 148, maxZ: 153 },
  carPark: { minX: -38, maxX: -9, minZ: 128, maxZ: 144 },
  /** Estate office just inside the gate: rent, renew, go to your room. */
  office: [9, 0, 129] as Point,
  officeDoor: [9, 0, 126.6] as Point,
};

/** Two-storey houses: centre, footprint (X × Z) and which way the front door faces (0 = +Z, PI = -Z, -PI/2 = -X). */
export const ESTATE_HOUSES: Array<{ id: string; centre: Point; size: [number, number]; facing: number; paint: string }> = [
  { id: 'a', centre: [-28, 0, 161], size: [12, 9], facing: Math.PI, paint: '#f1e3c6' },
  { id: 'b', centre: [-9.5, 0, 161], size: [12, 9], facing: Math.PI, paint: '#e9d9e6' },
  { id: 'c', centre: [9.5, 0, 161], size: [12, 9], facing: Math.PI, paint: '#dfe8d8' },
  { id: 'd', centre: [28, 0, 161], size: [12, 9], facing: Math.PI, paint: '#f3dcc4' },
  { id: 'e', centre: [27, 0, 136], size: [12, 14], facing: -Math.PI / 2, paint: '#e4e6ee' },
];
/** Where you stand to use a house's front door (outside it, on the paving). */
export const houseDoor = (h: (typeof ESTATE_HOUSES)[number]): Point => {
  const [x, , z] = h.centre, [w, d] = h.size;
  if (h.facing === Math.PI) return [x, 0, z - d / 2 - 1.2];
  if (h.facing === -Math.PI / 2) return [x - w / 2 - 1.2, 0, z];
  return [x, 0, z + d / 2 + 1.2];
};

export const inEstate = (p?: readonly number[] | null) =>
  !!p && p[0] > ESTATE.bounds.minX && p[0] < ESTATE.bounds.maxX && p[2] > ESTATE.bounds.minZ && p[2] < ESTATE.bounds.maxZ;
