import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { courses, colleges } from '../src/config/academics';
import { normalizeAvatar, avatarOptions } from '../src/config/avatar';
import {
  simulateUtme,
  screenResult,
  eligibleCourses,
  playerEntry,
} from '../src/config/studentJourney';
import { summarizeCampus } from '../src/config/campusSummary';

assert.equal(playerEntry(false, false), 'new');
assert.equal(playerEntry(false, true), 'beta');
assert.equal(playerEntry(true, true), 'returning');
assert.equal(playerEntry(true, false), 'returning');
assert.equal(new Set(courses.map((c) => c.id)).size, courses.length);
for (const c of colleges) assert(courses.some((course) => course.college === c.code));
for (const seed of [0, 0.2, 0.5, 0.999]) {
  const utme = simulateUtme('FST', () => seed);
  assert.equal(utme.subjects.length, 4);
  assert.equal(
    utme.utme,
    utme.subjects.reduce((n, s) => n + s.score, 0),
  );
  assert(utme.subjects.every((s) => s.score >= 0 && s.score <= 100));
  const failed = screenResult(utme, [1, 0, 0]);
  assert.equal(failed.screening, 0);
  assert(eligibleCourses(failed.aggregate!).length > 0, 'Every result offers an entry route');
  const passed = screenResult(utme, [0, 1, 2]);
  assert.equal(passed.screening, 100);
  assert(passed.aggregate! > failed.aggregate!);
}
assert(simulateUtme('CVE').subjects.some((s) => s.name === 'Physics'));
const legacy = normalizeAvatar({
  shirtColor: '#254321',
  skinColor: '#8d5524',
  gender: 'female',
  hairStyle: 'afro',
});
assert.equal(legacy.topColor, '#254321');
assert.equal(legacy.bodyType, 'feminine');
assert.equal(legacy.hairstyle, 'short-afro');
assert.deepEqual(
  normalizeAvatar(JSON.parse(JSON.stringify(legacy))),
  legacy,
  'Saved avatar round-trips',
);
for (const hairstyle of avatarOptions.hairstyle)
  assert.equal(normalizeAvatar({ hairstyle }).hairstyle, hairstyle);
const hostile = normalizeAvatar({
  hairstyle: '<script>',
  hairColor: 'url(evil)',
  topColor: 'x'.repeat(5000),
  huge: 'x'.repeat(20000),
} as any);
assert.equal(hostile.hairstyle, 'low-cut');
assert(!JSON.stringify(hostile).includes('evil'));
assert(JSON.stringify(hostile).length < 512);
assert.deepEqual(
  summarizeCampus(
    [
      { id: 'a', position: [1, 0, 0] },
      { id: 'a', position: [1, 0, 0] },
      { id: 'b', position: [2, 0, 0] },
    ],
    () => 'Car Park',
  ),
  { studentsOnline: 2, popular: [{ name: 'Car Park', count: 2 }] },
);
// COLFHEC's four departments, and HTM reaches the database through migration 022.
assert.deepEqual(courses.filter((c) => c.college === 'COLFHEC').map((c) => c.id).sort(), ['CTX', 'FST', 'HSM', 'HTM', 'NTD']);
assert(courses.some((c) => c.id === 'AAD' && c.college === 'COLAMRUD') && readFileSync('supabase/migrations/036_agricultural_administration.sql', 'utf8').includes("('AAD', 'Agricultural Administration', 'COLAMRUD', 48)"), 'AAD in 036');
assert(courses.some((c) => c.id === 'ZOO' && c.college === 'COLBIOS') && readFileSync('supabase/migrations/042_colbios_zoology.sql', 'utf8').includes("('ZOO', 'Zoology', 'COLBIOS', 55)"), 'ZOO in 042');
assert(readFileSync('supabase/migrations/035_clothing_textiles.sql', 'utf8').includes("('CTX', 'Clothing and Textiles', 'COLFHEC', 50)"));
assert(readFileSync('supabase/migrations/022_colfhec_htm.sql', 'utf8').includes("('HTM', 'Hospitality and Tourism Management', 'COLFHEC', 55)"));
// COLERM is offered (its building and lecture hall exist): five departments, in migrations 025 and 026.
assert(colleges.some((c) => c.code === 'COLERM'), 'COLERM can be chosen');
const colerm = courses.filter((c) => c.college === 'COLERM');
assert.deepEqual(colerm.map((c) => c.id).sort(), ['AQFM', 'EMT', 'FWM', 'GLY', 'WMA']);
const sql025 = readFileSync('supabase/migrations/025_colerm_departments.sql', 'utf8') + readFileSync('supabase/migrations/026_colerm_geology.sql', 'utf8');
for (const c of colerm) assert(sql025.includes(`('${c.id}', '${c.name}', 'COLERM', ${c.gameCutoffRange[0]})`), `${c.id} in 025`);
// COLCOMS is offered with its four departments; Computer Science moved there from COLPHYS (migration 028).
assert(colleges.some((c) => c.code === 'COLCOMS'), 'COLCOMS can be chosen');
const colcoms = courses.filter((c) => c.college === 'COLCOMS');
assert.deepEqual(colcoms.map((c) => c.id).sort(), ['CDS', 'CSC', 'ICT', 'SEI']);
const sql028 = readFileSync('supabase/migrations/028_colcoms_departments.sql', 'utf8');
for (const c of colcoms) assert(sql028.includes(`('${c.id}', '${c.name}', 'COLCOMS', ${c.gameCutoffRange[0]})`), `${c.id} in 028`);
assert(sql028.includes("update public.profiles set college = 'COLCOMS'") && sql028.includes("course_id = 'CSC'"), 'CSC students follow their department');
// COLLEND is offered with its three departments (migration 030) and a building on campus.
assert(colleges.some((c) => c.code === 'COLLEND'), 'COLLEND can be chosen');
const collend = courses.filter((c) => c.college === 'COLLEND');
assert.deepEqual(collend.map((c) => c.id).sort(), ['ACC', 'ETS', 'LIS']);
const sql030 = readFileSync('supabase/migrations/030_collend_departments.sql', 'utf8');
for (const c of collend) assert(sql030.includes(`('${c.id}', '${c.name}', 'COLLEND', ${c.gameCutoffRange[0]})`), `${c.id} in 030`);
assert.equal(simulateUtme('ACC', () => 0.5).subjects[3].name, 'Economics');
const migration = readFileSync('supabase/migrations/006_student_journey.sql', 'utf8');
assert(
  migration.includes('select id, true from public.profiles'),
  'Beta membership backfilled exactly once',
);
assert(migration.includes('game_matric_number text unique'));
assert(migration.includes("nextval('public.game_matric_sequence')"));
assert(migration.includes('for update'), 'Completion serializes competing requests');
assert(migration.includes('coalesce(orientation_badge_claimed_at, now())'));
assert(!/update public\.(wallets|friends|inventory)|delete from public\./i.test(migration));
const worker = readFileSync('worker/index.ts', 'utf8');
const batch = worker.slice(
  worker.indexOf('private broadcastBatchPlayers()'),
  worker.indexOf('async fetch(request: Request)'),
);
assert(!batch.includes('avatarConfig'), 'Avatar absent from movement batch');
assert(worker.includes("case 'avatar_update'"));
const auth = readFileSync('src/stores/authStore.ts', 'utf8');
assert(!auth.includes("from('wallets').upsert"), 'Auth cannot reset an existing wallet');
console.log(
  'Student journey: state routing, admission, guaranteed alternatives, legacy avatar conversion, persistence, payload bounds, summary and migration contracts passed.',
);
