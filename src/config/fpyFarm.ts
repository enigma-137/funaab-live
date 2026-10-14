// FPY Farm: FUNAAB's Teaching & Research Farm, where Farm Practical Year students work in their
// green jumpsuits. A farm shift is a hustle: plant, water, then harvest at three plots. The Worker
// checks each step's place and pace; the database pays (migration 032) under the shared hustle cap.
import type { Point } from './campusLocations';

export const FPY_FARM = {
  id: 'fpy-farm',
  name: 'FPY Teaching & Research Farm',
  /** Fenced plot, world X × Z. The gate is a gap in the west fence facing the campus road. */
  centre: [127, 0, 40] as Point,
  size: [22, 36] as [number, number],
  gate: [115.6, 0, 40] as Point,
  /** Just outside the gate, where the walkway from the keke stop arrives. */
  entrance: [113, 0, 40] as Point,
  shed: [133, 0, 24.5] as Point,
  jumpsuitGreen: '#2f6b2f',
};
export const FARM_BOUNDS = {
  minX: FPY_FARM.centre[0] - FPY_FARM.size[0] / 2,
  maxX: FPY_FARM.centre[0] + FPY_FARM.size[0] / 2,
  minZ: FPY_FARM.centre[2] - FPY_FARM.size[1] / 2,
  maxZ: FPY_FARM.centre[2] + FPY_FARM.size[1] / 2,
};
export const inFarm = (p?: readonly number[] | null) =>
  !!p && p[0] >= FARM_BOUNDS.minX - 2 && p[0] <= FARM_BOUNDS.maxX && p[2] >= FARM_BOUNDS.minZ && p[2] <= FARM_BOUNDS.maxZ;

export const FARM_STEPS = [
  { id: 'plant', label: 'Plant maize seedlings', verb: 'Plant here', icon: '🌱', spot: [120.5, 0, 31] as Point },
  { id: 'water', label: 'Water the cassava', verb: 'Water here', icon: '💧', spot: [127, 0, 47] as Point },
  { id: 'harvest', label: 'Harvest ripe tomatoes', verb: 'Harvest here', icon: '🍅', spot: [133.5, 0, 36] as Point },
] as const;

export const FARM_SHIFT = {
  stepRadius: 2.6,
  /** Each job takes a little while: the next step can't come sooner than this. */
  minStepSeconds: 12,
  /** A shift left half-done expires. */
  expireMinutes: 10,
  pay: 300,
  cooldownMinutes: 5,
};
