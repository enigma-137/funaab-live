// Hostel compound: layout, cosmetic room identity, and REAL collision — the exact collider list the
// game renders is loaded into Rapier and walked with LocalPlayer's character-controller settings.
// Run: npm run test:hostel:compound
import assert from 'node:assert/strict';
import RAPIER from '@dimforge/rapier3d-compat';
import {
  BUILDING, FLOOR_HEIGHT, HOSTEL_COURTYARD_BOUND, HOSTEL_DOORS, HOSTEL_GARAGE, HOSTEL_GATE_HALF, HOSTEL_SPAWN, IYA_IBEJI, LANDING, SECURITY_POST, STAIRS,
  STAIR_GEOMETRY, doorFor, hostelCompoundColliders, hostelRoomFor, isAtDoor,
} from '../src/config/hostelCompound';
import { CAR_MODELS, DRIVE } from '../src/config/cars';

type V3 = [number, number, number];

// ---------- Layout + identity ----------
assert.equal(HOSTEL_DOORS.length, 12, '12 room doors');
assert.deepEqual(HOSTEL_DOORS.map((d) => d.number), Array.from({ length: 12 }, (_, i) => i + 1), 'numbered 1–12');
assert.deepEqual([...new Set(HOSTEL_DOORS.map((d) => d.floor))], [0, 1], 'two floors');
for (const d of HOSTEL_DOORS) {
  assert(d.position[0] > BUILDING.minX && d.position[0] < BUILDING.maxX, `door ${d.number} on the facade`);
  assert.equal(d.position[1], d.floor * FLOOR_HEIGHT);
}
const gaps = HOSTEL_DOORS.slice(1, 6).map((d, i) => d.position[0] - HOSTEL_DOORS[i].position[0]);
assert(gaps.every((g) => g > 2.5), 'doors are spaced, not overlapping');
const ids = Array.from({ length: 5000 }, (_, i) => `${i.toString(16).padStart(8, '0')}-0000-4000-8000-${(i * 7919).toString(16).padStart(12, '0')}`);
const rooms = ids.map((id) => hostelRoomFor(id).room);
assert(rooms.every((r) => r >= 1 && r <= 12), 'assignment in range');
assert.equal(new Set(rooms).size, 12, 'every door gets used');
const counts = Array.from({ length: 12 }, (_, i) => rooms.filter((r) => r === i + 1).length);
assert(Math.min(...counts) > 5000 / 12 * 0.6, `reasonably even spread ${counts}`);
assert.deepEqual(hostelRoomFor(ids[42]), hostelRoomFor(ids[42]), 'stable for a user');
assert.match(hostelRoomFor(ids[7]).label, /^Block A · Room \d+$/);
const upstairs = doorFor(7), below = doorFor(1);
assert(isAtDoor(upstairs, upstairs.stand) && !isAtDoor(upstairs, [upstairs.stand[0], 0, upstairs.stand[2]]), 'upstairs door needs you upstairs');
assert(isAtDoor(below, below.stand) && !isAtDoor(below, [below.stand[0], 3, below.stand[2]]));
assert(STAIR_GEOMETRY.angle < (40 * Math.PI) / 180, 'stairs are climbable (< 40°)');
assert(STAIR_GEOMETRY.stepRise < 0.3, 'each step below autostep height');
for (const p of [HOSTEL_SPAWN, IYA_IBEJI.door, SECURITY_POST, [STAIRS.minX, 0, STAIRS.bottomZ] as V3]) {
  assert(Math.abs(p[0]) <= HOSTEL_COURTYARD_BOUND + 1 && Math.abs(p[2]) <= HOSTEL_COURTYARD_BOUND + 1, `${p} inside the compound`);
}

