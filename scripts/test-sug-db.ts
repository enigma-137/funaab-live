// SUG elections (migration 034): the weekly calendar, who may run and vote, the fee, secret
// tallies until Sunday, the winner (ties to the earliest), the President's daily announcement.
// Run: PGLITE_MODULE=<path to pglite index.cjs> npx tsx scripts/test-sug-db.ts
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { SUG, SUG_BLOCKED, sugCycle, sugPhase, sugTextProblem } from '../src/config/sug';

const require = createRequire(import.meta.url);
const { PGlite } = require(process.env.PGLITE_MODULE || '@electric-sql/pglite');

async function main() {
  const db = new PGlite();
  await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema public,auth to anon,authenticated,service_role;`);
  const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '../supabase/migrations');
  for (const f of fs.readdirSync(dir).sort()) await db.exec(fs.readFileSync(path.join(dir, f), 'utf8'));
  let sql = fs.readFileSync(path.join(dir, '034_sug_elections.sql'), 'utf8');
  // Amounts may have been rescaled since (039): also check the live functions as they are now.
  sql += (await db.query("select string_agg(pg_get_functiondef(p.oid), chr(10)) d from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prokind='f'")).rows[0].d + fs.readFileSync(path.join(dir, '039_economy_x10.sql'), 'utf8');
  const rows = async (q: string, p: unknown[] = []) => (await db.query(q, p)).rows as any[];
  const as = async (u: string | null, q: string, p: unknown[] = []) => {
    await db.exec(u ? `set role authenticated; select set_config('request.jwt.claim.sub','${u}',false);` : `set role anon; select set_config('request.jwt.claim.sub','',false);`);
    try { return (await rows(q, p))[0]; } finally { await db.exec("reset role; select set_config('request.jwt.claim.sub','',false);"); }
  };
  const day = (d: string) => db.exec(`create or replace function public.lagos_today() returns date language sql stable as $$ select date '${d}' $$`);
  let n = 0;
  const student = async (name: string, xp: number, money = 50000) => {
    const id = `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`;
    await db.query('insert into auth.users values($1)', [id]);
    await db.query("insert into profiles(id,username,college) values($1,$2,'COLENG')", [id, name]);
    await db.query('insert into wallets(user_id,balance) values($1,$2) on conflict(user_id) do update set balance=excluded.balance', [id, money]);
    if (xp) await db.query('insert into player_xp(user_id,xp) values($1,$2)', [id, xp]);
    return id;
  };
  const balance = async (u: string) => Number((await rows('select balance from wallets where user_id=$1', [u]))[0].balance);
  const state = async (u: string) => (await as(u, 'select sug_state() s')).s;

  // Calendar and rules agree with the client.
  for (const [d, phase] of [['2026-10-12', 'nominations'], ['2026-10-14', 'nominations'], ['2026-10-15', 'voting'], ['2026-10-17', 'voting'], ['2026-10-18', 'results']] as const) {
    const ms = Date.parse(`${d}T12:00:00Z`);
    assert.equal(sugPhase(ms), phase, `client phase ${d}`);
    const r = (await rows(`select sug_phase($1::date) p, sug_cycle($1::date) c`, [d]))[0];
    assert.equal(r.p, phase, `db phase ${d}`); assert.equal(r.c, sugCycle(ms), `cycle ${d}`);
  }
  assert.equal(sugCycle(Date.parse('2026-10-11T23:30:00Z')), sugCycle(Date.parse('2026-10-12T05:00:00Z')), '00:30 Monday Lagos is already the new week');
  for (const w of SUG_BLOCKED) assert(sql.includes(`'${w}'`), `blocked word ${w}`);
  assert(sql.includes(`balance>=${SUG.NOMINATION_FEE}`) && sql.includes(`>=${SUG.MAX_CANDIDATES}`) && sql.includes(`sug_user_level(me)<${SUG.MIN_LEVEL_TO_RUN}`) && sql.includes(`sug_user_level(me)<${SUG.MIN_LEVEL_TO_VOTE}`), 'rules drift');
  assert.equal(sugTextProblem('Free wifi www.x.com', 200), 'No links, please.');
  assert.equal(sugTextProblem('ok', 200), 'Write a little more.');

  const ada = await student('Ada', 250), bisi = await student('Bisi', 300), chidi = await student('Chidi', 120);
  const tunde = await student('Tunde', 0), voters = [await student('V1', 100), await student('V2', 100), await student('V3', 100)];

  // Monday: nominations.
  await day('2026-10-12');
  await assert.rejects(as(null, 'select sug_state()'), /permission denied|Authentication/);
  await assert.rejects(as(ada, 'select * from sug_candidates'), /permission denied/);
  await assert.rejects(as(chidi, "select sug_nominate('Vote Chidi for better roads')"), /Level 3/);
  await assert.rejects(as(ada, "select sug_nominate('You are all mumu')"), /clean/);
  await assert.rejects(as(ada, `select sug_nominate($1)`, ['x'.repeat(SUG.MANIFESTO_MAX + 1)]), /under 200/);
  await as(ada, "select sug_nominate('Free Wi-Fi in every hostel and later Arena nights')");
  assert.equal(await balance(ada), 40000, '₦10,000 nomination fee');
  await assert.rejects(as(ada, "select sug_nominate('Again')"), /already running/);
  await as(bisi, "select sug_nominate('More keke routes and cheaper suya')");
  await assert.rejects(as(voters[0], `select sug_vote('${ada}')`), /Thursday to Saturday/);
  let s = await state(chidi);
  assert.equal(s.phase, 'nominations'); assert.equal(s.candidates.length, 2); assert.equal(s.candidates[0].username, 'Ada');
  assert.equal(s.candidates[0].votes, undefined, 'no tallies before results');
  assert.equal(s.president, null);

  // Thursday: voting.
  await day('2026-10-15');
  await assert.rejects(as(chidi, "select sug_nominate('Late entry here')"), /Monday to Wednesday/);
  await assert.rejects(as(ada, 'select sug_withdraw()'), /before voting/);
  await assert.rejects(as(tunde, `select sug_vote('${ada}')`), /Level 2/);
  await assert.rejects(as(chidi, `select sug_vote('${chidi}')`), /not on the ballot/);
  await as(voters[0], `select sug_vote('${ada}')`);
  await as(voters[1], `select sug_vote('${bisi}')`);
  await as(voters[2], `select sug_vote('${ada}')`);
  await as(voters[2], `select sug_vote('${bisi}')`); // changed their mind
  await as(chidi, `select sug_vote('${ada}')`);
  s = await state(voters[2]);
  assert.equal(s.my_vote, bisi); assert.equal(s.candidates[0].votes, undefined, 'still secret while voting');
  assert.equal((await rows('select count(*)::int c from sug_votes'))[0].c, 4, 'one vote per student');

  // Sunday: 2–2 tie → Ada declared first, so Ada wins.
  await day('2026-10-18');
  s = await state(tunde);
  assert.equal(s.phase, 'results');
  assert.deepEqual(s.candidates.map((c: any) => [c.username, Number(c.votes)]), [['Ada', 2], ['Bisi', 2]]);
  assert.equal(s.president.username, 'Ada');
  assert.equal(s.can_announce, false);
  assert.equal((await state(ada)).can_announce, true);
  await assert.rejects(as(bisi, "select sug_announce('Party at the Arena tonight')"), /Only the SUG President/);
  await assert.rejects(as(ada, "select sug_announce('Check www.scam.example now')"), /links/);
  await as(ada, "select sug_announce('Free zobo at the Arena tonight from 9 PM!')");
  // The test fakes the calendar day, not the clock: date the announcement on that (fake) Sunday.
  await db.exec("update sug_announcements set created_at=('2026-10-18 10:00'::timestamp at time zone 'Africa/Lagos')");
  await assert.rejects(as(ada, "select sug_announce('Another one')"), /One announcement a day/);
  s = await state(tunde);
  assert.equal(s.announcement.body, 'Free zobo at the Arena tonight from 9 PM!'); assert.equal(s.announcement.username, 'Ada');

  // Next Monday: Ada is still President; last week's results are public; a new race starts.
  await day('2026-10-19');
  s = await state(bisi);
  assert.equal(s.president.username, 'Ada'); assert.equal(s.phase, 'nominations');
  assert.equal(s.candidates.length, 0); assert.equal(s.last_results.length, 2);
  // Withdrawal in nominations; no votes → nobody wins and the office is vacant the week after.
  await as(bisi, "select sug_nominate('Second try for better lights')");
  await as(bisi, 'select sug_withdraw()');
  await day('2026-10-25');
  assert.equal((await state(bisi)).president, null, 'no votes, no President');

  await db.close();
  console.log('SUG DB PASSED: weekly calendar matches the client, run/vote levels, fee, clean manifestos, secret tallies, changeable vote, tie to earliest, President announcement once a day, vacancy, privacy, drift.');
}
main().catch((e) => { console.error(e); process.exit(1); });
