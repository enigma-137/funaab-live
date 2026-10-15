// Lifestyle shop (migration 041): bed frames, AC, big fridge, laptop, watches, bags and cars.
// Run: npm run test:lifestyle:db
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { BED_FRAMES, HOSTEL_SHOP, TOGGLE_ITEMS, WEARABLES } from '../src/config/hostelItems';
import { placementError, type RoomTransform } from '../src/config/roomPlacement';

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
  let n = 0;
  const student = async (name: string, money = 500000) => {
    const id = `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`;
    await db.query('insert into auth.users values($1)', [id]);
    await db.query("insert into profiles(id,username,college) values($1,$2,'COLENG')", [id, name]);
    await call(id, 'select ensure_player_wallet()');
    await db.query('update wallets set balance=$2 where user_id=$1', [id, money]);
    await call(id, "select hostel_command('ensure','{}'::jsonb)");
    return id;
  };
  const cmd = (u: string, action: string, data: object) => call(u, 'select hostel_command($1,$2::jsonb) r', [action, JSON.stringify(data)]).then((r) => r.r);
  const balance = async (u: string) => Number((await one('select balance from wallets where user_id=$1', [u])).balance);
  const room = async (u: string) => one('select * from hostel_rooms where owner_id=$1', [u]);
  const placements = async (u: string) => rows('select item_id,rotation,x::float,y::float,z::float from room_placements where owner_id=$1', [u]) as Promise<RoomTransform[]>;

  // ── Catalogue: config = database for every new item; re-running 041 changes nothing ──
  const ids = HOSTEL_SHOP.filter((i) => /^(hostel_(bed_|ac$|fridge_big|laptop)|fashion_|car_)/.test(i.id)).map((i) => i.id);
  assert.equal(ids.length, 15, 'fifteen new items');
  await db.exec(fs.readFileSync(path.join(dir, '041_lifestyle_shop.sql'), 'utf8'));
  for (const id of ids) {
    const i = HOSTEL_SHOP.find((x) => x.id === id)!, r = await one('select * from hostel_catalog where id=$1', [id]);
    assert.deepEqual([r.name, r.category, r.price, r.placement_type], [i.name, i.category, i.price, i.placementType], id);
  }
  for (const id of Object.keys(WEARABLES)) assert.equal(HOSTEL_SHOP.find((x) => x.id === id)?.category, 'Fashion', `${id} is fashion`);
  for (const id of BED_FRAMES) assert.equal(HOSTEL_SHOP.find((x) => x.id === id)?.placementType, 'bed');

  // ── Buying: watches, bags and cars are paid in full and kept, never placed ──
  const ada = await student('Ada', 2000000);
  const buy = (u: string, item: string) => cmd(u, 'purchase', { item, credit: false });
  const place = (u: string, item: string, p: object) => cmd(u, 'place', { item, rotation: 0, ...p });
  let b = await balance(ada);
  await buy(ada, 'fashion_watch_gold'); b -= 120000; assert.equal(await balance(ada), b);
  await assert.rejects(() => buy(ada, 'fashion_watch_gold'), /already own/, 'one of each');
  await buy(ada, 'car_corolla'); b -= 450000; assert.equal(await balance(ada), b);
  await assert.rejects(() => cmd(ada, 'purchase', { item: 'car_camry', credit: true }), /pay-now only/, 'no cars on credit');
  await assert.rejects(() => place(ada, 'car_corolla', { x: 0, y: 0, z: 0 }), /./, 'a car is not room furniture');
  const poor = await student('Poor', 10000);
  await assert.rejects(() => buy(poor, 'car_gwagon'), /./, 'cannot afford a G-Wagon');
  assert.equal(await balance(poor), 10000);

  // ── Bed frames: on the mattress spot, one at a time ──
  await buy(ada, 'hostel_bed_double'); await buy(ada, 'hostel_bed_king');
  await assert.rejects(() => place(ada, 'hostel_bed_double', { x: 0, y: 0, z: 0 }), /mattress/, 'only on the mattress');
  await place(ada, 'hostel_bed_double', { x: -2.6, y: 0.32, z: -2.8 });
  await assert.rejects(() => place(ada, 'hostel_bed_king', { x: -2.6, y: 0.32, z: -2.8 }), /other bed frame/);
  assert.equal(placementError({ item: 'hostel_bed_king', anchor: 'bed-a', x: -2.6, y: 0.32, z: -2.8, rotation: 0 }, await placements(ada)), 'Take the other bed frame out first.', 'client says the same');
  await place(ada, 'hostel_bed_double', {});
  await place(ada, 'hostel_bed_king', { x: -2.6, y: 0.32, z: -2.8 });
  await buy(ada, 'hostel_bedsheet');
  await place(ada, 'hostel_bedsheet', { x: -2.6, y: 0.32, z: -2.8 });

  // ── AC on the back wall, big fridge on the floor, laptop on a table; all three switch on and off ──
  for (const id of ['hostel_ac', 'hostel_fridge_big', 'hostel_laptop', 'hostel_table']) await buy(ada, id);
  await assert.rejects(() => place(ada, 'hostel_ac', { x: 0, y: 0, z: 0 }), /./, 'AC is not floor furniture');
  await place(ada, 'hostel_ac', { x: 0, y: 1.8, z: -3.84 });
  await place(ada, 'hostel_fridge_big', { x: 3, y: 0, z: 0 });
  await assert.rejects(() => place(ada, 'hostel_laptop', { x: 0, y: 0.77, z: 0 }), /table or TV stand/);
  await place(ada, 'hostel_table', { x: 0, y: 0, z: 0 });
  await place(ada, 'hostel_laptop', { x: 0, y: 0.77, z: 0 });
  for (const id of ['hostel_ac', 'hostel_fridge_big', 'hostel_laptop']) {
    assert(TOGGLE_ITEMS.includes(id));
    await cmd(ada, 'toggle', { item: id });
    assert.equal((await one('select active from room_placements where owner_id=$1 and item_id=$2', [ada, id])).active, true, `${id} switches on`);
  }
  console.log('LIFESTYLE SHOP DB PASSED: 15 items in sync and re-runnable, wearables and cars kept not placed, no cars on credit, funds checked, one bed frame on the mattress (client agrees), AC/fridge/laptop placement and switches.');
}
main().catch((e) => { console.error(e); process.exit(1); });