// ---------- Real physics walk ----------
async function main() {
  await RAPIER.init();
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  for (const c of hostelCompoundColliders()) {
    const q = new RAPIER.Quaternion(0, 0, 0, 1);
    if (c.rot) { const [x] = c.rot; q.x = Math.sin(x / 2); q.w = Math.cos(x / 2); }
    world.createCollider(RAPIER.ColliderDesc.cuboid(...c.half).setTranslation(...c.pos).setRotation(q));
  }
  const HALF = 0.5, RADIUS = 0.35, CENTER = HALF + RADIUS, SPEED = 6, DT = 1 / 60;
  const body = world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(HOSTEL_SPAWN[0], CENTER, HOSTEL_SPAWN[2]));
  const collider = world.createCollider(RAPIER.ColliderDesc.capsule(HALF, RADIUS), body);
  const controller = world.createCharacterController(0.04);
  controller.enableAutostep(0.3, 0.2, true);
  controller.enableSnapToGround(0.5);
  controller.setSlideEnabled(true);
  controller.setMaxSlopeClimbAngle((45 * Math.PI) / 180);
  controller.setMinSlopeSlideAngle((50 * Math.PI) / 180);
  world.step();
  const feet = (): V3 => { const t = body.translation(); return [t.x, t.y - CENTER, t.z]; };
  const place = (p: V3) => { body.setTranslation({ x: p[0], y: p[1] + CENTER, z: p[2] }, true); world.step(); };
  // Same per-frame logic as LocalPlayer: horizontal intent + gentle gravity, resolved by the controller.
  const walk = (to: V3, maxSeconds = 12) => {
    for (let t = 0; t < maxSeconds; t += DT) {
      const f = feet(), dx = to[0] - f[0], dz = to[2] - f[2], dist = Math.hypot(dx, dz);
      if (dist < 0.15) break;
      const step = Math.min(dist, SPEED * DT);
      controller.computeColliderMovement(collider, { x: (dx / dist) * step, y: -9.81 * DT * 0.5, z: (dz / dist) * step });
      const m = controller.computedMovement(), cur = body.translation();
      body.setNextKinematicTranslation({ x: cur.x + m.x, y: Math.max(CENTER, cur.y + m.y), z: cur.z + m.z });
      world.step();
    }
    return feet();
  };
  const near = (a: V3, b: V3, tol = 0.35) => Math.hypot(a[0] - b[0], a[2] - b[2]) < tol;
  const sx = STAIR_GEOMETRY.cx;

  // 1. Spawn → bottom of the stairs (ground level).
  let p = walk([sx, 0, STAIRS.bottomZ + 1.2]);
  assert(near(p, [sx, 0, STAIRS.bottomZ + 1.2]) && p[1] < 0.2, `reach stair foot ${p}`);
  // 2. Up the flight to the landing: feet end on the first floor.
  p = walk([sx, 0, (LANDING.minZ + LANDING.maxZ) / 2]);
  assert(p[1] > FLOOR_HEIGHT - 0.15 && p[1] < FLOOR_HEIGHT + 0.25, `climbed to floor 1, feet y=${p[1].toFixed(2)}`);
  // 3. Along the balcony to Room 10's door; the HUD's door check agrees.
  const room10 = doorFor(10);
  p = walk(room10.stand);
  assert(near(p, room10.stand) && Math.abs(p[1] - FLOOR_HEIGHT) < 0.25, `walked balcony to room 10 ${p}`);
  assert(isAtDoor(room10, p), 'Enter Room prompt shows at your upstairs door');
  // 4. Railing holds: try to walk off the balcony edge toward the courtyard.
  p = walk([room10.stand[0], 0, BUILDING.corridorFrontZ + 4], 2);
  assert(p[2] < BUILDING.corridorFrontZ && p[1] > FLOOR_HEIGHT - 0.2, `balcony rail blocks the drop ${p}`);
  // 5. Far end rail and the room facade are solid.
  p = walk([BUILDING.maxX + 3, 0, room10.stand[2]], 3);
  assert(p[0] < BUILDING.maxX && p[1] > FLOOR_HEIGHT - 0.2, `end rail holds ${p}`);
  p = walk([room10.stand[0], 0, BUILDING.facadeZ - 2], 2);
  assert(p[2] > BUILDING.facadeZ, `cannot walk into the rooms ${p}`);
  // 6. Landing outer side + back rails.
  place([sx, FLOOR_HEIGHT, (LANDING.minZ + LANDING.maxZ) / 2]);
  p = walk([LANDING.minX - 3, 0, (LANDING.minZ + LANDING.maxZ) / 2], 2);
  assert(p[0] > LANDING.minX && p[1] > FLOOR_HEIGHT - 0.2, `landing side rail holds ${p}`);
  p = walk([sx, 0, LANDING.minZ - 3], 2);
  assert(p[2] > LANDING.minZ && p[1] > FLOOR_HEIGHT - 0.2, `landing back rail holds ${p}`);
  // 7. Back down the stairs to the courtyard.
  p = walk([sx, 0, STAIRS.bottomZ + 2]);
  assert(near(p, [sx, 0, STAIRS.bottomZ + 2]) && p[1] < 0.2, `descended to ground ${p}`);
  // 8. Stair side rails: from mid-flight, sideways is blocked both ways.
  place([sx, FLOOR_HEIGHT / 2 + 0.05, (STAIRS.bottomZ + STAIRS.topZ) / 2]);
  p = walk([STAIRS.minX - 3, 0, (STAIRS.bottomZ + STAIRS.topZ) / 2], 1.5);
  assert(p[0] > STAIRS.minX && p[1] > 0.8, `outer stair rail holds ${p}`);
  p = walk([STAIRS.maxX + 3, 0, (STAIRS.bottomZ + STAIRS.topZ) / 2], 1.5);
  assert(p[0] < STAIRS.maxX && p[1] > 0.8, `inner stair rail holds ${p}`);
  // 9. From the ground you cannot tunnel into the solid stair mass from its side.
  place([STAIRS.maxX + 0.6, 0, STAIRS.topZ + 1]);
  p = walk([STAIRS.minX - 1, 0, STAIRS.topZ + 1], 2);
  assert(p[0] > STAIRS.maxX - 0.05, `stair side is solid at ground level ${p}`);
  // 10. Ground floor: walk under the balcony to Room 3, which is blocked by nothing.
  place(HOSTEL_SPAWN);
  const room3 = doorFor(3);
  p = walk(room3.stand);
  assert(near(p, room3.stand) && p[1] < 0.2 && isAtDoor(room3, p), `ground-floor door reachable under the balcony ${p}`);
  // 11. Iya Ibeji door is reachable from the courtyard; the shop body is solid.
  place(HOSTEL_SPAWN);
  p = walk([IYA_IBEJI.door[0] - 0.6, 0, IYA_IBEJI.door[2] + 0.6]);
  assert(near(p, [IYA_IBEJI.door[0] - 0.6, 0, IYA_IBEJI.door[2] + 0.6], 0.5), `reach Iya Ibeji ${p}`);
  p = walk([IYA_IBEJI.position[0] + 1, 0, IYA_IBEJI.door[2]], 2);
  assert(p[0] < IYA_IBEJI.position[0] - 2, `cannot walk into the shop ${p}`);
  // 12. Perimeter wall holds either side of the gate; the gate itself is open onto the street.
  place(HOSTEL_SPAWN);
  p = walk([-10, 0, HOSTEL_COURTYARD_BOUND + 6], 6);
  assert(p[2] < HOSTEL_COURTYARD_BOUND + 0.6, `perimeter wall holds ${p}`);
  place(HOSTEL_SPAWN);
  p = walk([0, 0, HOSTEL_COURTYARD_BOUND + 6]);
  assert(p[2] > HOSTEL_COURTYARD_BOUND + 4, `walk out of the open gate ${p}`);
  // 13. The biggest car drives out of the garage: west under the carport, then a left turn through the
  //     gate, with LocalPlayer's driving model (the car turns about its centre at a 2.5 m radius).
  place([0, 0, -40]);
  const k = CAR_MODELS.car_gwagon.scale, car = new RAPIER.Cuboid(DRIVE.half[0] * k, DRIVE.half[1], DRIVE.half[2] * k);
  const [gx, , gz] = HOSTEL_GARAGE.car, r = 2.5, turnX = 0 + r;
  const path: Array<[number, number, number]> = [];
  for (let x = gx; x >= turnX; x -= 0.2) path.push([x, gz, -Math.PI / 2]);
  for (let a = 0; a <= Math.PI / 2 + 1e-6; a += Math.PI / 60) path.push([turnX - r * Math.sin(a), gz + r - r * Math.cos(a), -Math.PI / 2 + a]);
  for (let z = gz + r; z < HOSTEL_COURTYARD_BOUND + 6; z += 0.2) path.push([0, z, 0]);
  assert(Math.abs(path.at(-1)![0]) < HOSTEL_GATE_HALF - DRIVE.half[0] * k, 'the gate is wider than the car');
  for (const [x, z, h] of path) {
    const hit = world.intersectionWithShape({ x, y: DRIVE.half[1] + 0.12, z }, { x: 0, y: Math.sin(h / 2), z: 0, w: Math.cos(h / 2) }, car);
    assert(!hit, `car clears the garage and gate at ${[x.toFixed(1), z.toFixed(1)]}`);
  }

  console.log('HOSTEL COMPOUND PASSED: 12 numbered doors on 2 floors, stable even room assignment, floor-aware door prompt, real Rapier walk up the stairs, along the balcony to Room 10, back down, balcony/end/landing/stair rails hold, facade + stair mass + shop solid, ground doors reachable under the balcony, Iya Ibeji reachable, perimeter wall holds, gate open, a G-Wagon drives out of the garage and through the gate.');
}
main().catch((e) => { console.error(e); process.exit(1); });
