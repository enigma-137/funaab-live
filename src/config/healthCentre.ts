import { locationById, type Point } from './campusLocations';

// Walk-in clinic inside the main campus world: no room switch, so other players are visible inside.
export const HEALTH_CENTRE = locationById('health-centre');
const [ox, , oz] = HEALTH_CENTRE.position;
export const toWorld = (x: number, y: number, z: number): Point => [ox + x, y, oz + z];

// Local frame: +z faces the campus road. Walls sit on these lines; the door is centred on the front wall.
export const HC = {
  halfWidth: 6.5,
  back: -4.5,
  front: 3,
  wall: 0.25,
  height: 3.4,
  doorHalf: 0.95,
  doorHeight: 2.5,
  porchFront: 4.9,
};
// Footprint of the walkable floor, used to cut the roof away while the local player is inside.
export const HC_INTERIOR = {
  minX: ox - HC.halfWidth, maxX: ox + HC.halfWidth,
  minZ: oz + HC.back, maxZ: oz + HC.front + 0.4,
};

export const BED = { width: 1.0, length: 2.0, top: 0.62, headZ: -4.15 };
export const BED_XS = [-4.8, -1.6, 1.6, 4.8];

// Sit: the sit pose drops the hip .39 to suit a .5m bench, so lift it to the mattress.
// Lie: the sleep pose pivots at the feet; .11 lifts the avatar's back onto the mattress.
export const bedSpots = BED_XS.flatMap((x, i) => {
  const side = x < 0 ? 1 : -1; // sit on the edge that faces the room's centre
  return [
    {
      id: `health-bed-${i + 1}-sit`,
      type: 'bench' as const,
      label: `Ward Bed ${i + 1}`,
      actionText: 'Sit on Bed',
      position: toWorld(x + side * 0.82, 0, -2.85),
      seat: toWorld(x + side * 0.28, BED.top - 0.5, -2.85),
      rotation: side * Math.PI / 2,
      radius: 0.9,
      pose: 'sit' as const,
      exit: toWorld(x + side * 0.95, 0, -2.85),
    },
    {
      id: `health-bed-${i + 1}-lie`,
      type: 'bench' as const,
      label: `Ward Bed ${i + 1}`,
      actionText: 'Lie on Bed',
      position: toWorld(x, 0, -1.55),
      seat: toWorld(x, BED.top + 0.11, -2.35),
      rotation: 0,
      radius: 0.85,
      pose: 'sleep' as const,
      exit: toWorld(x, 0, -1.5),
    },
  ];
});

export const WAITING_BENCHES = [-2.2, 2.2];
export const waitingSpots = WAITING_BENCHES.flatMap((x, b) =>
  [-0.5, 0.5].map((dx, i) => ({
    id: `health-waiting-${b}-${i}`,
    type: 'bench' as const,
    label: 'Health Centre Waiting Bench',
    actionText: 'Sit and Wait',
    position: toWorld(x + dx, 0, 2.02),
    rotation: Math.PI,
    radius: 0.7,
    exit: toWorld(x + dx, 0, 1.3),
  })),
);

// Nurses are scenery: they idle at their posts or walk the ward aisle and never take input.
export type NurseSpec = { id: string; name: string } & ({ post: Point; rotation: number } | { route: [Point, Point] });
export const NURSES: NurseSpec[] = [
  { id: 'nurse-station', name: 'Nurse Adeola', post: toWorld(-5.4, 0, 0.6), rotation: Math.PI / 2 },
  { id: 'nurse-pharmacy', name: 'Pharm. Bisi', post: toWorld(5.4, 0, 0.6), rotation: -Math.PI / 2 },
  { id: 'nurse-ward', name: 'Nurse Tunde', route: [toWorld(-4.8, 0, -1.4), toWorld(4.8, 0, -1.4)] },
];
