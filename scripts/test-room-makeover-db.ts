// Room makeover (migration 024): paint + floor prices, expansion, new catalogue items, surfaces
// (TV stand / table), wider bounds for large rooms, appliance switches, and drift with the config.
// Run: PGLITE_MODULE=<path to pglite index.cjs> npm run test:room-makeover:db
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { FLOORS, PAINTS, ROOM_EXPANSION_PRICE, SURFACES } from '../src/config/roomMakeover';
import { HOSTEL_SHOP, TOGGLE_ITEMS } from '../src/config/hostelItems';
import { candidate, placementError, type RoomTransform } from '../src/config/roomPlacement';

const require = createRequire(import.meta.url);
const { PGlite } = require(process.env.PGLITE_MODULE || '@electric-sql/pglite');

async function main() {
  const db = new PGlite();
  await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema public,auth to anon,authenticated,service_role;`);
  const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '../supabase/migrations');
  const sql = fs.readFileSync(path.join(dir, '024_room_makeover.sql'), 'utf8');
  for (const f of fs.readdirSync(dir).sort()) await db.exec(fs.readFileSync(path.join(dir, f), 'utf8'));
  const rows = async (q: string, p: unknown[] = []) => (await db.query(q, p)).rows as any[];
  const one = async (q: string, p: unknown[] = []) => (await rows(q, p))[0];
  const call = async (user: string | null, q: string, p: unknown[] = []) => {
    await db.exec(user ? `set role authenticated; select set_config('request.jwt.claim.sub','${user}',false);` : `set role anon; select set_config('request.jwt.claim.sub','',false);`);
    try { return (await rows(q, p))[0]; } finally { await db.exec("reset role; select set_config('request.jwt.claim.sub','',false);"); }
  };
  let n = 0;
  const student = async (name: string, money = 50000) => {
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

  // ── Drift: finishes, expansion price, catalogue, footprints, surfaces, switches ──
  for (const p of PAINTS) assert.equal((await one("select price from hostel_finishes where kind='paint' and id=$1", [p.id])).price, p.price, `paint ${p.id}`);
  for (const f of FLOORS) assert.equal((await one("select price from hostel_finishes where kind='floor' and id=$1", [f.id])).price, f.price, `floor ${f.id}`);
  assert.equal(Number((await one("select count(*) from hostel_finishes")).count), PAINTS.length + FLOORS.length, 'no extra finishes in SQL');
  assert(sql.includes(`cost:=${ROOM_EXPANSION_PRICE};`), 'expansion price matches');
  for (const i of HOSTEL_SHOP) {
    const r = await one('select * from hostel_catalog where id=$1', [i.id]);
    assert(r, `${i.id} in catalogue`);
    assert.deepEqual([r.name, r.category, r.price, r.placement_type, r.credit], [i.name, i.category, i.price, i.placementType, i.credit], `${i.id} drift`);
    const [w, d] = (await one('select hostel_extent($1,0) e', [i.id])).e.map(Number);
    assert.deepEqual([w * 2, d * 2].map((v) => +v.toFixed(3)), [i.footprint.width, i.footprint.depth], `${i.id} footprint drift`);
  }
  for (const [id, h] of Object.entries(SURFACES)) assert.equal(Number((await one('select hostel_surface_height($1) h', [id])).h), h, `${id} surface height`);
  for (const id of TOGGLE_ITEMS) assert(sql.includes(`'${id}'`) && /toggle'[\s\S]*hostel_led_strip/.test(sql), `${id} has a switch`);

  // ── Paint & floor ──
  const moyin = await student('Moyin');
  const before = await balance(moyin);
  await cmd(moyin, 'decorate', { wall: 'lilac' });
  assert.equal((await room(moyin)).wall_paint, 'lilac');
  assert.equal(await balance(moyin), before - 300, 'paint costs ₦300');
  await cmd(moyin, 'decorate', { wall: 'lilac', floor: 'wood' });
  assert.equal(await balance(moyin), before - 300 - 800, 'only what changes is charged');
  assert.equal((await room(moyin)).floor_style, 'wood');
  await cmd(moyin, 'decorate', { wall: 'default' });
  assert.equal(await balance(moyin), before - 1100, 'back to hostel white is free');
  await assert.rejects(() => cmd(moyin, 'decorate', { wall: 'gold' }), /Unknown paint/);
  await assert.rejects(() => cmd(moyin, 'decorate', {}), /Choose a paint or a floor/);
  const ledger = await one("select * from wallet_transactions where user_id=$1 and type='hostel_makeover' order by created_at desc limit 1", [moyin]);
  assert(ledger.description.includes('Room makeover'), 'ledger entry');
  const broke = await student('Broke', 100);
  await assert.rejects(() => cmd(broke, 'decorate', { floor: 'carpet' }), /Insufficient funds/);
  assert.equal((await room(broke)).floor_style, 'default');
  // Receipts: a retried request doesn't charge twice.
  const req = '11111111-1111-4111-8111-111111111111';
  const b0 = await balance(moyin);
  await call(moyin, "select hostel_command('decorate','{\"floor\":\"tiles\"}'::jsonb,$1)", [req]);
  await call(moyin, "select hostel_command('decorate','{\"floor\":\"tiles\"}'::jsonb,$1)", [req]);
  assert.equal(await balance(moyin), b0 - 700, 'idempotent retry');

  // ── New items, surfaces, switches ──
  const buy = (u: string, item: string) => cmd(u, 'purchase', { item, credit: false });
  for (const id of ['hostel_tv_stand', 'hostel_tv_basic', 'hostel_ps_console', 'hostel_speaker', 'hostel_washing_machine', 'hostel_led_strip', 'hostel_plant_pot', 'hostel_flower_vase', 'hostel_table', 'hostel_wardrobe']) await buy(moyin, id);
  const place = (u: string, item: string, p: object) => cmd(u, 'place', { item, rotation: 0, ...p });
  await place(moyin, 'hostel_tv_stand', { x: 1, y: 0, z: -3.3 });
  await place(moyin, 'hostel_tv_basic', { x: 1, y: 0.55, z: -3.3 });
  await place(moyin, 'hostel_ps_console', { x: 2, y: 0.55, z: -3.3 });
  await assert.rejects(() => place(moyin, 'hostel_speaker', { x: 1.6, y: 0.55, z: -3.3 }), /taken/, 'no stacking on each other');
  await place(moyin, 'hostel_speaker', { x: 0, y: 0.55, z: -3.3 });
  await assert.rejects(() => place(moyin, 'hostel_speaker', { x: 0.5, y: 0.55, z: 0 }), /table or TV stand/, 'needs a surface under it');
  await assert.rejects(() => place(moyin, 'hostel_wardrobe', { x: -1, y: 0.55, z: 0 }), /goes on the floor/, 'big furniture stays on the floor');
  await assert.rejects(() => place(moyin, 'hostel_tv_stand', { x: 0, y: 0, z: 0 }), /Take the items off the TV Stand/, 'stand keeps its load');
  await assert.rejects(() => place(moyin, 'hostel_tv_stand', {}), /Take the items off/, 'and can’t be removed loaded');
  await assert.rejects(() => place(moyin, 'hostel_washing_machine', { x: 2.2, y: 0, z: -3.2 }), /occupied/, 'floor overlap with the stand');
  await place(moyin, 'hostel_washing_machine', { x: 3.3, y: 0, z: 0 });
  await cmd(moyin, 'toggle', { item: 'hostel_washing_machine' });
  assert.equal((await one("select active from room_placements where owner_id=$1 and item_id='hostel_washing_machine'", [moyin])).active, true, 'washing machine runs');
  await assert.rejects(() => cmd(moyin, 'toggle', { item: 'hostel_wardrobe' }), /no switch/);
  await place(moyin, 'hostel_led_strip', { x: 1.5, y: 1.8, z: -3.84 });
  await cmd(moyin, 'toggle', { item: 'hostel_led_strip' });
  // Items standing on the floor can share space under a stand's footprint only via the stand.
  await place(moyin, 'hostel_table', { x: -1, y: 0, z: 1 });
  await place(moyin, 'hostel_flower_vase', { x: -1.3, y: 0.77, z: 1 });

  // ── Expansion ──
  await assert.rejects(() => place(moyin, 'hostel_plant_pot', { x: 4.8, y: 0, z: 0 }), /room floor/, 'standard room is 8 m');
  const bx = await balance(moyin);
  await cmd(moyin, 'expand', {});
  assert.equal((await room(moyin)).room_size, 'large');
  assert.equal(await balance(moyin), bx - ROOM_EXPANSION_PRICE);
  await assert.rejects(() => cmd(moyin, 'expand', {}), /already expanded/);
  await place(moyin, 'hostel_plant_pot', { x: 4.8, y: 0, z: 0 });
  await assert.rejects(() => place(moyin, 'hostel_wardrobe', { x: 5.2, y: 0, z: 0 }), /room floor/, 'still bounded');
  await assert.rejects(() => cmd(broke, 'expand', {}), /Insufficient funds/);

  // ── Guests and anon ──
  const guest = await student('Guest');
  await assert.rejects(() => cmd(guest, 'decorate', { wall: 'mint', owner: moyin }), /Only the room owner/);
  await assert.rejects(() => call(null, "select hostel_command('expand','{}'::jsonb)"), /permission denied|Authentication required/);
  await assert.rejects(() => call(moyin, "select hostel_surface_height('hostel_table')"), /permission denied/);
  await assert.rejects(() => call(moyin, "insert into hostel_finishes values('paint','free',0)"), /permission denied/);

  // ── Client/database parity: the same rule decides in both places ──
  const parity = await student('Parity');
  const all = ['hostel_tv_stand', 'hostel_table', 'hostel_tv_basic', 'hostel_ps_console', 'hostel_speaker', 'hostel_flower_vase', 'hostel_microwave', 'hostel_wardrobe', 'hostel_plant_pot', 'hostel_led_strip', 'hostel_mirror', 'hostel_fridge', 'hostel_rug', 'hostel_chair'];
  for (const id of all) await buy(parity, id);
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  let agree = 0, accepted = 0;
  for (let k = 0; k < 400; k++) {
    if (k === 200) await cmd(parity, 'expand', {});
    const size = (await room(parity)).room_size;
    const placed = await placements(parity);
    const item = all[Math.floor(rnd() * all.length)];
    const c = candidate(item, (rnd() - 0.5) * 11.5, (rnd() - 0.5) * 8, [0, 90, 180, 270][Math.floor(rnd() * 4)], placed, size);
    const clientOk = !placementError(c, placed, size);
    const serverOk = await place(parity, item, { x: c.x, y: c.y, z: c.z, rotation: c.rotation }).then(() => true, () => false);
    assert.equal(serverOk, clientOk, `parity for ${item} at ${c.x},${c.y},${c.z} r${c.rotation} (${size}): client ${clientOk} server ${serverOk} · ${placementError(c, placed, size)}`);
    agree++; if (serverOk) accepted++;
  }
  assert(accepted > 40, `parity run placed things (${accepted})`);
  console.log(`ROOM MAKEOVER DB PASSED: paint/floor prices + idempotent, expansion, ${HOSTEL_SHOP.length} catalogue items + footprints in sync, TV stand/table surfaces, switches, large-room bounds, owner-only, anon blocked, ${agree} client/server parity checks (${accepted} placed).`);
}
main().catch((e) => { console.error(e); process.exit(1); });
