// Royal Gardens Estate (migration 044): rent, renew, expiry back to the hostel, big room, capacity,
// one home at a time (lodge or estate), drift with src/config/estate.ts.
// Run: npm run test:estate:db
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { ESTATE } from '../src/config/estate';

const require = createRequire(import.meta.url);
const { PGlite } = require(process.env.PGLITE_MODULE || '@electric-sql/pglite');

async function main() {
  const db = new PGlite();
  await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema public,auth to anon,authenticated,service_role;`);
  const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '../supabase/migrations');
  for (const f of fs.readdirSync(dir).sort()) await db.exec(fs.readFileSync(path.join(dir, f), 'utf8'));
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

  const sql = fs.readFileSync(path.join(dir, '044_estate.sql'), 'utf8');
  const day = 86400000;
  const shiftPaid = (u: string, ms: number) => db.query(`update estate_tenancies set paid_until=now()+($2||' milliseconds')::interval where user_id=$1`, [u, String(ms)]);

  // Drift with the config.
  assert(sql.includes(`b<${ESTATE.weeklyRent}`) && sql.includes(`balance-${ESTATE.weeklyRent}`), 'rent matches config');
  assert(sql.includes(`then ${ESTATE.capacity}`) && sql.includes(`interval '${(ESTATE.maxPrepaidWeeks - 1) * 7} days'`), 'capacity and prepay match config');

  const ada = await student('Ada');
  await db.query('update wallets set balance=100000 where user_id=$1', [ada]);
  await fails(ada, 'select estate_settle(auth.uid())', /permission denied/);
  await fails(null, 'select rent_estate()', /permission denied|Authentication/);
  assert.equal((await call(ada, 'select estate_state() s')).s.renting, false);
  await fails(ada, 'select pay_estate_rent()', /don't rent/);

  // Rent: ₦10,000, room restyled and big, 12 people allowed in.
  let start = await balance(ada);
  const r = (await call(ada, 'select rent_estate() r')).r;
  assert.equal(r.renting, true); assert.equal(r.capacity, ESTATE.capacity);
  assert.equal(await balance(ada), start - ESTATE.weeklyRent);
  assert.equal(await style(ada), 'estate');
  assert.equal((await one(`select room_capacity_trusted('${ada}') c`)).c, 12);
  await fails(ada, 'select rent_estate()', /already rent an estate/);
  await fails(ada, 'select rent_lodge()', /Royal Gardens/);
  // Furniture can use the big room's width while renting.
  await call(ada, "select hostel_command('purchase','{\"item\":\"hostel_chair\",\"credit\":false}'::jsonb)");
  await call(ada, "select hostel_command('place','{\"item\":\"hostel_chair\",\"x\":4.8,\"y\":0,\"z\":0,\"rotation\":0}'::jsonb)");
  assert.equal(Number((await one('select x from room_placements where owner_id=$1 and item_id=$2', [ada, 'hostel_chair'])).x), 4.8, 'placed in the wide part');

  // Pay ahead: at most two weeks; the third is refused.
  start = await balance(ada) + ESTATE.weeklyRent;
  await call(ada, 'select pay_estate_rent()');
  await fails(ada, 'select pay_estate_rent()', /two weeks ahead/);
  assert.equal(await balance(ada), start - 2 * ESTATE.weeklyRent);

  // Time runs out: straight back to the hostel; the chair in the wide part goes back to the bag.
  await shiftPaid(ada, -1000);
  const s = (await call(ada, 'select estate_state() s')).s;
  assert.equal(s.renting, false); assert.equal(s.just_evicted, true);
  assert.equal(await style(ada), 'resumption');
  assert.equal(Number((await one('select count(*) n from room_placements where owner_id=$1', [ada])).n), 0, 'out-of-room furniture unplaced');
  assert(Number((await one("select quantity from inventory where user_id=$1 and item_id='hostel_chair'", [ada])).quantity) >= 1, 'but still owned');
  assert.equal((await one(`select room_capacity_trusted('${ada}') c`)).c, 5);
  await fails(ada, "select hostel_command('place','{\"item\":\"hostel_chair\",\"x\":4.8,\"y\":0,\"z\":0,\"rotation\":0}'::jsonb)", /inside|room floor/);

  // Move out early; lodge and estate never at the same time.
  await call(ada, 'select rent_estate()');
  await call(ada, 'select leave_estate()');
  assert.equal(await style(ada), 'resumption');
  await call(ada, 'select rent_lodge()');
  await fails(ada, 'select rent_estate()', /lodge first/);
  assert.equal((await call(ada, 'select estate_state() s')).s.lodge, true);

  // No money, no room.
  const broke = await student('Broke');
  await db.query('update wallets set balance=9999 where user_id=$1', [broke]);
  await fails(broke, 'select rent_estate()', /₦10,000/);
  assert.equal(await style(broke), 'resumption');
  assert.equal(Number((await one("select count(*) n from wallet_transactions where type='estate_rent'")).n), 3, 'one ledger row per week paid');
  console.log('ESTATE DB PASSED: rent ₦10,000/week, big room + 12 people, two weeks ahead max, out on expiry with wide furniture unplaced (still owned), move out, one home at a time, funds, privileges.');
}
main().catch((e) => { console.error(e); process.exit(1); });
