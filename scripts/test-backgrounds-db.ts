// Home background (migration 018): one-time choice, welcome money, weekly money from home,
// hustle bonus trigger on job pay, privacy, drift with src/config/backgrounds.ts.
// Run: PGLITE_MODULE=<path to pglite index.cjs> npm run test:backgrounds:db
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { BACKGROUNDS } from '../src/config/backgrounds';

const require = createRequire(import.meta.url);
const { PGlite } = require(process.env.PGLITE_MODULE || '@electric-sql/pglite');

async function main() {
  const db = new PGlite();
  await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema public,auth to anon,authenticated,service_role;`);
  const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '../supabase/migrations');
  for (const f of fs.readdirSync(dir).sort()) await db.exec(fs.readFileSync(path.join(dir, f), 'utf8'));
  const rows = async (sql: string, p: unknown[] = []) => (await db.query(sql, p)).rows as any[];
  const one = async (sql: string, p: unknown[] = []) => (await rows(sql, p))[0];
  const call = async (user: string | null, sql: string, p: unknown[] = []) => {
    await db.exec(user ? `set role authenticated; select set_config('request.jwt.claim.sub','${user}',false);` : `set role anon; select set_config('request.jwt.claim.sub','',false);`);
    try { return (await rows(sql, p))[0]; } finally { await db.exec("reset role; select set_config('request.jwt.claim.sub','',false);"); }
  };
  const fails = (user: string | null, sql: string, re: RegExp, p: unknown[] = []) => assert.rejects(() => call(user, sql, p), re);
  const service = async (sql: string, p: unknown[] = []) => { await db.exec('set role service_role;'); try { return (await rows(sql, p))[0]; } finally { await db.exec('reset role;'); } };
  let n = 0;
  const student = async (name: string) => {
    const id = `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`;
    await db.query('insert into auth.users values($1)', [id]);
    await db.query("insert into profiles(id,username,college) values($1,$2,'COLENG')", [id, name]);
    await call(id, 'select ensure_player_wallet()');
    return id;
  };
  const balance = async (u: string) => Number((await one('select balance from wallets where user_id=$1', [u])).balance);

  // Drift.
  const server = await rows('select id,welcome,weekly,hustle_bonus_percent from home_backgrounds order by id');
  assert.deepEqual(server, [...BACKGROUNDS].sort((a, b) => a.id.localeCompare(b.id)).map((b) => ({ id: b.id, welcome: b.welcome, weekly: b.weekly, hustle_bonus_percent: b.hustleBonusPercent })));
  assert.equal((await one("select home_week(date '2026-01-04') w")).w, 0, 'week starts on a Sunday');
  assert.equal((await one("select home_week(date '2026-01-10') w")).w, 0, 'Saturday is the same week');
  assert.equal((await one("select home_week(date '2026-01-11') w")).w, 1, 'next Sunday is a new week');

  // Choose once; welcome paid; privacy.
  const rich = await student('Rich'), avg = await student('Avg'), poor = await student('Poor');
  assert.deepEqual((await call(rich, 'select background_state() s')).s, { chosen: false });
  await fails(rich, "select choose_background('royal') r", /Choose comfortable/);
  await fails(null, "select choose_background('comfortable') r", /permission denied|Authentication/);
  const start = await balance(rich);
  const chosen = (await call(rich, "select choose_background('comfortable') r")).r;
  assert.equal(chosen.paid, 30000); assert.equal(await balance(rich), start + 30000);
  assert.equal(chosen.allowance_ready, false, "this week's money is part of the welcome");
  await fails(rich, "select choose_background('struggling') r", /already set/);
  await call(avg, "select choose_background('average') r");
  await call(poor, "select choose_background('struggling') r");
  assert.equal(Number((await call(avg, 'select count(*) n from student_backgrounds')).n), 1, 'students see only their own background');
  await fails(poor, `insert into student_backgrounds(user_id,background) values('${poor}','comfortable')`, /permission denied/);

  // Weekly money from home: once per Sunday-week.
  assert.equal((await call(rich, 'select claim_home_allowance() r')).r.paid, 0, 'nothing more this week');
  await db.query('update student_backgrounds set last_allowance_week=last_allowance_week-1');
  for (const [u, weekly] of [[rich, 25000], [avg, 12000], [poor, 4000]] as const) {
    const before = await balance(u);
    const r = (await call(u, 'select claim_home_allowance() r')).r;
    assert.equal(r.paid, weekly); assert.equal(await balance(u), before + weekly);
    assert.equal((await call(u, 'select claim_home_allowance() r')).r.paid, 0, 'second claim the same week pays nothing');
  }
  const none = await student('Undecided');
  await fails(none, 'select claim_home_allowance() r', /where you are from/);

  // Hustle bonus: job pay through the real trusted job function.
  const runJob = async (u: string) => {
    const job = await one("select * from job_catalog where id='job-sports-cones'");
    const r = await service("select job_action_trusted($1,'accept',$2) r", [u, job.id]);
    await db.query("update job_runs set accepted_at=now()-interval '1 minute' where user_id=$1 and status='accepted'", [u]);
    await service("select job_action_trusted($1,'pickup',null,$2,$3,$4) r", [u, r.r.id, job.source_x, job.source_z]);
    await db.query("update job_runs set pickup_at=now()-interval '1 minute' where id=$1", [r.r.id]);
    await service("select job_action_trusted($1,'deliver',null,$2,$3,$4) r", [u, r.r.id, job.dest_x, job.dest_z]);
    return Number(job.reward);
  };
  for (const [u, pct] of [[rich, 0], [avg, 10], [poor, 20], [none, 0]] as const) {
    const before = await balance(u);
    const reward = await runJob(u);
    const bonus = Math.floor((reward * pct) / 100);
    assert.equal(await balance(u), before + reward + 2000 /* first job of the day */ + bonus, `${pct}% hustle bonus`);
    const lines = await rows("select type,amount from wallet_transactions where user_id=$1 and type in('campus_job','campus_job_bonus','hustle_bonus') order by created_at,type", [u]);
    assert.equal(lines.filter((l) => l.type === 'hustle_bonus').length, pct ? 1 : 0, 'bonus is its own ledger line, never on the first-job bonus');
  }
  // Spending never earns a bonus.
  const before = await balance(poor);
  await db.query("insert into wallet_transactions(user_id,type,amount,balance_after,description) values($1,'food_purchase',-400,0,'Suya')", [poor]);
  assert.equal(await balance(poor), before);
  console.log('BACKGROUNDS DB PASSED: drift, Sunday weeks, one-time choice + welcome, privacy, weekly money once, hustle bonus 0/10/20% via the real job function');
}
main().catch((e) => { console.error(e); process.exit(1); });
