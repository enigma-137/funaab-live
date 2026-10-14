// Waypoint guidance maths, shared by the HUD arrow and the 3D ground arrow.
// Angles use the movement convention: atan2(dx, dz), so 0 faces +Z and PI/2 faces +X.

type XZ = readonly [number, number, number] | readonly number[];

const wrap = (a: number) => {
  const r = ((a + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
  return r === -Math.PI ? Math.PI : r;
};

/** World heading from `from` to `to`. */
export const bearingTo = (from: XZ, to: XZ) => Math.atan2(to[0] - from[0], to[2] - from[2]);

/**
 * How far to turn, relative to what the camera is looking at, to face the destination.
 * Radians, clockwise-positive like a screen arrow: 0 = straight up the screen, +PI/2 = right.
 * The orbit camera sits at (sin yaw, cos yaw) from the player, so it looks along yaw + PI.
 */
export const screenTurn = (from: XZ, to: XZ, cameraYaw: number) =>
  wrap(cameraYaw + Math.PI - bearingTo(from, to));

export type TurnHint = 'Straight ahead' | 'Bear left' | 'Bear right' | 'Turn left' | 'Turn right' | 'Turn around';

export function turnHint(turn: number): TurnHint {
  const deg = Math.abs(turn) * 180 / Math.PI;
  const side = turn > 0 ? 'right' : 'left';
  if (deg <= 22) return 'Straight ahead';
  if (deg <= 67) return side === 'right' ? 'Bear right' : 'Bear left';
  if (deg <= 140) return side === 'right' ? 'Turn right' : 'Turn left';
  return 'Turn around';
}

/** Eight-point compass label for the world heading (north is -Z on the campus map). */
export function compassPoint(bearing: number) {
  // Map: up = -Z (north), right = +X (east). Convert to a clockwise-from-north angle.
  const fromNorth = (wrap(Math.PI - bearing) + Math.PI * 2) % (Math.PI * 2);
  return ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.round(fromNorth / (Math.PI / 4)) % 8];
}
