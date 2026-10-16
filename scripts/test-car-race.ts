// Car race (src/config/carRace.ts): the Campus Grand Prix lap stays on the roads and passes its
// landmarks, ends where it starts, checkpoints run in order to the line, the lap search never confuses
// start and finish, the grid lanes sit inside the curbs, and the rivals can be beaten in a cheap car.
// Run: npm run test:race
import assert from 'node:assert/strict';
import { RACE, RACE_CORNERS, RACE_GATES, RACE_LENGTH, RIVALS, RIVAL_FINISH_MS, crossedFinish, finishPlace, gridSpot, minLapMs, pointAlong, projectOnto, rivalProgress, stepRace } from '../src/config/carRace';
import { CAR_MODELS, DRIVE, isPaintId } from '../src/config/cars';
import { locationById } from '../src/config/campusLocations';
import { roadBounds } from '../src/config/kekeRoutes';

const onRoad = (x: number, z: number) => roadBounds.some((r) => x >= r.minX && x <= r.maxX && z >= r.minZ && z <= r.maxZ);
const end = RACE.track[RACE.track.length - 1], coleng = locationById('coleng').kekeStop;
assert.deepEqual(end, RACE.track[0], 'a lap: finish where it starts');
assert(Math.hypot(RACE.track[0][0] - coleng[0], RACE.track[0][2] - coleng[2]) <= 12, 'grid beside COLENG');
for (const id of RACE.landmarks) { const p = locationById(id).kekeStop; assert(projectOnto(RACE.track, p[0], p[2]).off < 0.01, `passes ${id}`); }
const passAt = RACE.landmarks.map((id) => { const p = locationById(id).kekeStop; return projectOnto(RACE.track, p[0], p[2]).along; });
assert.deepEqual(passAt, [...passAt].sort((x, y) => x - y), 'landmarks in lap order');
// Start and finish share a spot: the windowed search reads 0 at the start and the full lap at the end.
const g = RACE.track[0];
assert(projectOnto(RACE.track, g[0], g[2] + 1, [-20, RACE.gateSpacing + 20]).along < 2, 'start of the lap');
assert(projectOnto(RACE.track, g[0], g[2] - 1, [RACE_LENGTH - 30, RACE_LENGTH + 20]).along > RACE_LENGTH - 2, 'end of the lap');
assert(!crossedFinish(g[0], g[2] - 2) && crossedFinish(g[0], g[2]) && crossedFinish(g[0] + 3, g[2] + 4) && !crossedFinish(g[0] + 9, g[2]), 'finish line crossing');
for (let d = 0; d <= RACE_LENGTH; d += 0.5) { const p = pointAlong(RACE.track, d); assert(onRoad(p.x, p.z), `on the road at ${d} m`); }
assert(RACE_LENGTH > 400 && RACE_LENGTH < 600, `a full lap (${RACE_LENGTH} m)`);
assert.equal(RACE_CORNERS.length, 6, 'six corners');
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
const times = RIVAL_FINISH_MS.map((ms) => ms / 1000);
for (const t of times) assert(t < 60, 'rivals finish');
// Rivals are a function of race time only, so the game and the Worker agree.
RIVALS.forEach((_, i) => {
  assert.equal(rivalProgress(i, 0), 0); assert.equal(rivalProgress(i, RIVAL_FINISH_MS[i] + 1000), RACE_LENGTH);
  for (let ms = 0; ms < RIVAL_FINISH_MS[i]; ms += 500) assert(rivalProgress(i, ms + 500) >= rivalProgress(i, ms), 'never backwards');
});
assert.equal(finishPlace(Math.min(...RIVAL_FINISH_MS) - 1), 1); assert.equal(finishPlace(Math.max(...RIVAL_FINISH_MS) + 1), RIVALS.length + 1);
for (const id of Object.keys(CAR_MODELS)) assert(minLapMs(id) < Math.min(...RIVAL_FINISH_MS), `${id} can win under the speed check`);

// Driving the lap through stepRace: checkpoints in order to the line, even in big jumps (laggy phone).
for (const stepM of [0.5, 6]) {
  let gate = 0, x = RACE.track[0][0], z = RACE.track[0][2];
  for (let d = stepM; d <= RACE_LENGTH + stepM; d += stepM) {
    const p = pointAlong(RACE.track, Math.min(d, RACE_LENGTH + 0.5));
    const at = d > RACE_LENGTH ? { x: p.x + p.dx * 1, z: p.z + p.dz * 1 } : p;
    const st = stepRace(gate, x, z, at.x, at.z);
    assert(!st.off, `on the route at ${d} m`);
    gate = st.gate; x = at.x; z = at.z;
    if (st.finished) break;
  }
  assert.equal(gate, RACE_GATES.length, `finished with ${stepM} m steps`);
}
// Cutting across: skip from the first corner straight to the Library is off the route.
{ const lib = locationById('library').kekeStop, st = stepRace(9, 55, 40, lib[0], lib[2]); assert(st.off || st.gate === 9, 'no shortcut'); }
// Sitting on the grid at the start doesn't count as finishing.
assert(!stepRace(0, RACE.track[0][0], RACE.track[0][2], RACE.track[0][0], RACE.track[0][2] + 0.5).finished, 'start is not the finish');
// A human taking each corner at about 6 m/s in the cheapest car: brake into it and accelerate out.
const human = (top: number) => { let d = 0, v = 0, t = 0; while (d < RACE_LENGTH && t < 300) { const n = RACE_CORNERS.find((c) => c > d - 3); const lim = n === undefined ? top : Math.min(top, Math.sqrt(36 + 2 * DRIVE.brake * 0.6 * Math.max(0, n - d))); v = v > lim ? Math.max(lim, v - DRIVE.brake / 60) : Math.min(lim, v + DRIVE.accel / 60); d += v / 60; t += 1 / 60; } return t; };
const picanto = human(CAR_MODELS.car_picanto.topSpeed);
assert(picanto < Math.min(...times), `beatable in a Picanto (best rival ${Math.min(...times).toFixed(1)} s, clean Picanto lap ${picanto.toFixed(1)} s)`);
assert(picanto > Math.min(...times) - 6, 'but not a walkover');
for (const r of RIVALS) { assert(r.car in CAR_MODELS, `${r.name} drives a real car`); assert(isPaintId(r.paint), `${r.name}'s paint is a real colour`); }
console.log(`CAR RACE PASSED: ${RACE_LENGTH} m lap (${RACE.route}) on the roads, ${RACE_GATES.length} gates, grid inside the curbs, rivals in ${times.map((t) => t.toFixed(1)).join(' / ')} s and beatable.`);
