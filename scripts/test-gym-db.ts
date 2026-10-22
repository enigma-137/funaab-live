// FUNAAB Fitness Gym (migration 055): session keys match the client, ₦1,000 pass once per session,
// closed hours, funds, Worker-only sales, XP for the pass and for sets (once per station per session).
// Run: PGLITE_MODULE=<path to pglite index.cjs> npm run test:gym:db
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { GYM, GYM_SESSIONS, gymPassKey } from '../src/config/gym';
import { XP_RULES } from '../src/config/levels';

const require = createRequire(import.meta.url);
const { PGlite } = require(process.env.PGLITE_MODULE || '@electric-sql/pglite');

async function main() {
  const db = new PGlite();
  await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema public,auth to anon,authenticated,service_role;`);
  const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '../supabase/migrations');
  for (const f of fs.readdirSync(dir).sort()) await db.exec(fs.readFileSync(path.join(dir, f), 'utf8'));
  const sql = fs.readFileSync(path.join(dir, '055_gym.sql'), 'utf8');
  const rows = async (q: string, p: unknown[] = []) => (await db.query(q, p)).rows as any[];
  const svc = async (q: string, p: unknown[] = []) => { await db.exec('set role service_role;'); try { return (await rows(q, p))[0]; } finally { await db.exec('reset role;'); } };
  const as = async (u: string, q: string) => { await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub','${u}',false);`); try { return (await rows(q))[0]; } finally { await db.exec('reset role;'); } };
  const ada = '00000000-0000-4000-8000-0000000000a1', bisi = '00000000-0000-4000-8000-0000000000b2';
  for (const [id, name, money] of [[ada, 'Ada', 5000], [bisi, 'Bisi', 600]] as const) {
    await db.query('insert into auth.users values($1)', [id]);
    await db.query("insert into profiles(id,username,college) values($1,$2,'COLENG')", [id, name]);
    await db.query('insert into wallets(user_id,balance) values($1,$2) on conflict(user_id) do update set balance=excluded.balance', [id, money]);
  }
  const balance = async (u: string) => Number((await rows('select balance from wallets where user_id=$1', [u]))[0].balance);

  // Drift: fee, hours and XP agree with the client.
  assert(sql.includes(`balance>=${GYM.fee}`) && sql.includes(`balance-${GYM.fee}`), 'fee');
  for (const s of GYM_SESSIONS) assert(sql.includes(`between ${s.opens / 60} and ${s.closes / 60 - 1}`), `${s.id} hours`);
  assert(sql.includes(`'gym_pass' then ${XP_RULES.SOURCES.gym_pass}`) && sql.includes(`'gym_set' then ${XP_RULES.SOURCES.gym_set}`), 'xp');
  for (let m = 0; m < 24 * 60; m += 15) {
    const ms = Date.UTC(2026, 9, 22, 0, 0) - 3600000 + m * 60000; // Lagos midnight + m minutes
    const iso = new Date(ms).toISOString();
    assert.equal((await rows('select gym_pass_key($1) k', [iso]))[0].k, gymPassKey(ms), `pass key at Lagos minute ${m}`);
  }

  // Only the Worker sells passes.
  await assert.rejects(as(ada, `select gym_entry_trusted('${ada}')`), /permission denied/);
  await assert.rejects(as(ada, 'select * from gym_passes'), /permission denied/);

  // Closed hours (force the clock's answer).
  await db.exec("create or replace function public.gym_pass_key(p_at timestamptz default now()) returns text language sql stable as $$ select null::text $$");
  await assert.rejects(svc('select gym_entry_trusted($1)', [ada]), /closed/);
  await db.exec("create or replace function public.gym_pass_key(p_at timestamptz default now()) returns text language sql stable as $$ select '2026-10-22-pm' $$");

  const first = (await svc('select gym_entry_trusted($1) r', [ada])).r;
  assert.deepEqual([first.pass, first.charged, Number(first.balance)], ['2026-10-22-pm', true, 4000]);
  assert.equal((await svc('select gym_entry_trusted($1) r', [ada])).r.charged, false, 'same session is free');
  assert.equal(await balance(ada), 4000);
  const ledger = (await rows("select * from wallet_transactions where user_id=$1 and type='gym_pass'", [ada]));
  assert.equal(ledger.length, 1); assert.match(ledger[0].description, /evening/);
  assert.equal(Number((await rows("select coalesce(sum(amount),0) s from xp_events where user_id=$1 and source='gym_pass'", [ada]))[0].s), XP_RULES.SOURCES.gym_pass, 'XP for the session');
  await assert.rejects(svc('select gym_entry_trusted($1)', [bisi]), /Top up/);
  assert.equal(await balance(bisi), 600);

  // Next session is a new pass.
  await db.exec("create or replace function public.gym_pass_key(p_at timestamptz default now()) returns text language sql stable as $$ select '2026-10-23-am' $$");
  assert.equal((await svc('select gym_entry_trusted($1) r', [ada])).r.charged, true);
  assert.equal(await balance(ada), 3000);

  // Sets: XP once per station per session; only the Worker can award it.
  assert.equal((await svc("select xp_event_trusted($1,'gym_set','2026-10-23-am:treadmill-1') x", [ada])).x, XP_RULES.SOURCES.gym_set);
  assert.equal((await svc("select xp_event_trusted($1,'gym_set','2026-10-23-am:treadmill-1') x", [ada])).x, 0, 'once');
  assert.equal((await svc("select xp_event_trusted($1,'gym_set','2026-10-23-am:dumbbells') x", [ada])).x, XP_RULES.SOURCES.gym_set);
  await assert.rejects(as(ada, `select xp_event_trusted('${ada}','gym_set','x')`), /permission denied/);
  // Earlier sources still work.
  assert.equal((await svc("select xp_event_trusted($1,'arcade_win','pool:m1') x", [bisi])).x, 8);
  console.log('GYM DB PASSED: session keys match the client for every 15 minutes, ₦1,000 once per session, closed hours, funds, Worker-only, XP for pass and sets.');
}
main().catch((e) => { console.error(e); process.exit(1); });
