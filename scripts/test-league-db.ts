// College League (migration 021): points from server records, per-student cap, fair ranking,
// last week's champion, Worker-only football wins, privacy, drift.
// Run: PGLITE_MODULE=<path to pglite index.cjs> npm run test:league:db
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { LEAGUE } from '../src/config/collegeLeague';

const require = createRequire(import.meta.url);
const { PGlite } = require(process.env.PGLITE_MODULE || '@electric-sql/pglite');

async function main() {
  const db = new PGlite();
  await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema public,auth to anon,authenticated,service_role;`);
  const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '../supabase/migrations');
  const sql = fs.readFileSync(path.join(dir, '021_college_league.sql'), 'utf8');
  for (const f of fs.readdirSync(dir).sort()) await db.exec(fs.readFileSync(path.join(dir, f), 'utf8'));
  const rows = async (q: string, p: unknown[] = []) => (await db.query(q, p)).rows as any[];
  const call = async (user: string | null, q: string, p: unknown[] = []) => {
    await db.exec(user ? `set role authenticated; select set_config('request.jwt.claim.sub','${user}',false);` : `set role anon; select set_config('request.jwt.claim.sub','',false);`);
    try { return (await rows(q, p))[0]; } finally { await db.exec("reset role; select set_config('request.jwt.claim.sub','',false);"); }
  };
  const fails = (user: string | null, q: string, re: RegExp) => assert.rejects(() => call(user, q), re);
  const svc = async (q: string, p: unknown[] = []) => { await db.exec('set role service_role;'); try { return (await rows(q, p))[0]; } finally { await db.exec('reset role;'); } };
  let n = 0;
  const student = async (college: string) => {
    const id = `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`;
    await db.query('insert into auth.users values($1)', [id]);
    await db.query('insert into profiles(id,username,college) values($1,$2,$3)', [id, `s${n}`, college]);
    return id;
  };
  const lectures = (u: string, k: number, at = 'now()') => db.query(`insert into lecture_attendance(user_id,lecture_id,duration_seconds,reward_claimed,created_at) select $1,'funaab-phy-201',60,100,${at} from generate_series(1,$2)`, [u, k]);

  // Drift.
  const P = LEAGUE.POINTS;
  for (const [needle, what] of [[`select c.user_id, ${P.daily_goal} pts`, 'goal'], [`select a.user_id, ${P.lecture} from lecture_attendance`, 'lecture'],
    [`select r.user_id, ${P.game_den_match} from ps_reward_receipts`, 'game den'], [`select h.user_id, ${P.hustle} from hustle_payments`, 'hustle'],
    [`select e.user_id, ${P.football_win} from league_events`, 'football'], [`least(${LEAGUE.STUDENT_WEEKLY_CAP}, sum(r.pts))`, 'cap'], [`count(*)>=${LEAGUE.MIN_ACTIVE} ranked`, 'min active']] as const)
    assert(sql.includes(needle), `${what} matches config`);

  // Privileges.
  const a1 = await student('COLENG');
  await fails(a1, `select league_event_trusted('${a1}','football_win','x')`, /permission denied/);
  await fails(a1, 'select league_table(0)', /permission denied/);
  await fails(null, 'select college_league()', /permission denied|Authentication/);

  // This week: COLENG has 3 students (one grinder, capped); COLANIM has 2 steady students; COLVET has 1.
  const a2 = await student('COLENG'), a3 = await student('COLENG');
  const b1 = await student('COLANIM'), b2 = await student('COLANIM');
  const c1 = await student('COLVET');
  await lectures(a1, 60); // 300 → capped at 200
  await lectures(a2, 2); await lectures(a3, 2); // 10 each
  await lectures(b1, 10); await lectures(b2, 10); // 50 each
  await lectures(c1, 30); // 150 but only 1 active → unranked
  await svc("select league_event_trusted($1,'football_win','match-1')", [b1]);
  await svc("select league_event_trusted($1,'football_win','match-1')", [b1]); // idempotent
  const lg = (await call(a2, 'select college_league() l')).l;
  const t = Object.fromEntries(lg.table.map((r: any) => [r.college, r]));
  assert.equal(t.COLENG.total, 220, 'grinder capped at 200'); assert.equal(Number(t.COLENG.average), 73.3);
  assert.equal(t.COLANIM.total, 115); assert.equal(Number(t.COLANIM.average), 57.5);
  assert.equal(t.COLVET.ranked, false, 'one student is not a team');
  assert.deepEqual(lg.table.map((r: any) => r.college), ['COLENG', 'COLANIM', 'COLVET'], 'ranked by average, unranked last');
  assert.equal(lg.my_college, 'COLENG'); assert.equal(lg.my_points, 10);
  assert(!JSON.stringify(lg).includes(a1), 'no student ids in the public table');

  // A smaller, more active college beats a bigger one on average.
  const b3 = await student('COLANIM'); await lectures(b3, 30); // COLANIM avg now (60+50+150)/3 ≈ 86.7
  assert.equal((await call(a2, 'select college_league() l')).l.table[0].college, 'COLANIM');

  // Last week's champion → campus banner.
  await db.query("insert into lecture_attendance(user_id,lecture_id,duration_seconds,reward_claimed,created_at) select u,'funaab-phy-201',60,100,academic_semester_from(academic_semester(lagos_today())-1)+interval '1 day' from unnest(array[$1,$2]::uuid[]) u, generate_series(1,5)", [c1, await student('COLVET')]);
  assert.equal((await call(a1, 'select league_champion() c')).c, 'COLVET');
  assert.equal((await call(a1, 'select college_league() l')).l.last_champion, 'COLVET');
  console.log('LEAGUE DB PASSED: drift, privileges, points from records, per-student cap, idempotent Worker wins, fair average ranking, min active, champion banner');
}
main().catch((e) => { console.error(e); process.exit(1); });
