// Home kitchen (migration 054): cook and serve on the table, guests can eat, and the rules match
// src/config/homeKitchen.ts. Run: PGLITE_MODULE=<path to pglite index.cjs> npm run test:home-kitchen:db
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { DISHES, HEAT_SOURCES, COOKING_POT, SERVING_TABLE } from '../src/config/homeKitchen';

const require = createRequire(import.meta.url);
const { PGlite } = require(process.env.PGLITE_MODULE || '@electric-sql/pglite');

async function main() {
  const db = new PGlite();
  await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema public,auth to anon,authenticated,service_role;`);
  const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '../supabase/migrations');
  for (const f of fs.readdirSync(dir).sort()) await db.exec(fs.readFileSync(path.join(dir, f), 'utf8'));
  const sql = fs.readFileSync(path.join(dir, '054_home_kitchen.sql'), 'utf8');
  const rows = async (q: string, p: unknown[] = []) => (await db.query(q, p)).rows as any[];
  const one = async (q: string, p: unknown[] = []) => (await rows(q, p))[0];
  const call = async (user: string, q: string, p: unknown[] = []) => {
    await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub','${user}',false);`);
    try { return (await rows(q, p))[0]; } finally { await db.exec("reset role; select set_config('request.jwt.claim.sub','',false);"); }
  };
  let n = 0;
  const student = async (name: string) => {
    const id = `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`;
    await db.query('insert into auth.users values($1)', [id]);
    await db.query("insert into profiles(id,username,college) values($1,$2,'COLENG')", [id, name]);
    await call(id, 'select ensure_player_wallet()');
    await db.query('update wallets set balance=500000 where user_id=$1', [id]);
    await call(id, "select hostel_command('ensure','{}'::jsonb)");
    return id;
  };
  const hostel = (u: string, action: string, data: object) => call(u, 'select hostel_command($1,$2::jsonb) r', [action, JSON.stringify(data)]).then((r) => r.r);
  const kitchen = (u: string, action: string, data: object, req?: string) =>
    call(u, `select hostel_kitchen($1,$2::jsonb${req ? ',$3::uuid' : ''}) r`, req ? [action, JSON.stringify(data), req] : [action, JSON.stringify(data)]).then((r) => r.r);
  const buy = (u: string, item: string) => hostel(u, 'purchase', { item, credit: false });
  const qty = async (u: string, item: string) => Number((await one('select quantity from inventory where user_id=$1 and item_id=$2', [u, item]))?.quantity || 0);
  const room = (u: string) => one('select served_food,served_drink from hostel_rooms where owner_id=$1', [u]);

  // Drift: every dish is a consumable foodstuff, and SQL cooks exactly the dishes the config cooks.
  for (const d of DISHES) {
    const c = await one('select * from hostel_catalog where id=$1', [d.item]);
    assert(c && c.consumable && c.category === 'Foodstuff', `${d.item} is foodstuff`);
    assert.equal(sql.includes(`'${d.item}'`) && /in \('hostel_food_rice'[^)]*\)/.exec(sql)![0].includes(d.item), d.cooked, `${d.item} cooked matches`);
  }
  for (const id of [...HEAT_SOURCES, COOKING_POT, SERVING_TABLE]) assert(sql.includes(`'${id}'`), `${id} in SQL`);
  assert(sql.includes("c.id='hostel_food_water' then 'drink'") && DISHES.filter((d) => d.slot === 'drink').map((d) => d.item).join() === 'hostel_food_water', 'drink slot');

  const tolu = await student('Tolu');
  const ada = await student('Ada');
  const stranger = await student('Stranger');
  await buy(tolu, 'hostel_food_rice');
  await buy(tolu, 'hostel_food_rice');
  await buy(tolu, 'hostel_food_water');
  await buy(tolu, 'hostel_food_bread');

  await assert.rejects(() => kitchen(tolu, 'serve', { item: 'hostel_food_bread' }), /Place your Small Table first/);
  await buy(tolu, 'hostel_table');
  await hostel(tolu, 'place', { item: 'hostel_table', x: 1, y: 0, z: 1, rotation: 0 });
  assert(await one("select 1 from room_placements where owner_id=$1 and item_id='hostel_table'", [tolu]), 'table placed');

  await assert.rejects(() => kitchen(tolu, 'serve', { item: 'hostel_food_rice' }), /Buy a Pot/);
  await buy(tolu, 'hostel_pot');
  await assert.rejects(() => kitchen(tolu, 'serve', { item: 'hostel_food_rice' }), /Gas Cooker or Gas Cylinder/);
  await buy(tolu, 'hostel_gas_small_cylinder');
  await hostel(tolu, 'place', { item: 'hostel_gas_small_cylinder', x: -1, y: 0, z: 1.5, rotation: 0 });
  await assert.rejects(() => kitchen(tolu, 'serve', { item: 'hostel_tv_basic' }), /Only foodstuff/);
  await assert.rejects(() => kitchen(tolu, 'serve', { item: 'hostel_food_eggs' }), /Buy Eggs from Iya Ibeji first/);

  // Cook: one rice is used, jollof stands on the table and comes back in the snapshot.
  const req = '22222222-2222-4222-8222-222222222222';
  const served = await kitchen(tolu, 'serve', { item: 'hostel_food_rice' }, req);
  assert.equal(served.snapshot.room.served_food, 'hostel_food_rice', 'snapshot shows the dish');
  assert.equal(await qty(tolu, 'hostel_food_rice'), 1, 'one rice used');
  await kitchen(tolu, 'serve', { item: 'hostel_food_rice' }, req);
  assert.equal(await qty(tolu, 'hostel_food_rice'), 1, 'a retried request cooks once');
  await assert.rejects(() => kitchen(tolu, 'serve', { item: 'hostel_food_bread' }), /already has food/);
  await kitchen(tolu, 'serve', { item: 'hostel_food_water' });
  assert.deepEqual(await room(tolu), { served_food: 'hostel_food_rice', served_drink: 'hostel_food_water' });
  assert.equal(await qty(tolu, 'hostel_food_water'), 0, 'last water leaves the inventory');

  // Guests: a stranger can't eat; an invited friend can.
  await assert.rejects(() => kitchen(stranger, 'eat', { owner: tolu, slot: 'food' }), /not in this room/);
  await db.query("insert into friends(user_id,friend_id,status) values($1,$2,'accepted')", [tolu, ada]);
  await hostel(tolu, 'invite', { guest: ada });
  await hostel(ada, 'respond', { owner: tolu, accept: true });
  const ate = await kitchen(ada, 'eat', { owner: tolu, slot: 'food' });
  assert.equal(ate.snapshot.room.served_food, null, 'the plate is cleared');
  await assert.rejects(() => kitchen(ada, 'eat', { owner: tolu, slot: 'food' }), /Nothing is served/);
  await kitchen(tolu, 'eat', { slot: 'drink' });
  assert.deepEqual(await room(tolu), { served_food: null, served_drink: null });
  await assert.rejects(() => kitchen(tolu, 'eat', { slot: 'plate' }), /Choose food or drink/);

  // No-cook dishes need no pot or gas.
  await kitchen(tolu, 'serve', { item: 'hostel_food_bread' });
  assert.equal((await room(tolu)).served_food, 'hostel_food_bread');
  console.log('home kitchen db: ok');
}
main().catch((e) => { console.error(e); process.exit(1); });
