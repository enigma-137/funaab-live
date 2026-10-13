// Goals config must match migration 015 (task pool, rewards, bonus curve, colleges).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { DAILY_TASKS, TASK_BONUS, taskBonusFor, VISIT_COLLEGES, BADGES } from '../src/config/goals';
import { campusLocations } from '../src/config/campusLocations';

const sql = fs.readFileSync('supabase/migrations/015_goals_tasks_badges_leaderboards.sql', 'utf8');
const rows = [...sql.matchAll(/\('([a-z_]+)','([^']+)',(\d+),(\d+)\)/g)].map(([, id, title, target, reward]) => ({ id, title, target: +target, reward: +reward }));
assert.deepEqual(rows.map((r) => r.id).sort(), Object.keys(DAILY_TASKS).sort(), 'same task pool');
for (const r of rows) {
  const c = DAILY_TASKS[r.id as keyof typeof DAILY_TASKS];
  assert.deepEqual([c.title, c.target, c.reward], [r.title, r.target, r.reward], `task ${r.id} matches SQL`);
}
assert.match(sql, new RegExp(`select ${TASK_BONUS.base} \\+ ${TASK_BONUS.step} \\* least\\(greatest\\(p_streak, 1\\) - 1, ${TASK_BONUS.maxSteps}\\)`), 'bonus curve matches SQL');
assert.deepEqual([1, 2, 7, 30].map(taskBonusFor), [100, 125, 250, 250]);
const sqlColleges = [...sql.matchAll(/place in \(([^)]+)\)/g)].map((m) => m[1].replace(/'/g, '').split(','));
assert(sqlColleges.length >= 1 && sqlColleges.every((l) => l.join() === VISIT_COLLEGES.join()), 'college list matches SQL (table + RPC)');
assert.deepEqual([...VISIT_COLLEGES].sort(), campusLocations.filter((l) => l.type === 'college').map((l) => l.id).sort(), 'every college building counts');
assert.equal(new Set(BADGES.map((b) => b.id)).size, BADGES.length, 'unique badge ids');
for (const b of BADGES) assert.match(sql, new RegExp(`'${b.metric}'`), `badge metric ${b.metric} returned by get_achievements`);
console.log(`GOALS CONFIG PASSED: ${rows.length} tasks, bonus curve, ${VISIT_COLLEGES.length} colleges, ${BADGES.length} badges match migration 015.`);
