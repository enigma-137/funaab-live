import assert from "node:assert/strict";
import { Vector3 } from "three";
import {
  CAMERA_PITCH_MAX,
  CAMERA_PITCH_MIN,
  MOBILE_CAMERA_SENSITIVITY,
  MOUSE_CAMERA_SENSITIVITY,
  clampPitch,
  damp,
  dampFactor,
  dampFollow,
  orbitPosition,
  swipeToRotation,
} from "../src/game/camera/cameraMath";
import { CameraGestureTracker } from "../src/game/controls/cameraGesture";

const close = (a: number, b: number, eps: number, msg: string) =>
  assert.ok(Math.abs(a - b) <= eps, `${msg}: ${a} vs ${b}`);

// --- Frame-rate independence -------------------------------------------------
// Simulate a player walking at 6 m/s for 2s and track how far the camera follow
// point lags behind. With per-frame lerp constants this lag depends on fps
// (the source of mobile shake when frame times vary); with dampFollow it must not.
function followLagAt(fps: number): number {
  const dt = 1 / fps;
  const follow = new Vector3(0, 0.85, 0);
  const prev = new Vector3(0, 0.85, 0);
  const target = { x: 0, y: 0.85, z: 0 };
  for (let t = 0; t < 2; t += dt) {
    target.z += 6 * dt;
    dampFollow(follow, prev, target, dt);
  }
  return target.z - follow.z;
}
const lags = [30, 60, 90, 120, 144].map(followLagAt);
for (const lag of lags) close(lag, lags[1], 1e-3, "steady follow lag must not depend on fps");
assert.ok(lags[1] < 0.35, `follow lag should stay tight, got ${lags[1]}`);

// Same for scalar damping (yaw smoothing).
const settle = (fps: number) => {
  let v = 0;
  for (let i = 0; i < fps * 0.1; i++) v = damp(v, 1, 30, 1 / fps);
  return v;
};
close(settle(30), settle(120), 0.01, "yaw damping must be frame-rate independent");
assert.ok(settle(60) > 0.94, "yaw smoothing must reach ~95% within 100ms (no input lag)");

// Uneven frame times (variable-rate mobile display) produce the same result as steady ones.
{
  // Player walking at 6 m/s, rendered at steady 60fps vs. erratic frame times.
  const steady = new Vector3();
  const steadyPrev = new Vector3();
  const jittery = new Vector3();
  const jitteryPrev = new Vector3();
  for (let i = 1; i <= 60; i++) dampFollow(steady, steadyPrev, { x: (6 * i) / 60, y: 0, z: 0 }, 1 / 60);
  const pattern = [1 / 120, 1 / 40, 1 / 90, 1 / 72];
  let elapsed = 0;
  for (let i = 0; elapsed < 1 - 1e-9; i++) {
    const dt = Math.min(pattern[i % pattern.length], 1 - elapsed);
    elapsed += dt;
    dampFollow(jittery, jitteryPrev, { x: 6 * elapsed, y: 0, z: 0 }, dt);
  }
  close(jittery.x, steady.x, 1e-6, "variable frame times must converge identically");
}

assert.equal(dampFactor(10, 0), 0, "zero dt must not move");
assert.equal(dampFactor(10, -1), 0, "negative dt must not move");
assert.ok(dampFactor(10, 10) <= 1, "factor never overshoots");

// Teleports snap instead of sweeping the camera across campus.
{
  const f = new Vector3(0, 0, 0);
  assert.equal(dampFollow(f, new Vector3(), { x: 50, y: 0, z: 0 }, 1 / 60), true);
  assert.equal(f.x, 50);
}

// --- Orbit + pitch limits ---------------------------------------------------
assert.equal(clampPitch(5), CAMERA_PITCH_MAX);
assert.equal(clampPitch(-5), CAMERA_PITCH_MIN);
assert.equal(clampPitch(0.3), 0.3);
{
  const out = new Vector3();
  for (const yaw of [0, Math.PI / 2, Math.PI, -Math.PI / 2, 37.5]) {
    for (const pitch of [CAMERA_PITCH_MIN, 0.15, CAMERA_PITCH_MAX]) {
      orbitPosition({ x: 10, y: 0.85, z: -20 }, yaw, pitch, 8.2, 3.6, 0.6, out);
      assert.ok(Number.isFinite(out.x) && Number.isFinite(out.y) && Number.isFinite(out.z));
      assert.ok(out.y > 0.85 + 2, "camera stays above the player's head");
      close(Math.hypot(out.x - 10, out.z + 20), 8.2 * Math.cos(pitch), 1e-9, "orbit radius");
    }
  }
}

