// Hustles (migration 019): room shop, POS/photo/tutoring payouts, shared daily cap, errand escrow.
// Run: PGLITE_MODULE=<path to pglite index.cjs> npm run test:hustles:db
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { HUSTLE_RULES, SHOP_STOCK, SHOP_RULES, POS_KIOSK, TUTORING, PHOTO_RULES, ERRAND_KINDS, ERRAND_RULES } from '../src/config/hustles';

const require = createRequire(import.meta.url);
const { PGlite } = require(process.env.PGLITE_MODULE || '@electric-sql/pglite');

async function main() {
  const db = new PGlite();
  await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema public,auth to anon,authenticated,service_role;`);
  const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '../supabase/migrations');
  const sql018 = fs.readFileSync(path.join(dir, '019_hustles.sql'), 'utf8');
  for (const f of fs.readdirSync(dir).sort()) await db.exec(fs.readFileSync(path.join(dir, f), 'utf8'));
  const rows = async (sql: string, p: unknown[] = []) => (await db.query(sql, p)).rows as any[];
  const one = async (sql: string, p: unknown[] = []) => (await rows(sql, p))[0];
  const call = async (user: string | null, sql: string, p: unknown[] = []) => {
    await db.exec(user ? `set role authenticated; select set_config('request.jwt.claim.sub','${user}',false);` : `set role anon; select set_config('request.jwt.claim.sub','',false);`);
    try { return (await rows(sql, p))[0]; } finally { await db.exec("reset role; select set_config('request.jwt.claim.sub','',false);"); }
  };
  const fails = (user: string | null, sql: string, re: RegExp, p: unknown[] = []) => assert.rejects(() => call(user, sql, p), re);
  const service = async (sql: string, p: unknown[] = []) => { await db.exec('set role service_role;'); try { return (await rows(sql, p))[0]; } finally { await db.exec('reset role;'); } };
  const serviceFails = (sql: string, re: RegExp, p: unknown[] = []) => assert.rejects(() => service(sql, p), re);
  let n = 0;
  const student = async (name: string, bg?: string) => {
    const id = `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`;
    await db.query('insert into auth.users values($1)', [id]);
    await db.query("insert into profiles(id,username,college) values($1,$2,'COLENG')", [id, name]);
    await call(id, 'select ensure_player_wallet()');
    if (bg) await call(id, 'select choose_background($1)', [bg]);
    return id;
  };
  const balance = async (u: string) => Number((await one('select balance from wallets where user_id=$1', [u])).balance);
  const resetCap = (u: string) => db.query("update hustle_payments set created_at=created_at-interval '2 days' where user_id=$1", [u]);

  // ---------- Drift ----------
  const stock = await rows('select id,cost,units,unit_price from shop_stock_catalog order by id');
  assert.deepEqual(stock, Object.values(SHOP_STOCK).map(({ id, cost, units, unitPrice }) => ({ id, cost, units, unit_price: unitPrice })).sort((a, b) => a.id.localeCompare(b.id)));
  for (const [needle, what] of [[`least(p_amount, greatest(0, ${HUSTLE_RULES.DAILY_CAP}-hustle_paid_today`, 'daily cap'], [`/1200)`, 'minutes per sale'], [`15-shop_sold_today`, 'sales per day'],
    [`units between 0 and ${SHOP_RULES.MAX_UNITS_IN_SHOP}`, 'shelf'], [`p_amount<>${POS_KIOSK.pay}`, 'POS pay'], [`interval '${POS_KIOSK.cooldownMinutes} minutes'`, 'POS cooldown'],
    [`v_score*${TUTORING.payPerCorrect}`, 'tutor pay'], [`interval '${PHOTO_RULES.cooldownMinutes} minutes'`, 'photo cooldown'], [`reward between ${ERRAND_RULES.minReward} and ${ERRAND_RULES.maxReward}`, 'errand reward'],
    [`interval '${ERRAND_RULES.expiresMinutes} minutes'`, 'errand expiry'], [`>=${ERRAND_RULES.maxOpenPerStudent} then raise`, 'open errands']] as const)
    assert(sql018.includes(needle), `${what} matches config (${needle})`);
  assert.equal(SHOP_RULES.MINUTES_PER_SALE * 60, 1200); assert.equal(SHOP_RULES.MAX_SALES_PER_DAY, 15);
  for (const k of ERRAND_KINDS) assert(sql018.includes(`'${k.id}'`), `errand kind ${k.id}`);
  assert.deepEqual([PHOTO_RULES.base, PHOTO_RULES.base + PHOTO_RULES.perClient * PHOTO_RULES.maxClients], [100, 400]);

  // ---------- Privileges ----------
  const ada = await student('Ada');
  for (const f of ["hustle_pay_trusted('" + ada + "','pos','x',250)", "pay_hustle('" + ada + "','shop','x',100,'t')", "tutoring_start_trusted('" + ada + "')", "errand_complete_trusted(gen_random_uuid(),'" + ada + "')"])
    await fails(ada, `select ${f}`, /permission denied/);
  await fails(ada, 'select * from room_shops', /permission denied/);
  await fails(null, 'select shop_state()', /permission denied|Authentication/);

  // ---------- Room shop ----------
  let start = await balance(ada);
  await call(ada, "select restock_shop('snacks')");
  assert.equal(await balance(ada), start - 600);
  await call(ada, "select restock_shop('snacks')"); await call(ada, "select restock_shop('snacks')");
  await fails(ada, "select restock_shop('snacks')", /shelf is full/);
  await fails(ada, "select restock_shop('suya')", /doesn't sell/);
  let st = (await call(ada, 'select shop_state() s')).s;
  assert.equal(st.items.find((i: any) => i.item === 'snacks').units, 30);
  assert.equal((await call(ada, 'select collect_shop() r')).r.paid, 0, 'nothing sold yet');
  await db.query("update room_shops set selling_since=now()-interval '61 minutes' where user_id=$1", [ada]);
  start = await balance(ada);
  const c1 = (await call(ada, 'select collect_shop() r')).r;
  assert.equal(c1.paid, 3 * 90, '3 sales in an hour'); assert.equal(await balance(ada), start + 270);
  assert.equal(c1.items.find((i: any) => i.item === 'snacks').units, 27);
  assert.equal((await call(ada, 'select collect_shop() r')).r.paid, 0, 'collecting twice pays once');
  await db.query("update room_shops set selling_since=now()-interval '24 hours' where user_id=$1", [ada]);
  assert.equal((await call(ada, 'select collect_shop() r')).r.paid, 12 * 90, 'capped at 15 sales a day (3 already)');
  assert.equal((await call(ada, 'select shop_state() s')).s.items.find((i: any) => i.item === 'snacks').units, 15, 'unsold stock stays on the shelf');

  // Struggling students get the 018 hustle bonus on shop sales.
  const tunde = await student('Tunde', 'struggling');
  await call(tunde, "select restock_shop('data')");
  await db.query("update room_shops set selling_since=now()-interval '41 minutes' where user_id=$1", [tunde]);
  start = await balance(tunde);
  await call(tunde, 'select collect_shop() r');
  assert.equal(await balance(tunde), start + 260 + 52, '2 sales × ₦130 + 20%');

  // ---------- Worker-paid hustles: POS, photos (validation, cooldown, idempotency) ----------
  const bisi = await student('Bisi');
  start = await balance(bisi);
  assert.equal((await service("select hustle_pay_trusted($1,'pos','shift-1',250) n", [bisi])).n, 250);
  assert.equal((await service("select hustle_pay_trusted($1,'pos','shift-1',250) n", [bisi])).n, 0, 'same shift is never paid twice');
  await serviceFails("select hustle_pay_trusted($1,'pos','shift-2',250)", /short break/, [bisi]);
  await serviceFails("select hustle_pay_trusted($1,'pos','shift-3',9999)", /Invalid POS pay/, [bisi]);
  await serviceFails("select hustle_pay_trusted($1,'photo','p1',150)", /Invalid photo pay/, [bisi]);
  assert.equal((await service("select hustle_pay_trusted($1,'photo','p1',300) n", [bisi])).n, 300);
  await serviceFails("select hustle_pay_trusted($1,'mint','x',100)", /Unknown hustle/, [bisi]);
  assert.equal(await balance(bisi), start + 550);

  // Daily cap is shared and partial payments stop exactly at ₦2,500.
  await db.query("update hustle_payments set created_at=now()-interval '10 minutes' where user_id=$1", [bisi]);
  for (let i = 0; i < 6; i++) {
    await db.query("update hustle_payments set created_at=created_at-interval '10 minutes' where user_id=$1", [bisi]);
    await service("select hustle_pay_trusted($1,'photo',$2,400) n", [bisi, `cap-${i}`]).catch(() => null);
  }
  assert.equal(Number((await one('select hustle_paid_today($1) n', [bisi])).n), HUSTLE_RULES.DAILY_CAP);
  await db.query("update hustle_payments set created_at=created_at-interval '10 minutes' where user_id=$1 and created_at>now()-interval '1 hour'", [bisi]);
  await db.query("update hustle_payments set created_at=lagos_today()::timestamp at time zone 'Africa/Lagos' + interval '1 second' where user_id=$1", [bisi]);
  await serviceFails("select hustle_pay_trusted($1,'photo','cap-x',100)", /hustle limit/, [bisi]);
  await resetCap(bisi);

  // ---------- Tutoring ----------
  const t = (await service('select tutoring_start_trusted($1) t', [bisi])).t;
  assert.equal(t.questions.length, TUTORING.questions);
  assert(!JSON.stringify(t).includes('"answer"'));
  assert.equal((await service('select tutoring_start_trusted($1) t', [bisi])).t.session, t.session, 'resumes the open session');
  const right = Object.fromEntries((await rows('select id,answer from lecture_questions where id=any($1)', [t.questions.map((q: any) => q.id)])).map((r) => [r.id, r.answer]));
  const two = Object.fromEntries(Object.entries(right).slice(0, 2));
  const tr = (await service('select tutoring_submit_trusted($1,$2,$3) r', [bisi, t.session, JSON.stringify(two)])).r;
  assert.deepEqual([tr.score, tr.paid], [2, 160]);
  await serviceFails('select tutoring_submit_trusted($1,$2,$3)', /Already submitted/, [bisi, t.session, '{}']);
  await serviceFails('select tutoring_start_trusted($1)', /few minutes/, [bisi]);

  // ---------- Errands: escrow, accept, cancel, complete, expire; never minted ----------
  const poster = await student('Poster'), runner = await student('Runner', 'struggling');
  start = await balance(poster);
  await fails(poster, "select post_errand('buy_food',20)", /₦50/);
  await fails(poster, "select post_errand('hack',100)", /Pick an errand/);
  const board = (await call(poster, "select post_errand('buy_food',500) b")).b;
  assert.equal(await balance(poster), start - 500, 'reward held in escrow');
  const errand = board.mine[0].id;
  await call(poster, "select post_errand('bring_notes',100)");
  await fails(poster, "select post_errand('carry_load',100)", /2 errands/);
  await fails(poster, 'select accept_errand($1)', /own errand/, [errand]);
  const seen = (await call(runner, 'select errand_board() b')).b.open;
  assert(seen.some((e: any) => e.id === errand && e.poster === 'Poster' && e.reward === 500));
  await call(runner, 'select accept_errand($1)', [errand]);
  await fails(await student('Late'), 'select accept_errand($1)', /no longer available/, [errand]);
  await fails(poster, 'select cancel_errand($1)', /already running/, [errand]);
  await serviceFails('select errand_complete_trusted($1,$2)', /not yours/, [errand, poster]);
  const runnerStart = await balance(runner);
  const done = (await service('select errand_complete_trusted($1,$2) r', [errand, runner])).r;
  assert.equal(done.paid, 500);
  assert.equal(await balance(runner), runnerStart + 500, 'exactly the escrow: errands never earn the hustle bonus');
  assert.equal(Number((await one("select count(*) n from wallet_transactions where user_id=$1 and type='hustle_bonus'", [runner])).n), 0);
  await serviceFails('select errand_complete_trusted($1,$2)', /not yours/, [errand, runner]);
  // Poster cancels the other one: full refund.
  const other = (await call(poster, 'select errand_board() b')).b.mine.find((e: any) => e.kind === 'bring_notes').id;
  const before = await balance(poster);
  await call(poster, 'select cancel_errand($1)', [other]);
  assert.equal(await balance(poster), before + 100);
  // Expiry refunds after 2 hours, even if accepted.
  const exp = (await call(poster, "select post_errand('queue_for_me',200) b")).b.mine[0].id;
  await call(runner, 'select accept_errand($1)', [exp]);
  await db.query("update errands set created_at=now()-interval '121 minutes' where id=$1", [exp]);
  const b2 = await balance(poster);
  await call(runner, 'select errand_board()');
  assert.equal(await balance(poster), b2 + 200);
  assert.equal((await one('select status from errands where id=$1', [exp])).status, 'expired');
  // Blocked students don't see each other's errands.
  const fresh = (await call(poster, "select post_errand('deliver_message',60) b")).b.mine[0].id;
  await db.query('insert into blocks(user_id,blocked_user_id) values($1,$2)', [poster, runner]);
  assert(!(await call(runner, 'select errand_board() b')).b.open.some((e: any) => e.id === fresh));
  await fails(runner, 'select accept_errand($1)', /no longer available/, [fresh]);
  console.log('HUSTLES DB PASSED: drift, privileges, room shop (shelf, 20-min sales, 15/day, offline, bonus), POS/photo validation + cooldown + idempotency, shared ₦2,500 cap, tutoring, errand escrow/accept/cancel/complete/expire/blocks, no minting');
}
main().catch((e) => { console.error(e); process.exit(1); });
