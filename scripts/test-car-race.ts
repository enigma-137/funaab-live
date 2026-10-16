// Car race (src/config/carRace.ts): the COLENG → COLFHEC route stays on the roads, checkpoints run
// in order to the finish line, the grid lanes sit inside the curbs, and the rivals' pace leaves room
// to beat them in a car you can afford.
// Run: npm run test:race
import assert from 'node:assert/strict';
import { RACE, RACE_CORNERS, RACE_GATES, RACE_LENGTH, RIVALS, gridSpot, pointAlong, projectOnto } from '../src/config/carRace';
import { CAR_MODELS, DRIVE, isPaintId } from '../src/config/cars';
import { locationById } from '../src/config/campusLocations';
import { roadBounds } from '../src/config/kekeRoutes';

const onRoad = (x: number, z: number) => roadBounds.some((r) => x >= r.minX && x <= r.maxX && z >= r.minZ && z <= r.maxZ);
const end = RACE.track[RACE.track.length - 1], colfhec = locationById('colfhec').kekeStop, coleng = locationById('coleng').kekeStop;
assert.deepEqual([end[0], end[2]], [colfhec[0], colfhec[2]], 'finish at the COLFHEC stop');
assert(Math.hypot(RACE.track[0][0] - coleng[0], RACE.track[0][2] - coleng[2]) <= 12, 'grid beside COLENG');
for (let d = 0; d <= RACE_LENGTH; d += 0.5) { const p = pointAlong(RACE.track, d); assert(onRoad(p.x, p.z), `on the road at ${d} m`); }
assert(RACE_LENGTH > 80 && RACE_LENGTH < 200, `a sprint (${RACE_LENGTH} m)`);
assert(RACE_CORNERS.length >= 1, 'at least one corner');
assert.equal(RACE_GATES[RACE_GATES.length - 1], RACE_LENGTH, 'last gate is the finish');
for (let i = 1; i < RACE_GATES.length; i++) assert(RACE_GATES[i] > RACE_GATES[i - 1] && RACE_GATES[i] - RACE_GATES[i - 1] <= RACE.gateSpacing, 'gates in order, no gaps to cut');
for (const lane of [-1, 0, 1]) {
  const g = gridSpot(lane), p = projectOnto(RACE.track, g.x, g.z);
  assert(p.along < 0.01 && Math.abs(p.off - Math.abs(lane) * RACE.laneOffset) < 1e-6, `lane ${lane} on the start line`);
  assert(Math.abs(lane) * RACE.laneOffset + DRIVE.half[0] * 1.05 < 4.28, `lane ${lane} inside the curbs`);
}
assert(gridSpot(1).x !== gridSpot(-1).x || gridSpot(1).z !== gridSpot(-1).z, 'rivals on different lanes');
// Lane +1 is right of travel (forward is (sin h, cos h); car-local +X is the driver's left).
const g0 = gridSpot(0), g1 = gridSpot(1), left = [Math.cos(g0.heading), -Math.sin(g0.heading)];
assert((g1.x - g0.x) * left[0] + (g1.z - g0.z) * left[1] < 0, 'lane +1 is on the right');

// Rival pace, stepped like the race runner (60 fps): they finish, and a Corolla driven well can win.
const corner = (dist: number, top: number) => { const n = RACE_CORNERS.find((c) => c > dist - 3); return n === undefined ? top : Math.min(top, Math.sqrt(RACE.cornerSpeed ** 2 + 12 * Math.max(0, n - dist))); };
const times = RIVALS.map((r) => { let d = 0, v = 0, t = 0; while (d < RACE_LENGTH && t < 120) { v = Math.min(corner(d, r.topSpeed), v + r.accel / 60); d += v / 60; t += 1 / 60; } return t; });
for (const t of times) assert(t < 60, 'rivals finish');
const ideal = RACE_LENGTH / CAR_MODELS.car_corolla.topSpeed + CAR_MODELS.car_corolla.topSpeed / DRIVE.accel / 2;
assert(ideal < Math.min(...times), `beatable (best rival ${Math.min(...times).toFixed(1)} s, flat-out Corolla ${ideal.toFixed(1)} s)`);
for (const r of RIVALS) { assert(r.car in CAR_MODELS, `${r.name} drives a real car`); assert(isPaintId(r.paint), `${r.name}'s paint is a real colour`); }
console.log(`CAR RACE PASSED: ${RACE_LENGTH} m COLENG → COLFHEC on the roads, ${RACE_GATES.length} gates, grid inside the curbs, rivals in ${times.map((t) => t.toFixed(1)).join(' / ')} s and beatable.`);
