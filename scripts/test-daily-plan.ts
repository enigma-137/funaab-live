// Today's Plan client config + ambient students: clock helpers, goal pool, walker paths.
import assert from 'node:assert/strict';
import { DAILY_GOALS, DAILY_PLAN, isCampusNight, lagosDay, lagosHour, workerGoalIds } from '../src/config/dailyPlan';
import { campusStudentWalks, gardenChatters, walkAt } from '../src/config/campusStudents';
import { campusLocations } from '../src/config/campusLocations';
import { classifyTerrain } from '../src/game/rules/lawnSecuritySystem';
import worldData from '../src/config/campusWorld';

// Goal pool sanity.
assert(DAILY_GOALS.length >= DAILY_PLAN.GOALS_PER_DAY * 3, 'enough variety for daily draws');
assert.equal(new Set(DAILY_GOALS.map((g) => g.id)).size, DAILY_GOALS.length);
for (const g of DAILY_GOALS) assert(g.reward > 0 && g.reward <= 300 && g.target >= 1 && g.target <= 10, g.id);
assert.deepEqual(workerGoalIds.sort(), ['campus_night', 'garden_hangout', 'take_penalties', 'visit_friend_room', 'visit_love_garden']);
// Max daily payout stays small next to jobs (₦4k–6k/day).
const maxDaily = [...DAILY_GOALS].sort((a, b) => b.reward - a.reward).slice(0, 3).reduce((n, g) => n + g.reward, 0) + DAILY_PLAN.ALL_DONE_BONUS;
assert(maxDaily <= 600, `daily plan pays at most ₦${maxDaily}`);

// Lagos clock (UTC+1, no DST), independent of the device timezone.
assert.equal(lagosHour(Date.UTC(2026, 0, 1, 19, 0)), 20);
assert.equal(isCampusNight(Date.UTC(2026, 0, 1, 18, 59)), false);
assert.equal(isCampusNight(Date.UTC(2026, 0, 1, 19, 0)), true);
assert.equal(isCampusNight(Date.UTC(2026, 0, 1, 19, 59)), true);
assert.equal(isCampusNight(Date.UTC(2026, 0, 1, 20, 0)), false);
assert.equal(lagosDay(Date.UTC(2026, 0, 1, 22, 59)), '2026-01-01');
assert.equal(lagosDay(Date.UTC(2026, 0, 1, 23, 0)), '2026-01-02', 'midnight in Lagos is 23:00 UTC');

// Walkers: deterministic, smooth, on paving, out of buildings.
const solid = campusLocations.filter((l) => l.footprint[0] > 0);
const t0 = Date.UTC(2026, 9, 14, 12, 0);
for (const w of campusStudentWalks) {
  assert.deepEqual(walkAt(w, t0), walkAt(w, t0), 'same clock → same spot on every phone');
  let prev = walkAt(w, t0).position;
  for (let s = 1; s <= 1200; s++) {
    const { position: p, rotation } = walkAt(w, t0 + s * 1000);
    assert(p.every(Number.isFinite) && Number.isFinite(rotation));
    assert(Math.hypot(p[0] - prev[0], p[2] - prev[2]) < 2.6, `${w.id} never jumps (${s}s)`);
    assert(!classifyTerrain(p[0], p[2]).restricted, `${w.id} stays on paving at ${p[0].toFixed(1)},${p[2].toFixed(1)}`);
    assert(!solid.some((l) => Math.abs(p[0] - l.position[0]) < l.footprint[0] / 2 && Math.abs(p[2] - l.position[2]) < l.footprint[1] / 2), `${w.id} outside buildings`);
    prev = p;
  }
}
// Chatters stand on the garden paving, clear of every seat and walkway entry.
const seats = (worldData.interactables as any[]).filter((i) => i.id.startsWith('love-garden-seat-'));
for (const c of gardenChatters) {
  assert(!classifyTerrain(c.position[0], c.position[2]).restricted);
  for (const s of seats) assert(Math.hypot(s.position[0] - c.position[0], s.position[2] - c.position[2]) > 1.5, `${c.id} clear of ${s.id}`);
}
console.log(`DAILY PLAN + CAMPUS STUDENTS PASSED: goal pool (max ₦${maxDaily}/day), Lagos clock, ${campusStudentWalks.length} walkers smooth/on paving/out of buildings, chatters clear of seats`);
