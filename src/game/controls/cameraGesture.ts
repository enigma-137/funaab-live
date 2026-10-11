/**
 * Pointer gesture state machine for the 3D canvas: a primary pointer either
 * drags (rotates the camera) or taps (tap-to-move). Pure so it can be unit-tested.
 */
export const DRAG_THRESHOLD_PX = 8;
export const TAP_MAX_DISTANCE_PX = 10;
export const TAP_MAX_DURATION_MS = 400;

export interface PointerSample {
  pointerId: number;
  x: number;
  y: number;
  time: number;
}

export type GestureResult =
  | { kind: 'none' }
  | { kind: 'rotate'; dx: number; dy: number }
  | { kind: 'tap'; x: number; y: number };

const NONE: GestureResult = { kind: 'none' };

export class CameraGestureTracker {
  private primary: {
    pointerId: number;
    startX: number;
    startY: number;
    lastX: number;
    lastY: number;
    startTime: number;
    dragging: boolean;
    multiTouch: boolean;
  } | null = null;
  private extraPointers = new Set<number>();

  get active(): boolean {
    return this.primary !== null;
  }

  get dragging(): boolean {
    return this.primary?.dragging ?? false;
  }

  down(p: PointerSample): void {
    if (this.primary) {
      // A second finger never rotates and turns the gesture into a non-tap.
      if (p.pointerId !== this.primary.pointerId) {
        this.extraPointers.add(p.pointerId);
        this.primary.multiTouch = true;
      }
      return;
    }
    this.primary = {
      pointerId: p.pointerId,
      startX: p.x,
      startY: p.y,
      lastX: p.x,
      lastY: p.y,
      startTime: p.time,
      dragging: false,
      multiTouch: false,
    };
  }

  move(p: PointerSample): GestureResult {
    const s = this.primary;
    if (!s || s.pointerId !== p.pointerId) return NONE;
    const dx = p.x - s.lastX;
    const dy = p.y - s.lastY;
    s.lastX = p.x;
    s.lastY = p.y;
    if (!s.dragging && Math.hypot(p.x - s.startX, p.y - s.startY) > DRAG_THRESHOLD_PX) {
      s.dragging = true;
      // Apply the movement since touch-down so the first frame of the drag doesn't jump or lose distance.
      return { kind: 'rotate', dx: p.x - s.startX, dy: p.y - s.startY };
    }
    if (!s.dragging || (dx === 0 && dy === 0)) return NONE;
    return { kind: 'rotate', dx, dy };
  }

  up(p: PointerSample): GestureResult {
    if (this.extraPointers.delete(p.pointerId)) return NONE;
    const s = this.primary;
    if (!s || s.pointerId !== p.pointerId) return NONE;
    this.primary = null;
    this.extraPointers.clear();
    const dist = Math.hypot(p.x - s.startX, p.y - s.startY);
    const isTap =
      !s.dragging && !s.multiTouch && dist < TAP_MAX_DISTANCE_PX && p.time - s.startTime < TAP_MAX_DURATION_MS;
    return isTap ? { kind: 'tap', x: p.x, y: p.y } : NONE;
  }

  cancel(pointerId: number): void {
    if (this.extraPointers.delete(pointerId)) return;
    if (this.primary?.pointerId === pointerId) this.reset();
  }

  reset(): void {
    this.primary = null;
    this.extraPointers.clear();
  }
}