// --- Swipe sensitivity -------------------------------------------------------
{
  const [yaw, pitch] = swipeToRotation(-390, 0, 390, 844, "touch");
  close(yaw, MOBILE_CAMERA_SENSITIVITY.yawPerScreenWidth, 1e-9, "full-width swipe yaw");
  assert.equal(pitch, 0);
  // Old behaviour needed ~1140px for a full turn; a phone-width swipe must now turn > 180°.
  assert.ok(yaw > Math.PI, "a single phone-width swipe turns more than 180°");
  const [, p2] = swipeToRotation(0, 844, 390, 844, "touch");
  close(p2, MOBILE_CAMERA_SENSITIVITY.pitchPerScreenHeight, 1e-9, "full-height pitch");
  // Same physical fraction of the screen → same rotation on different phones.
  close(swipeToRotation(100, 0, 400, 800, "touch")[0], swipeToRotation(200, 0, 800, 800, "touch")[0], 1e-9, "screen-normalised");
  // Desktop mouse feel unchanged.
  const [my, mp] = swipeToRotation(100, 50, 1920, 1080, "mouse");
  close(my, -100 * MOUSE_CAMERA_SENSITIVITY.yaw, 1e-12, "mouse yaw");
  close(mp, 50 * MOUSE_CAMERA_SENSITIVITY.pitch, 1e-12, "mouse pitch");
  assert.equal(MOUSE_CAMERA_SENSITIVITY.yaw, 0.0055);
  assert.equal(MOUSE_CAMERA_SENSITIVITY.pitch, 0.0035);
}

// --- Gesture handling ---------------------------------------------------------
const P = (pointerId: number, x: number, y: number, time = 0) => ({ pointerId, x, y, time });
{
  // Quick tap → tap-to-move, never rotates.
  const g = new CameraGestureTracker();
  g.down(P(1, 100, 100, 0));
  assert.equal(g.move(P(1, 103, 102, 50)).kind, "none");
  assert.deepEqual(g.up(P(1, 103, 102, 120)), { kind: "tap", x: 103, y: 102 });
  assert.equal(g.active, false);
}
{
  // Drag → rotation deltas sum to the full finger travel (no lost distance at threshold), no tap.
  const g = new CameraGestureTracker();
  g.down(P(1, 100, 100));
  let total = 0;
  for (let x = 102; x <= 200; x += 2) {
    const r = g.move(P(1, x, 100, x));
    if (r.kind === "rotate") total += r.dx;
  }
  assert.equal(total, 100);
  assert.equal(g.dragging, true);
  assert.equal(g.up(P(1, 200, 100, 300)).kind, "none");
}
{
  // Second finger: never rotates, and the gesture can no longer become a tap.
  const g = new CameraGestureTracker();
  g.down(P(1, 100, 100));
  g.down(P(2, 300, 300));
  assert.equal(g.move(P(2, 360, 300)).kind, "none", "secondary pointer must not rotate");
  assert.equal(g.up(P(2, 360, 300)).kind, "none");
  assert.equal(g.up(P(1, 101, 100, 100)).kind, "none", "multi-touch must not tap-to-move");
}
{
  // Slow press (long hold) is not a tap.
  const g = new CameraGestureTracker();
  g.down(P(1, 100, 100, 0));
  assert.equal(g.up(P(1, 100, 100, 900)).kind, "none");
}
{
  // Cancel / app switch resets cleanly; stray moves/ups afterwards are ignored.
  const g = new CameraGestureTracker();
  g.down(P(1, 100, 100));
  g.move(P(1, 160, 100));
  g.cancel(1);
  assert.equal(g.active, false);
  assert.equal(g.move(P(1, 200, 100)).kind, "none");
  assert.equal(g.up(P(1, 200, 100)).kind, "none");
  // Next gesture works normally.
  g.down(P(3, 50, 50, 1000));
  assert.equal(g.up(P(3, 50, 50, 1100)).kind, "tap");
  // Move without down is ignored.
  assert.equal(new CameraGestureTracker().move(P(9, 1, 1)).kind, "none");
}

console.log("mobile camera tests passed");
