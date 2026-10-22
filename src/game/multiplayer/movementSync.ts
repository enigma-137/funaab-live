export interface MovementSnapshot {
  position: [number, number, number];
  rotation: number;
  animation: string;
  kekeRiding: boolean;
  /** The car you're driving (config/cars id), or null on foot. */
  car?: string | null;
  /** Its respray colour id (config/cars CAR_PAINTS), or null for the model colour. */
  carPaint?: string | null;
}

export function hasMeaningfulMovementChange(
  previous: MovementSnapshot | null,
  next: MovementSnapshot,
): boolean {
  if (!previous) return true;
  const dx = next.position[0] - previous.position[0];
  const dy = next.position[1] - previous.position[1];
  const dz = next.position[2] - previous.position[2];
  const rotationDelta = Math.abs(Math.atan2(
    Math.sin(next.rotation - previous.rotation),
    Math.cos(next.rotation - previous.rotation),
  ));
  return dx * dx + dy * dy + dz * dz >= 0.12 * 0.12
    || rotationDelta >= 0.06
    || next.animation !== previous.animation
    || next.kekeRiding !== previous.kekeRiding
    || (next.car ?? null) !== (previous.car ?? null)
    || (next.carPaint ?? null) !== (previous.carPaint ?? null);
}
