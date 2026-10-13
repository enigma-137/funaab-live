// Love Garden: a small shaded sitting garden east of the Library. Just a named place to sit and
// gist — no romance/matching mechanics. Leaf module (no imports) so campusLocations can use it.

type P = [number, number, number];

export const LOVE_GARDEN = {
  id: 'love-garden',
  name: 'Love Garden',
  /** Between the Library (x ≤ 32) and the east road (x ≥ 50); clear of every road and walkway. */
  centre: [43, 0, 0] as P,
  /** Radius used for "N students here" and the zone name. */
  radius: 8,
  benchRing: 4.3,
  benchCount: 6,
  treeTrunkRadius: 0.55,
};

/** Stable keys so Blender-made models can replace the procedural meshes one-for-one. */
export const LOVE_GARDEN_ASSET_KEYS = {
  tree: 'love_garden_tree',
  bench: 'love_garden_bench',
  sign: 'love_garden_sign',
} as const;

// Legal (paved, fine-free) ground. The plaza meets the east road directly; a walkway links it to
// the Library forecourt (which reaches x = 23.5) north of the existing Library garden tree.
export const LOVE_GARDEN_PAVING = {
  plaza: { minX: 35.5, maxX: 50.5, minZ: -7.5, maxZ: 7.5 },
  walkway: { minX: 23, maxX: 44.5, minZ: 12.5, maxZ: 15.5 },
  connector: { minX: 41.5, maxX: 44.5, minZ: 6.5, maxZ: 15.5 },
};

export interface LoveGardenBench {
  index: number;
  /** Bench centre (feet level). */
  position: P;
  /** Avatar/bench yaw: a seated student faces the tree. */
  rotation: number;
  seats: P[];
}

export const LOVE_GARDEN_SEAT_OFFSET = 0.42;

export const loveGardenBenches: LoveGardenBench[] = Array.from({ length: LOVE_GARDEN.benchCount }, (_, index) => {
  // 0°, 60°, …: leaves open gaps at north (the walkway connector) and south.
  const a = (index / LOVE_GARDEN.benchCount) * Math.PI * 2;
  const [cx, , cz] = LOVE_GARDEN.centre;
  const x = cx + Math.cos(a) * LOVE_GARDEN.benchRing;
  const z = cz + Math.sin(a) * LOVE_GARDEN.benchRing;
  // Local +z (the way a sitter faces) points back at the trunk.
  const rotation = Math.atan2(-Math.cos(a), -Math.sin(a));
  const along: [number, number] = [Math.cos(rotation), -Math.sin(rotation)];
  const round = (n: number) => Number(n.toFixed(3));
  const seats = [-1, 1].map((side) => [round(x + along[0] * side * LOVE_GARDEN_SEAT_OFFSET), 0, round(z + along[1] * side * LOVE_GARDEN_SEAT_OFFSET)] as P);
  return { index, position: [round(x), 0, round(z)], rotation, seats };
});

export const isInLoveGarden = (x: number, z: number) =>
  Math.hypot(x - LOVE_GARDEN.centre[0], z - LOVE_GARDEN.centre[2]) <= LOVE_GARDEN.radius;
