// Activity levels (migration 031): XP from server records, daily cap, idempotency, Worker-only
// court/rally XP, backfill from history, public level, retired academics, drift.
// Run: PGLITE_MODULE=<path to pglite index.cjs> npx tsx scripts/test-levels-db.ts
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { XP_RULES, levelForXp, xpForLevel } from '../src/config/levels';

const require = createRequire(import.meta.url);
const { PGlite } = require(process.env.PGLITE_MODULE || '@electric-sql/pglite');

async function main() {
  const db = new PGlite();
  await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema public,auth to anon,authenticated,service_role;`);
  const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '../supabase/migrations');
  const files = fs.readdirSync(dir).sort();
  const sql = fs.readFileSync(path.join(dir, '031_activity_levels.sql'), 'utf8');
  const rows = async (q: string, p: unknown[] = []) => (await db.query(q, p)).rows as any[];
  const call = async (user: string | null, q: string, p: unknown[] = []) => {
    await db.exec(user ? `set role authenticated; select set_config('request.jwt.claim.sub','${user}',false);` : `set role anon; select set_config('request.jwt.claim.sub','',false);`);
    try { return (await rows(q, p))[0]; } finally { await db.exec("reset role; select set_config('request.jwt.claim.sub','',false);"); }
  };
  const svc = async (q: string, p: unknown[] = []) => { await db.exec('set role service_role;'); try { return (await rows(q, p))[0]; } finally { await db.exec('reset role;'); } };
  let n = 0;
  const student = async () => {
    const id = `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`;
    await db.query('insert into auth.users values($1)', [id]);
    await db.query("insert into profiles(id,username,college) values($1,$2,'COLENG')", [id, `s${n}`]);
    await db.query('insert into wallets(user_id,balance) values($1,1000) on conflict do nothing', [id]);
    return id;
  };
  const tx = (u: string, type: string, at = 'now()') =>
    db.query(`insert into wallet_transactions(user_id,type,amount,balance_after,description,created_at) values($1,$2,100,1000,'t',${at})`, [u, type]);

  // History before 031: a veteran with two busy days (one over the cap) and a Game Den match.
  for (const f of files.filter((f) => f < '031')) await db.exec(fs.readFileSync(path.join(dir, f), 'utf8'));
  const vet = await student();
  for (let i = 0; i < 30; i++) await tx(vet, 'campus_job', "now()-interval '3 days'"); // 600 → 400 that day
  await tx(vet, 'lecture_attendance', "now()-interval '2 days'"); // 10
  await db.query("insert into ps_reward_receipts(match_id,user_id,reward,created_at) values('old-match',$1,0,now()-interval '2 days')", [vet]); // 10
  await tx(vet, 'keke_refund', "now()-interval '2 days'"); // not a source
  for (const f of files.filter((f) => f >= '031')) await db.exec(fs.readFileSync(path.join(dir, f), 'utf8'));

  // Drift with the client config.
  assert(sql.includes(`least(v, greatest(0, ${XP_RULES.DAILY_CAP} - xp_today(p_user)))`), 'daily cap');
  for (const [source, xp] of Object.entries(XP_RULES.SOURCES)) assert(sql.includes(`when '${source}' then ${xp}`), `${source} XP`);
  for (const [xp, level] of [[0, 1], [99, 1], [100, 2], [249, 2], [250, 3], [449, 3], [450, 4], [2700, 10], [2699, 9], [100000, levelForXp(100000)]])
    assert.equal((await rows('select xp_level($1) l', [xp]))[0].l, level, `xp_level(${xp})`);
  for (let l = 1; l < 40; l++) assert.equal(levelForXp(xpForLevel(l)), l), assert.equal(levelForXp(xpForLevel(l) - 1), Math.max(1, l - 1));

  // Backfill: 400 (capped day) + 10 + 10, and it does not use today's cap.
  const v = (await call(vet, 'select my_level() l')).l;
  assert.equal(v.xp, 420);
  assert.equal(v.level, levelForXp(420));
  assert.equal(v.today, 0);
  assert.equal(v.cap, XP_RULES.DAILY_CAP);

  // Live XP through existing records.
  const a = await student();
  await tx(a, 'campus_job');
  await tx(a, 'hustle_pay');
  await tx(a, 'keke_refund'); // ignored
  await tx(a, 'ps_reward'); // counted through the receipt instead
  await db.query("insert into ps_reward_receipts(match_id,user_id,reward) values('m1',$1,0)", [a]);
  await svc("select league_event_trusted($1,'football_win','match-9')", [a]);
  await svc("select league_event_trusted($1,'football_win','match-9')", [a]); // idempotent
  let me = (await call(a, 'select my_level() l')).l;
  assert.equal(me.xp, 20 + 15 + 10 + 15);
  assert.equal(me.today, me.xp);

  // Worker-only court/rally XP, once per reference.
  await assert.rejects(call(a, `select xp_event_trusted('${a}','court_win','r1')`), /permission denied/);
  await assert.rejects(call(a, `select award_xp('${a}','campus_job','x')`), /permission denied/);
  assert.equal((await svc("select xp_event_trusted($1,'court_win','court-1') x", [a])).x, 12);
  assert.equal((await svc("select xp_event_trusted($1,'court_win','court-1') x", [a])).x, 0);
  await assert.rejects(svc("select xp_event_trusted($1,'campus_job','x')", [a]), /Unknown XP source/);
  me = (await call(a, 'select my_level() l')).l;
  assert.equal(me.xp, 72);

  // Daily cap: grinding stops at 400 a day, and a payment still succeeds when XP is capped.
  for (let i = 0; i < 40; i++) await tx(a, 'campus_job');
  me = (await call(a, 'select my_level() l')).l;
  assert.equal(me.today, XP_RULES.DAILY_CAP);
  assert.equal(me.xp, XP_RULES.DAILY_CAP);
  assert.equal((await rows("select count(*)::int c from wallet_transactions where user_id=$1 and type='campus_job'", [a]))[0].c, 41);
  // Yesterday's XP doesn't count toward today.
  await db.query("update xp_events set created_at=now()-interval '1 day' where user_id=$1", [a]);
  await tx(a, 'campus_job');
  me = (await call(a, 'select my_level() l')).l;
  assert.equal(me.today, 20);

  // Public level for any signed-in student; no direct table access; anon refused.
  const b = await student();
  assert.equal((await call(b, `select level_public('${a}') l`)).l.level, levelForXp(420));
  assert.equal((await call(b, `select level_public('${b}') l`)).l.level, 1);
  await assert.rejects(call(b, 'select * from player_xp'), /permission denied/);
  await assert.rejects(call(b, 'select * from xp_events'), /permission denied/);
  await assert.rejects(call(null, 'select my_level()'), /permission denied|Authentication/);

  // Academics retired; League and tutoring helpers kept.
  for (const fn of ['academic_state()', 'start_semester_exam()', `academic_public('${a}')`])
    await assert.rejects(call(a, `select ${fn}`), /does not exist/);
  await assert.rejects(call(a, 'select * from academic_records'), /permission denied/);
  assert((await rows('select academic_semester(current_date) s'))[0].s >= 0);
  assert((await rows('select count(*)::int c from lecture_questions'))[0].c > 0);
  assert((await call(a, 'select college_league() l')).l, 'League still works');

  await db.close();
  console.log('LEVELS DB PASSED: XP from records, Game Den/football triggers, Worker-only court XP, idempotency, daily cap, backfill, public level, academics retired, drift.');
}
main().catch((e) => { console.error(e); process.exit(1); });
