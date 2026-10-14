// Economy rebalance — database tests (migration 012) + config ↔ database drift checks.
// Run: PGLITE_MODULE=<path to pglite index.cjs> npm run test:economy:db
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { ECONOMY_CONFIG, hostelCreditDebt } from '../src/config/economy';
import { CAMPUS_JOBS } from '../src/config/campusJobs';
import { FOOD_VENDOR_LIST } from '../src/config/foodVendors';
import { HOSTEL_SHOP } from '../src/config/hostelShop';
import { kekeDestinations } from '../src/config/kekeRoutes';

const require = createRequire(import.meta.url);
const { PGlite } = require(process.env.PGLITE_MODULE || '@electric-sql/pglite');
const E = ECONOMY_CONFIG;

async function main() {
  const db = new PGlite();
  await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema public,auth to anon,authenticated,service_role;`);
  const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '../supabase/migrations');
  const files = fs.readdirSync(dir).sort();
  const run = async (names: string[]) => { for (const f of names) await db.exec(fs.readFileSync(path.join(dir, f), 'utf8')); };
  const rows = async (sql: string, p: unknown[] = []) => (await db.query(sql, p)).rows as any[];
  const one = async (sql: string, p: unknown[] = []) => (await rows(sql, p))[0];
  const as = async (user: string | null) =>
    db.exec(user ? `set role authenticated; select set_config('request.jwt.claim.sub','${user}',false);` : `set role anon; select set_config('request.jwt.claim.sub','',false);`);
  const call = async (user: string | null, sql: string, p: unknown[] = []) => {
    await as(user);
    try { return (await rows(sql, p))[0]; } finally { await db.exec("reset role; select set_config('request.jwt.claim.sub','',false);"); }
  };
  const balance = async (u: string) => Number((await one('select balance from wallets where user_id=$1', [u])).balance);
  let n = 0;
  const student = async (name: string) => {
    const id = `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`;
    await db.query('insert into auth.users values($1)', [id]);
    await db.query("insert into profiles(id,username,college) values($1,$2,'COLENG')", [id, name]);
    return id;
  };

  // ---------- Existing player: wallet created under the OLD rules (migrations 001–011) ----------
  const pre012 = files.filter((f) => f < '012');
  assert(files.includes('012_economy_rebalance.sql'));
  await run(pre012);
  const veteran = await student('Veteran');
  assert.equal(Number((await call(veteran, 'select ensure_player_wallet() r')).r.balance), 5000, 'old starter was ₦5,000');
  await db.query('update wallets set balance=3210.50 where user_id=$1', [veteran]); // played for a while
  const veteranTx = Number((await one('select count(*) n from wallet_transactions where user_id=$1', [veteran])).n);

  await run(files.filter((f) => f >= '012'));

  assert.equal(await balance(veteran), 3210.5, 'deployment does not touch existing balances');
  assert.equal((await call(veteran, 'select ensure_player_wallet() r')).r.balance, 3210.5, 'no second starter for existing players');
  assert.equal(Number((await one('select count(*) n from wallet_transactions where user_id=$1', [veteran])).n), veteranTx, 'no new ledger rows');

  // ---------- New player: ₦7,500 exactly once ----------
  const fresh = await student('Fresher');
  for (let i = 0; i < 3; i++) assert.equal(Number((await call(fresh, 'select ensure_player_wallet() r')).r.balance), E.STARTER_BALANCE);
  assert.equal(await balance(fresh), E.STARTER_BALANCE);
  const starters = await rows("select amount from wallet_transactions where user_id=$1 and type='starter_bonus'", [fresh]);
  assert.deepEqual(starters.map((r) => Number(r.amount)), [E.STARTER_BALANCE], 'one starter ledger row');
  assert.equal(Number((await one("select column_default from information_schema.columns where table_name='wallets' and column_name='balance'")).column_default.replace(/[^0-9.]/g, '')), E.STARTER_BALANCE);
  // A first claim before the wallet exists still bootstraps the starter only once.
  const early = await student('EarlyBird');
  const firstDaily = (await call(early, 'select claim_daily_reward() r')).r;
  assert.equal(firstDaily.success, true);
  assert.equal(await balance(early), E.STARTER_BALANCE + E.DAILY_RESUMPTION_ALLOWANCE);
  assert.equal(Number((await one("select count(*) n from wallet_transactions where user_id=$1 and type='starter_bonus'", [early])).n), 1);

  // ---------- Daily reward: ₦500 once per 20 hours ----------
  const d1 = (await call(fresh, 'select claim_daily_reward() r')).r;
  assert.equal(Number(d1.reward), E.DAILY_RESUMPTION_ALLOWANCE);
  assert.equal(await balance(fresh), E.STARTER_BALANCE + E.DAILY_RESUMPTION_ALLOWANCE);
  assert.equal((await call(fresh, 'select claim_daily_reward() r')).r.success, false, 'replay rejected');
  assert.equal((await call(fresh, 'select claim_daily_reward($1) r', [veteran])).r.success, false, 'p_user_id cannot redirect a claim');
  assert.equal(await balance(veteran), 3210.5);
  await db.query("update wallets set last_daily_reward_at=now()-interval '21 hours' where user_id=$1", [fresh]);
  assert.equal((await call(fresh, 'select claim_daily_reward() r')).r.success, true, 'claimable again the next day');
  let expected = E.STARTER_BALANCE + 2 * E.DAILY_RESUMPTION_ALLOWANCE;
  assert.equal(await balance(fresh), expected);

  // ---------- Anonymous callers can no longer move money for a named student ----------
  for (const sql of [
    `select claim_daily_reward('${veteran}')`,
    `select claim_lecture_attendance('x',60,500,'${veteran}')`,
    `select ensure_player_wallet('${veteran}')`,
    `select transfer_money_p2p('Fresher',1000,'gift','${veteran}')`,
  ]) await assert.rejects(() => call(null, sql), /permission denied/, sql);
  assert.equal(await balance(veteran), 3210.5, 'P2P sender spoofing closed');
  // Authenticated transfers still work, from the caller's own wallet.
  assert.equal((await call(veteran, "select transfer_money_p2p('Fresher',10,'hi',$1) r", [fresh])).r.success, true);
  assert.equal(await balance(veteran), 3200.5, 'sender is always the caller, never p_sender_id');
  expected += 10;
  assert.equal(await balance(fresh), expected);

  // ---------- Lecture allowance: server-priced ₦100, capped ----------
  const lec = (id: string, secs = 60, allowance = 500) => call(fresh, 'select claim_lecture_attendance($1,$2,$3,null) r', [id, secs, allowance]);
  assert.equal(Number((await lec('funaab-fst-201')).r.reward), E.ATTENDANCE_ALLOWANCE, 'client allowance ignored');
  expected += E.ATTENDANCE_ALLOWANCE;
  assert.equal((await lec('funaab-fst-201')).r.success, false, 'same lecture once per hour');
  assert.equal((await lec('funaab-cve-201', 10)).r.success, false, 'minimum attendance');
  assert.equal((await lec('funaab-cve-201')).r.success, true);
  assert.equal((await lec('funaab-phy-201')).r.success, true);
  expected += 2 * E.ATTENDANCE_ALLOWANCE;
  const capped = (await lec('made-up-lecture-id')).r;
  assert.equal(capped.success, false, 'daily cap: invented lecture ids cannot mint money');
  assert.match(capped.error, /limit/);
  assert.equal(await balance(fresh), expected);

  // ---------- Food: server menu prices, client amount ignored ----------
  const fwDb = await rows("select id,name,price,item_type from campus_food_menu where vendor='floral_world' order by id");
  assert.deepEqual(fwDb, [...E.FLORAL_WORLD_MENU].sort((a, b) => a.id.localeCompare(b.id)).map((i) => ({ id: i.id, name: i.name, price: i.price, item_type: i.type })), 'Floral World menu drift');
  const fcDb = await rows("select id,name,price,item_type from campus_food_menu where vendor='food_court' order by id");
  assert.deepEqual(fcDb, [...E.FOOD_COURT_MENU].sort((a, b) => a.id.localeCompare(b.id)).map((i) => ({ id: i.id, name: i.name, price: i.price, item_type: i.type })), 'food court menu drift');
  for (const item of [...E.FLORAL_WORLD_MENU, ...E.FOOD_COURT_MENU]) {
    const r = (await call(fresh, "select process_wallet_purchase('food_purchase',1,'cheap',$1,'Free food',null) r", [item.id])).r;
    assert.equal(r.success, true); assert.equal(Number(r.price), item.price, `${item.id} charged at server price`);
    expected -= item.price;
  }
  assert.equal(await balance(fresh), expected);
  await assert.rejects(() => call(fresh, "select process_wallet_purchase('food_purchase',0,'x','golden_meal','Golden',null)"), /not on any campus menu/);
  for (const v of FOOD_VENDOR_LIST) {
    const items = await rows('select id,name,price from food_vendor_items where vendor_id=$1 order by id', [v.id]);
    assert.deepEqual(items, [...v.items].sort((a, b) => a.id.localeCompare(b.id)).map(({ id, name, price }) => ({ id, name, price })), `${v.id} drift`);
  }
  // Every ordinary meal is in the ₦250–₦600 band and drinks in ₦50–₦200.
  const meals = [...E.FLORAL_WORLD_MENU, ...E.FOOD_COURT_MENU, ...FOOD_VENDOR_LIST.flatMap((v) => v.items.map((i) => ({ ...i, type: 'food' })))];
  for (const m of meals) assert(m.type === 'drink' ? m.price >= 50 && m.price <= 200 : m.price >= 250 && m.price <= 600, `${m.id} price band`);

  // ---------- Lawn fine still ₦500 ----------
  assert.equal(E.LAWN_FINE, 500);
  await call(fresh, "select process_wallet_purchase('lawn_fine',$1,'Lawn Fine (Security Enforcement)',null,null,null)", [E.LAWN_FINE]);
  expected -= 500;
  assert.equal(await balance(fresh), expected);

  // ---------- Jobs: config = database, server pay, first-job bonus once per Lagos day ----------
  for (const j of CAMPUS_JOBS) {
    const row = await one('select reward,source_x,source_z,dest_x,dest_z from job_catalog where id=$1', [j.id]);
    assert.equal(Number((await one('select dest_radius from job_catalog where id=$1', [j.id])).dest_radius), j.destRadius ?? 5, `${j.id} radius drift`);
    assert.deepEqual([row.reward, ...['source_x', 'source_z', 'dest_x', 'dest_z'].map((k) => Number(row[k]))],
      [j.reward, j.sourcePos[0], j.sourcePos[2], j.destinationPos[0], j.destinationPos[2]], `${j.id} drift`);
  }
  assert.deepEqual(CAMPUS_JOBS.map((j) => j.reward), [500, 350, 300, 250], 'jobs pay different amounts');
  const doJob = async (u: string, job: typeof CAMPUS_JOBS[number], at = job.destinationPos) => {
    const accepted = (await one("select job_action_trusted($1,'accept',$2) r", [u, job.id])).r;
    await db.query("update job_runs set accepted_at=now()-interval '1 minute' where id=$1", [accepted.id]);
    await db.query("select job_action_trusted($1,'pickup',null,$2,$3,$4)", [u, accepted.id, job.sourcePos[0], job.sourcePos[2]]);
    await db.query("update job_runs set pickup_at=now()-interval '1 minute' where id=$1", [accepted.id]);
    return { id: accepted.id, done: (await one("select job_action_trusted($1,'deliver',null,$2,$3,$4) r", [u, accepted.id, at[0], at[2]])).r };
  };
  const worker = await student('Worker');
  await call(worker, 'select ensure_player_wallet()');
  const delivery = CAMPUS_JOBS[0];
  // COLENG drop-off (027): too far out on the forecourt is refused…
  await assert.rejects(() => doJob(worker, delivery, [80, 0, -45]), /correct destination/);
  await db.query("update job_runs set status='cancelled' where user_id=$1 and status='picked_up'", [worker]);
  // …but standing right at COLENG's door (where students stop) delivers.
  const first = await doJob(worker, delivery, [80, 0, -57.1]);
  assert.equal(first.done.paid, 500); assert.equal(first.done.bonus, E.FIRST_JOB_DAILY_BONUS);
  assert.equal(await balance(worker), E.STARTER_BALANCE + 500 + 200, 'job pay + first job bonus');
  const replay = (await one("select job_action_trusted($1,'deliver',null,$2,$3,$4) r", [worker, first.id, delivery.destinationPos[0], delivery.destinationPos[2]])).r;
  assert.equal(replay.bonus, undefined, 'replayed delivery pays nothing');
  assert.equal(await balance(worker), E.STARTER_BALANCE + 700);
  const second = await doJob(worker, CAMPUS_JOBS[2]);
  assert.equal(second.done.paid, 300); assert.equal(second.done.bonus, 0, 'bonus only for the first job of the day');
  assert.equal(await balance(worker), E.STARTER_BALANCE + 1000);
  assert.equal(Number((await one("select count(*) n from wallet_transactions where user_id=$1 and type='campus_job_bonus'", [worker])).n), 1);
  // Yesterday's completions don't block today's bonus.
  await db.query("update job_runs set completed_at=completed_at-interval '30 hours' where user_id=$1", [worker]);
  assert.equal((await doJob(worker, CAMPUS_JOBS[1])).done.bonus, E.FIRST_JOB_DAILY_BONUS);

  // ---------- Game Den: 250 / 100, replay-safe, same-pair cap ----------
  const a = await student('Ade'), b = await student('Bola');
  for (const u of [a, b]) await call(u, 'select ensure_player_wallet()');
  const ps = (match: string, winner: string | null) => db.query('select ps_reward_trusted($1,$2,$3,$4)', [match, a, b, winner]);
  await ps('m1', a); await ps('m1', a);
  assert.equal(await balance(a), E.STARTER_BALANCE + E.GAME_DEN.WINNER);
  assert.equal(await balance(b), E.STARTER_BALANCE + E.GAME_DEN.LOSER, 'loser still earns; replay pays nothing');
  await db.query("update ps_reward_receipts set created_at=created_at-interval '5 minutes'");
  await ps('m2', b);
  await db.query("update ps_reward_receipts set created_at=created_at-interval '5 minutes'");
  await ps('m3', a);
  assert.equal(await balance(a), E.STARTER_BALANCE + 250 + 100, 'third match vs the same opponent unpaid');
  assert.equal(await balance(b), E.STARTER_BALANCE + 100 + 250);
  const c = await student('Chika');
  await call(c, 'select ensure_player_wallet()');
  await db.query('select ps_reward_trusted($1,$2,$3,null)', ['m4', a, c]);
  assert.equal(await balance(c), E.STARTER_BALANCE + E.GAME_DEN.DRAW, 'new opponent is paid');

  // ---------- Hostel prices + credit ----------
  for (const i of HOSTEL_SHOP) assert.equal((await one('select price from hostel_catalog where id=$1', [i.id])).price, i.price, `${i.id} drift`);
  const shopper = await student('Shopper');
  await call(shopper, 'select ensure_player_wallet()');
  const buy = (item: string, credit = false) => call(shopper, "select hostel_command('purchase',$1::jsonb) r", [JSON.stringify({ item, credit })]);
  await buy('hostel_chair');
  assert.equal(await balance(shopper), E.STARTER_BALANCE - 200);
  await buy('hostel_tv_basic', true);
  assert.equal(Number((await one("select amount from game_debts where user_id=$1 and item_id='hostel_tv_basic'", [shopper])).amount), hostelCreditDebt(900));
  await assert.rejects(() => buy('hostel_ps_console', true), /credit limit/, 'credit limit unchanged at ₦1,500');
  assert.equal(E.HOSTEL_CREDIT_LIMIT, 1500);
  // A new player can still buy TV + PS + generator outright only by saving: 900+1500+1200 = 3,600 of 7,500.
  assert(900 + 1500 + 1200 < E.STARTER_BALANCE && 900 + 1500 + 1200 > E.STARTER_BALANCE / 3);

  // ---------- Keke stays cheap and within the trusted fare bounds ----------
  const fares = kekeDestinations.map((d) => d.fare);
  assert(Math.min(...fares) >= 30 && Math.max(...fares) <= 120, 'trusted fare bounds');
  assert(Math.max(...fares) <= 90, 'no Keke fare increase');

  console.log(`ECONOMY DATABASE PASSED: existing balance untouched, ₦${E.STARTER_BALANCE} starter once, ₦${E.DAILY_RESUMPTION_ALLOWANCE} daily once, anon money RPCs closed (incl. P2P sender spoofing), lecture ₦${E.ATTENDANCE_ALLOWANCE} server-priced and capped, ${fwDb.length + fcDb.length} menu items server-priced, vendor/hostel/job drift, first-job bonus once per day, Game Den 250/100 + pair cap, lawn ₦500, Keke ₦${Math.min(...fares)}–₦${Math.max(...fares)}.`);
}
main().catch((e) => { console.error(e); process.exit(1); });
