// Off-campus lodge (migration 020): rent, prepay limit, grace, eviction back to the hostel with
// furniture kept, capacity for the Worker, public flag, drift with src/config/lodge.ts.
// Run: PGLITE_MODULE=<path to pglite index.cjs> npm run test:lodge:db
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { LODGE } from '../src/config/lodge';

const require = createRequire(import.meta.url);
const { PGlite } = require(process.env.PGLITE_MODULE || '@electric-sql/pglite');

async function main() {
  const db = new PGlite();
  await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema public,auth to anon,authenticated,service_role;`);
  const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '../supabase/migrations');
  let sql = fs.readFileSync(path.join(dir, '020_off_campus_lodge.sql'), 'utf8');
  // The lodge ran until 046 closed it; replay up to then, then check the closure at the end.
  for (const f of fs.readdirSync(dir).sort().filter((f) => f < '046')) await db.exec(fs.readFileSync(path.join(dir, f), 'utf8'));
  // Amounts may have been rescaled since (039): also check the live functions as they are now.
  sql += (await db.query("select string_agg(pg_get_functiondef(p.oid), chr(10)) d from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prokind='f'")).rows[0].d + fs.readFileSync(path.join(dir, '039_economy_x10.sql'), 'utf8');
  const rows = async (q: string, p: unknown[] = []) => (await db.query(q, p)).rows as any[];
  const one = async (q: string, p: unknown[] = []) => (await rows(q, p))[0];
  const call = async (user: string | null, q: string, p: unknown[] = []) => {
    await db.exec(user ? `set role authenticated; select set_config('request.jwt.claim.sub','${user}',false);` : `set role anon; select set_config('request.jwt.claim.sub','',false);`);
    try { return (await rows(q, p))[0]; } finally { await db.exec("reset role; select set_config('request.jwt.claim.sub','',false);"); }
  };
  const fails = (user: string | null, q: string, re: RegExp) => assert.rejects(() => call(user, q), re);
  let n = 0;
  const student = async (name: string) => {
    const id = `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`;
    await db.query('insert into auth.users values($1)', [id]);
    await db.query("insert into profiles(id,username,college) values($1,$2,'COLENG')", [id, name]);
    await call(id, 'select ensure_player_wallet()');
    return id;
  };
  const balance = async (u: string) => Number((await one('select balance from wallets where user_id=$1', [u])).balance);
  const style = async (u: string) => (await one('select style from hostel_rooms where owner_id=$1', [u])).style;

  // Drift.
  for (const [needle, what] of [[`b<${LODGE.weeklyRent}`, 'rent'], [`interval '${LODGE.graceDays} days'`, 'grace'], [`paid_until-now() > interval '${(LODGE.maxPrepaidWeeks - 1) * 7} days'`, 'prepay'],
    [`then ${LODGE.capacity} else ${LODGE.hostelCapacity} end`, 'capacity']] as const) assert(sql.includes(needle), `${what} matches config`);

  const ada = await student('Ada');
  assert.equal(await style(ada), 'resumption', 'everyone starts in the hostel');
  await fails(ada, 'select lodge_settle(auth.uid())', /permission denied/);
  await fails(ada, `select room_capacity_trusted('${ada}')`, /permission denied/);
  await fails(null, 'select rent_lodge()', /permission denied|Authentication/);
  assert.equal((await call(ada, 'select lodge_state() s')).s.renting, false);
  await fails(ada, 'select pay_lodge_rent()', /don't rent/);

  // Rent: charged, room restyled, furniture untouched.
  await db.query("insert into room_placements(owner_id,item_id,anchor,rotation,x,y,z) values($1,'hostel_chair','free:hostel_chair',0,1,0,0)", [ada]);
  const furniture = Number((await one('select count(*) n from room_placements where owner_id=$1', [ada])).n);
  assert(furniture > 0, 'test room has furniture');
  let start = await balance(ada);
  const r = (await call(ada, 'select rent_lodge() r')).r;
  assert.equal(r.renting, true); assert.equal(r.capacity, LODGE.capacity);
  assert.equal(await balance(ada), start - LODGE.weeklyRent);
  assert.equal(await style(ada), 'lodge');
  await fails(ada, 'select rent_lodge()', /already rent/);
  assert.equal((await call(ada, `select lodge_public('${ada}') p`)).p, true);
  const svc = async (q: string) => { await db.exec('set role service_role;'); try { return (await rows(q))[0]; } finally { await db.exec('reset role;'); } };
  assert.equal((await svc(`select room_capacity_trusted('${ada}') c`)).c, LODGE.capacity);

  // Prepay: at most two weeks ahead.
  start = await balance(ada);
  await call(ada, 'select pay_lodge_rent()');
  assert.equal(await balance(ada), start - LODGE.weeklyRent);
  await fails(ada, 'select pay_lodge_rent()', /two weeks ahead/);

  // Broke students can't rent.
  const broke = await student('Broke');
  await db.query('update wallets set balance=500 where user_id=$1', [broke]);
  await fails(broke, 'select rent_lodge()', /Top up/);
  assert.equal(await style(broke), 'resumption');

  // Overdue inside the grace period: still renting, flagged overdue.
  await db.query("update lodge_tenancies set paid_until=now()-interval '1 day' where user_id=$1", [ada]);
  let s = (await call(ada, 'select lodge_state() s')).s;
  assert.equal(s.renting, true); assert.equal(s.overdue, true);
  // Paying while overdue restarts the week from today (no paying for days already lived late).
  await call(ada, 'select pay_lodge_rent()');
  const paidUntil = Date.parse((await one('select paid_until from lodge_tenancies where user_id=$1', [ada])).paid_until);
  assert(Math.abs(paidUntil - (Date.now() + 7 * 864e5)) < 60_000);

  // Past the grace period: moved back to the hostel, furniture kept, told once.
  await db.query("update lodge_tenancies set paid_until=now()-interval '3 days' where user_id=$1", [ada]);
  s = (await call(ada, 'select lodge_state() s')).s;
  assert.equal(s.renting, false); assert.equal(s.just_evicted, true);
  assert.equal(await style(ada), 'resumption');
  assert.equal(Number((await one('select count(*) n from room_placements where owner_id=$1', [ada])).n), furniture, 'furniture kept');
  assert.equal((await call(ada, 'select lodge_state() s')).s.just_evicted, false, 'only reported once');
  assert.equal((await svc(`select room_capacity_trusted('${ada}') c`)).c, LODGE.hostelCapacity);
  assert.equal((await call(broke, `select lodge_public('${ada}') p`)).p, false);
  await fails(ada, 'select pay_lodge_rent()', /don't rent/);

  // Moving out voluntarily.
  await db.query('update wallets set balance=5000 where user_id=$1', [ada]);
  await call(ada, 'select rent_lodge()');
  await call(ada, 'select leave_lodge()');
  assert.equal(await style(ada), 'resumption');
  // 046 closes the lodge: a tenant with a week left is refunded about ₦5,000 and moved back; no new rentals.
  await db.query('update wallets set balance=5000 where user_id=$1', [ada]);
  await call(ada, 'select rent_lodge()');
  const before = await balance(ada);
  await db.exec(fs.readFileSync(path.join(dir, '046_close_lodge.sql'), 'utf8'));
  assert.equal(await style(ada), 'resumption');
  const refund = (await balance(ada)) - before;
  assert(refund >= 4990 && refund <= 5000, `refund for the unused week (${refund})`);
  assert.equal(Number((await one("select count(*) n from wallet_transactions where user_id=$1 and type='lodge_refund'", [ada])).n), 1);
  await fails(ada, 'select rent_lodge()', /lodge has closed/);
  await db.exec(fs.readFileSync(path.join(dir, '046_close_lodge.sql'), 'utf8'));
  assert.equal((await balance(ada)) - before, refund, 're-running pays nothing more');
  console.log('LODGE DB PASSED: drift, privileges, rent + restyle + furniture kept, prepay limit, broke rejected, overdue grace, late payment, eviction once, Worker capacity, public flag, move out, closure with refund (046)');
}
main().catch((e) => { console.error(e); process.exit(1); });
