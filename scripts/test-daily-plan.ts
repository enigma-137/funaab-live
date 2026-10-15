// Today's Plan client config: clock helpers and goal pool.
import assert from 'node:assert/strict';
import { DAILY_GOALS, DAILY_PLAN, isCampusNight, lagosDay, lagosHour, workerGoalIds } from '../src/config/dailyPlan';

// Goal pool sanity.
assert(DAILY_GOALS.length >= DAILY_PLAN.GOALS_PER_DAY * 3, 'enough variety for daily draws');
assert.equal(new Set(DAILY_GOALS.map((g) => g.id)).size, DAILY_GOALS.length);
for (const g of DAILY_GOALS) assert(g.reward > 0 && g.reward <= 3000 && g.target >= 1 && g.target <= 10, g.id);
assert.deepEqual(workerGoalIds.sort(), ['campus_night', 'garden_hangout', 'take_penalties', 'visit_friend_room', 'visit_love_garden']);
// Max daily payout stays small next to jobs (₦40k–60k/day).
const maxDaily = [...DAILY_GOALS].sort((a, b) => b.reward - a.reward).slice(0, 3).reduce((n, g) => n + g.reward, 0) + DAILY_PLAN.ALL_DONE_BONUS;
assert(maxDaily <= 6000, `daily plan pays at most ₦${maxDaily}`);

// Lagos clock (UTC+1, no DST), independent of the device timezone.
assert.equal(lagosHour(Date.UTC(2026, 0, 1, 19, 0)), 20);
assert.equal(isCampusNight(Date.UTC(2026, 0, 1, 18, 59)), false);
assert.equal(isCampusNight(Date.UTC(2026, 0, 1, 19, 0)), true);
assert.equal(isCampusNight(Date.UTC(2026, 0, 1, 19, 59)), true);
assert.equal(isCampusNight(Date.UTC(2026, 0, 1, 20, 0)), false);
assert.equal(lagosDay(Date.UTC(2026, 0, 1, 22, 59)), '2026-01-01');
assert.equal(lagosDay(Date.UTC(2026, 0, 1, 23, 0)), '2026-01-02', 'midnight in Lagos is 23:00 UTC');

console.log(`DAILY PLAN PASSED: goal pool (max ₦${maxDaily}/day), Lagos clock`);
