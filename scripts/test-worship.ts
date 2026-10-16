// Mosque (Fridays) and Chapel of Grace (Sundays): opening days follow Lagos time on any device,
// the buildings sit on clear ground off the walkways, and the interiors leave room to move.
import assert from 'node:assert/strict';
import { CHAPEL, CHAPEL_PEWS, CHANCEL, IMAM_SPOT, MAT_SIZE, MOSQUE, MOSQUE_MATS, PEW_SIZE, chapelPewSeats, inWorshipPlace, lagosWeekday, worshipEntrance, worshipOpen, worshipSign } from '../src/config/worship';
import { campusLocations, locationById } from '../src/config/campusLocations';
import { kekeDestinations, roadBounds } from '../src/config/kekeRoutes';

const at = (iso: string) => Date.parse(iso);
// Thursday 15 Oct 2026, 23:30 UTC is already Friday 00:30 in Lagos.
assert.equal(lagosWeekday(at('2026-10-15T23:30:00Z')), 5);
assert.equal(worshipOpen(MOSQUE, at('2026-10-15T22:59:00Z')), false, 'Thursday 23:59 Lagos: mosque still shut');
assert.equal(worshipOpen(MOSQUE, at('2026-10-15T23:00:00Z')), true, 'Friday 00:00 Lagos: mosque opens');
assert.equal(worshipOpen(MOSQUE, at('2026-10-16T22:59:00Z')), true, 'Friday 23:59 Lagos');
assert.equal(worshipOpen(MOSQUE, at('2026-10-16T23:00:00Z')), false, 'Saturday: shut again');
assert.equal(worshipOpen(CHAPEL, at('2026-10-17T23:00:00Z')), true, 'Sunday 00:00 Lagos: chapel opens');
assert.equal(worshipOpen(CHAPEL, at('2026-10-18T22:59:00Z')), true);
assert.equal(worshipOpen(CHAPEL, at('2026-10-18T23:00:00Z')), false, 'Monday: shut');
assert.equal(worshipOpen(CHAPEL, at('2026-10-16T12:00:00Z')), false, 'chapel shut on Friday');
assert.equal(worshipSign(MOSQUE, at('2026-10-15T12:00:00Z')), 'Opens on Friday');
assert.equal(worshipSign(CHAPEL, at('2026-10-15T12:00:00Z')), 'Opens on Sunday');
assert.match(worshipSign(CHAPEL, at('2026-10-18T09:00:00Z')), /Open today/);

// On the map, with a walkway from the road and a keke stop; clear of every other building and road.
for (const p of [MOSQUE, CHAPEL]) {
  const l = locationById(p.id);
  assert.deepEqual(l.position, p.centre); assert.deepEqual(l.footprint, p.size);
  assert.deepEqual(l.entrance, worshipEntrance(p), `${p.id} entrance outside the door`);
  assert(kekeDestinations.some((d) => d.id === p.id), `${p.id} bookable by keke`);
  const [cx, , cz] = p.centre, [w, d] = p.size;
  for (const o of campusLocations) {
    if (o.id === p.id || !o.footprint[0]) continue;
    const apart = Math.abs(o.position[0] - cx) > (o.footprint[0] + w) / 2 + 2 || Math.abs(o.position[2] - cz) > (o.footprint[1] + d) / 2 + 2;
    assert(apart, `${p.id} overlaps ${o.id}`);
  }
  for (const r of roadBounds) assert(cx + w / 2 < r.minX || cx - w / 2 > r.maxX || cz + d / 2 < r.minZ || cz - d / 2 > r.maxZ, `${p.id} sits on a road`);
  assert(inWorshipPlace(p, [cx, 0, cz]) && !inWorshipPlace(p, worshipEntrance(p)));
}

// Interiors: mats and pews stay inside the walls, with room to walk.
const [mw, md] = MAT_SIZE, [MW, MD] = MOSQUE.size;
for (const m of MOSQUE_MATS) assert(Math.abs(m.x) + mw / 2 < MW / 2 - 0.5 && Math.abs(m.z) + md / 2 < MD / 2 - 0.5);
const rows = [...new Set(MOSQUE_MATS.map((m) => m.z))].sort((a, b) => a - b);
for (let i = 1; i < rows.length; i++) assert(rows[i] - rows[i - 1] - md >= 0.4, 'space between mat rows');
assert(IMAM_SPOT[2] < rows[0] - md / 2 - 0.8, 'the Imam stands in front of the first row');
const [pw, pd] = PEW_SIZE, [CW, CD] = CHAPEL.size;
for (const p of CHAPEL_PEWS) assert(Math.abs(p.x) + pw / 2 < CW / 2 - 1.2 && p.z + pd / 2 < CD / 2 - 2, 'side aisles and room at the back');
assert(Math.min(...CHAPEL_PEWS.map((p) => Math.abs(p.x) - pw / 2)) * 2 >= 1.4, 'central aisle at least 1.4 m');
const pz = [...new Set(CHAPEL_PEWS.map((p) => p.z))].sort((a, b) => a - b);
for (let i = 1; i < pz.length; i++) assert(pz[i] - pz[i - 1] - pd >= 0.9, 'legroom between pews');
assert(pz[0] - pd / 2 > CHANCEL.maxZ + 1.5, 'space before the chancel');
assert.equal(chapelPewSeats.length, CHAPEL_PEWS.length * 3);
console.log('WORSHIP PASSED: Lagos-day opening (Friday mosque, Sunday chapel) across midnight, signs, map/keke/walkway, clear ground, mats and pews with walking room.');
