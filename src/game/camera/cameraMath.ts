import type * as THREE from 'three';

/**
 * Mobile swipe sensitivity, normalised to the screen so it feels the same on
 * any phone: a full-width horizontal swipe turns the camera by
 * `yawPerScreenWidth` radians, a full-height vertical swipe tilts it by
 * `pitchPerScreenHeight` radians.
 */
export const MOBILE_CAMERA_SENSITIVITY = {
  yawPerScreenWidth: Math.PI * 1.2,
  pitchPerScreenHeight: Math.PI * 0.5,
};

/** Desktop mouse-drag sensitivity in radians per CSS pixel (unchanged legacy feel). */
export const MOUSE_CAMERA_SENSITIVITY = { yaw: 0.0055, pitch: 0.0035 };

export const CAMERA_PITCH_MIN = -0.2;
export const CAMERA_PITCH_MAX = 0.65;

/** Exponential follow rates (1/s). Higher = tighter. */
export const CAMERA_FOLLOW_RATE_XZ = 25;
export const CAMERA_FOLLOW_RATE_Y = 10;
/** Light smoothing on swipe yaw/pitch to hide uneven touch-event timing (~35ms time constant). */
export const CAMERA_ROTATION_RATE = 30;
/** Follow point snaps instead of gliding when the target jumps further than this (teleport, room change). */
export const CAMERA_SNAP_DISTANCE = 5;

/**
 * Frame-rate independent interpolation factor: applying `lerp(target, dampFactor(rate, dt))`
 * every frame converges at the same speed regardless of frame rate.
 */
export const dampFactor = (rate: number, dt: number): number => {
  if (!(dt > 0)) return 0;
  return 1 - Math.exp(-rate * dt);
};

export const damp = (current: number, target: number, rate: number, dt: number): number =>
  current + (target - current) * dampFactor(rate, dt);

export const clampPitch = (pitch: number): number =>
  Math.max(CAMERA_PITCH_MIN, Math.min(CAMERA_PITCH_MAX, pitch));

/** Converts a pointer drag delta (CSS px) into a yaw/pitch delta in radians. */
export const swipeToRotation = (
  dx: number,
  dy: number,
  viewportWidth: number,
  viewportHeight: number,
  pointerType: string
): [number, number] => {
  if (pointerType === 'mouse') {
    return [-dx * MOUSE_CAMERA_SENSITIVITY.yaw, dy * MOUSE_CAMERA_SENSITIVITY.pitch];
  }
  const w = Math.max(1, viewportWidth);
  const h = Math.max(1, viewportHeight);
  return [
    -(dx / w) * MOBILE_CAMERA_SENSITIVITY.yawPerScreenWidth,
    (dy / h) * MOBILE_CAMERA_SENSITIVITY.pitchPerScreenHeight,
  ];
};

/**
 * One axis of an exponential follow whose target moved from `prevTarget` to `target`
 * during this frame. Integrates f' = rate·(T − f) exactly for a target moving linearly
 * within the frame, so the follow lag behind a moving player is identical at any frame
 * rate or under uneven frame times (plain per-frame damping isn't: its lag varies with dt,
 * which reads as camera shake).
 */
export const followAxis = (
  follow: number,
  prevTarget: number,
  target: number,
  rate: number,
  dt: number
): number => {
  if (!(dt > 0)) return follow;
  const a = Math.exp(-rate * dt);
  const lag = (prevTarget - follow) * a + ((target - prevTarget) / (rate * dt)) * (1 - a);
  return target - lag;
};

/**
 * Moves `follow` toward `target` with separate horizontal/vertical rates and records
 * `target` in `prevTarget`. Snaps on large jumps (teleport, room change). Returns true when it snapped.
 */
export const dampFollow = (
  follow: THREE.Vector3,
  prevTarget: THREE.Vector3,
  target: { x: number; y: number; z: number },
  dt: number
): boolean => {
  const dx = target.x - follow.x;
  const dy = target.y - follow.y;
  const dz = target.z - follow.z;
  const snap = dx * dx + dy * dy + dz * dz > CAMERA_SNAP_DISTANCE * CAMERA_SNAP_DISTANCE;
  if (snap) {
    follow.set(target.x, target.y, target.z);
  } else {
    follow.set(
      followAxis(follow.x, prevTarget.x, target.x, CAMERA_FOLLOW_RATE_XZ, dt),
      followAxis(follow.y, prevTarget.y, target.y, CAMERA_FOLLOW_RATE_Y, dt),
      followAxis(follow.z, prevTarget.z, target.z, CAMERA_FOLLOW_RATE_XZ, dt)
    );
  }
  prevTarget.set(target.x, target.y, target.z);
  return snap;
};

/** Third-person orbit eye position around `center`. Writes into `out`. */
export const orbitPosition = (
  center: { x: number; y: number; z: number },
  yaw: number,
  pitch: number,
  distance: number,
  height: number,
  pitchHeightScale: number,
  out: THREE.Vector3
): THREE.Vector3 =>
  out.set(
    center.x + Math.sin(yaw) * Math.cos(pitch) * distance,
    center.y + height + Math.sin(pitch) * distance * pitchHeightScale,
    center.z + Math.cos(yaw) * Math.cos(pitch) * distance
  );
