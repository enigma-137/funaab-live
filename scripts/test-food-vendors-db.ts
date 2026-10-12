// Timed food vendors — database tests (migration 011) + config drift check.
// Run: PGLITE_MODULE=<path to pglite index.cjs> npm run test:vendors:db
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { FOOD_VENDORS, FOOD_VENDOR_LIST } from '../src/config/foodVendors';

const require = createRequire(import.meta.url);
const { PGlite } = require(process.env.PGLITE_MODULE || '@electric-sql/pglite');

async function main() {
  const db = new PGlite();
  await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema public,auth to anon,authenticated;`);
  const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '../supabase/migrations');
  for (const file of fs.readdirSync(dir).sort()) await db.exec(fs.readFileSync(path.join(dir, file), 'utf8'));
  const rows = async (sql: string, p: unknown[] = []) => (await db.query(sql, p)).rows as any[];

  // ---------- Config ↔ database drift ----------
  const minutes = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
  for (const v of FOOD_VENDOR_LIST) {
    const [dbVendor] = await rows('select * from food_vendors where id=$1', [v.id]);
    assert.equal(dbVendor?.name, v.name, `${v.id} name`);
    assert.equal(dbVendor.closed_message, v.closedMessage, `${v.id} closed message`);
    const hours = await rows('select opens::text,closes::text from food_vendor_hours where vendor_id=$1 order by opens', [v.id]);
    assert.deepEqual(hours.map((h) => [minutes(h.opens), minutes(h.closes)]), v.windows.map((w) => [w.open, w.close]), `${v.id} hours`);
    const items = await rows('select id,name,price from food_vendor_items where vendor_id=$1 order by id', [v.id]);
    assert.deepEqual(items, [...v.items].sort((a, b) => a.id.localeCompare(b.id)).map(({ id, name, price }) => ({ id, name, price })), `${v.id} menu`);
  }

  // ---------- Simulated Africa/Lagos times (server clock) ----------
  const isOpen = async (vendor: string, lagos: string) =>
    (await rows(`select food_vendor_is_open($1,($2::timestamp at time zone 'Africa/Lagos')) o`, [vendor, `2026-10-12 ${lagos}`]))[0].o;
  const cases: Array<[string, string, boolean]> = [
    ['mai_suya', '18:30', false], ['mai_suya', '18:59:59', false], ['mai_suya', '19:00', true], ['mai_suya', '20:00', true],
    ['mai_suya', '22:59', true], ['mai_suya', '23:00', false], ['mai_suya', '23:15', false], ['mai_suya', '03:00', false],
    ['indomie_egg', '06:59', false], ['indomie_egg', '07:00', true], ['indomie_egg', '08:00', true], ['indomie_egg', '10:59', true],
    ['indomie_egg', '11:01', false], ['indomie_egg', '18:30', false], ['indomie_egg', '19:30', true], ['indomie_egg', '22:59', true],
    ['indomie_egg', '23:01', false],
  ];
  for (const [vendor, at, expected] of cases) assert.equal(await isOpen(vendor, at), expected, `${vendor} at ${at} Lagos`);
  // A timestamp given in UTC is judged in Lagos time: 19:30 UTC = 20:30 Lagos (open); 22:30 UTC = 23:30 Lagos (closed).
  assert.equal((await rows(`select food_vendor_is_open('mai_suya','2026-10-12 19:30:00+00') o`))[0].o, true);
  assert.equal((await rows(`select food_vendor_is_open('mai_suya','2026-10-12 22:30:00+00') o`))[0].o, false);

  // ---------- Purchases ----------
  const u = '00000000-0000-4000-8000-0000000000c1', other = '00000000-0000-4000-8000-0000000000c2';
  for (const [id, name] of [[u, 'Chidi'], [other, 'Ngozi']]) {
    await db.query('insert into auth.users values($1)', [id]);
    await db.query("insert into profiles(id,username,college) values($1,$2,'COLENG')", [id, name]);
    await db.query('insert into wallets(user_id,balance) values($1,2580)', [id]);
  }
  const as = async (user: string) => db.exec(`set role authenticated; select set_config('request.jwt.claim.sub','${user}',false);`);
  const buy = async (user: string, vendor: string, item: string, request = crypto.randomUUID()) => {
    await as(user);
    try { return (await rows('select food_vendor_purchase($1,$2,$3) r', [vendor, item, request]))[0].r; }
    finally { await db.exec('reset role;'); }
  };
  const balance = async (user: string) => Number((await rows('select balance from wallets where user_id=$1', [user]))[0].balance);
  // Make "now" open or closed by moving the window around the real clock (time itself cannot be faked).
  const forceHours = async (vendor: string, open: boolean) => {
    await db.query('delete from food_vendor_hours where vendor_id=$1', [vendor]);
    const sql = open
      ? `insert into food_vendor_hours values($1,'00:00','23:59:59.999')`
      : `insert into food_vendor_hours select $1,t,t+interval '1 minute' from (select ((now() at time zone 'Africa/Lagos')::time + interval '2 hours') t) x where t<'23:58'
         union all select $1,'00:00','00:00:01' where ((now() at time zone 'Africa/Lagos')::time + interval '2 hours')>='23:58'`;
    await db.query(sql, [vendor]);
  };

  // Closed: rejected with the vendor's message; wallet untouched. A client clock cannot change this.
  await forceHours('mai_suya', false);
  await assert.rejects(() => buy(u, 'mai_suya', 'vendor_suya_beef'), /Mai Suya has closed for the night/);
  assert.equal(await balance(u), 2580);

  // Open: exact server price, ledger, inventory.
  await forceHours('mai_suya', true);
  const r1 = await buy(u, 'mai_suya', 'vendor_suya_beef');
  assert.equal(r1.price, 800); assert.equal(Number(r1.balance), 1780); assert.equal(await balance(u), 1780);
  const [tx] = await rows("select * from wallet_transactions where user_id=$1 and type='food_purchase' order by created_at desc limit 1", [u]);
  assert.equal(Number(tx.amount), -800); assert.equal(Number(tx.balance_after), 1780); assert.equal(tx.description, 'Mai Suya: Beef Suya');
  assert.equal((await rows("select quantity from inventory where user_id=$1 and item_id='vendor_suya_beef'", [u]))[0].quantity, 1);

  // Retry with the same request id: no second charge.
  const req = crypto.randomUUID();
  await buy(u, 'mai_suya', 'vendor_suya_chicken', req);
  await buy(u, 'mai_suya', 'vendor_suya_chicken', req);
  assert.equal(await balance(u), 1080, 'one ₦700 charge for a retried request');
  assert.equal((await rows("select quantity from inventory where user_id=$1 and item_id='vendor_suya_chicken'", [u]))[0].quantity, 1);

  // Wrong vendor / unknown item / insufficient funds.
  await assert.rejects(() => buy(u, 'mai_suya', 'vendor_indomie_egg'), /not on the Mai Suya menu/);
  await assert.rejects(() => buy(u, 'mai_suya', 'vendor_suya_goat'), /not on the Mai Suya menu/);
  await assert.rejects(() => buy(u, 'nobody', 'vendor_suya_beef'), /Unknown vendor/);
  await db.query('update wallets set balance=500 where user_id=$1', [u]);
  await assert.rejects(() => buy(u, 'mai_suya', 'vendor_suya_beef'), /Insufficient funds/);
  assert.equal(await balance(u), 500);

  // Indomie: own schedule, independent of Mai Suya.
  await forceHours('indomie_egg', false);
  await assert.rejects(() => buy(other, 'indomie_egg', 'vendor_indomie_egg'), /Indomie & Egg is closed/);
  await forceHours('indomie_egg', true);
  assert.equal((await buy(other, 'indomie_egg', 'vendor_indomie_egg')).price, 800);
  assert.equal((await buy(other, 'indomie_egg', 'vendor_indomie_plain')).price, 600);
  assert.equal(await balance(other), 1180, 'two players, independent wallets');

  // Legacy RPC hole closed: a client-priced vendor item is refused.
  await as(other);
  await assert.rejects(() => db.query("select process_wallet_purchase('food_purchase',1,'cheap','vendor_suya_beef','Beef Suya',null)"), /vendor stall/);
  // Floral World still works through the legacy path at its server price.
  const fw = (await rows("select process_wallet_purchase('food_purchase',1,null,'fw_water','x',null) r"))[0].r;
  await db.exec('reset role;');
  assert.equal(fw.success, true); assert.equal(await balance(other), 1180 - 150, 'Floral World water still ₦150 server price');

  // Anonymous users cannot buy; status RPC is public and reports the server clock.
  await db.exec('set role anon;');
  await assert.rejects(() => db.query("select food_vendor_purchase('mai_suya','vendor_suya_beef',gen_random_uuid())"));
  const status = (await rows('select food_vendor_status() s'))[0].s;
  await db.exec('reset role;');
  assert(status.server_now && typeof status.open.mai_suya === 'boolean' && typeof status.open.indomie_egg === 'boolean');
  assert.equal(status.open.mai_suya, true, 'status agrees with the server-side hours');

  console.log('FOOD VENDORS DATABASE PASSED: config/menu/hours drift check, 17 simulated Lagos times, UTC→Lagos conversion, closed rejection with vendor message, exact server price, ledger + inventory, idempotent retry, wrong-vendor/unknown-item/insufficient-funds rejection, independent players, legacy client-priced path closed, Floral World intact, anon rejected, public server clock.');
  await db.close();
}
main().catch((e) => { console.error(e); process.exit(1); });
void FOOD_VENDORS;
