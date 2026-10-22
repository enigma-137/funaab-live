// Keke fares (migration 049): after every migration, ₦200 route Keke and ₦150 Korope rides are
// accepted and charged, fares under ₦100 or over ₦1,200 are refused, and 049 is safe to re-run.
// Mirrors src/config/kekeRoutes.ts. Run: npm run test:keke-fares:db
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { KOROPE, ROUTE_FARE, fareFor, kekeDestinations } from '../src/config/kekeRoutes';

const require = createRequire(import.meta.url);
const { PGlite } = require(process.env.PGLITE_MODULE || '@electric-sql/pglite');

async function main() {
  const db = new PGlite();
  await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema public,auth to anon,authenticated,service_role;`);
  const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '../supabase/migrations');
  for (const f of fs.readdirSync(dir).sort()) await db.exec(fs.readFileSync(path.join(dir, f), 'utf8'));
  await db.exec(fs.readFileSync(path.join(dir, '049_cheaper_keke_fares.sql'), 'utf8')); // re-runnable

  const u = '00000000-0000-4000-8000-000000000001';
  await db.query('insert into auth.users values($1)', [u]);
  await db.query("insert into profiles(id,username,college) values($1,'Ada','COLENG')", [u]);
  await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub','${u}',false); select ensure_player_wallet(); reset role;`);
  await db.query('update wallets set balance=1000 where user_id=$1', [u]);
  const balance = async () => Number((await db.query('select balance from wallets where user_id=$1', [u])).rows[0].balance);
  // One open ride at a time: book, then complete it.
  const ride = async (fare: number) => {
    const t = randomUUID();
    await db.query('select keke_reserve_trusted($1,$2,$3,$4)', [t, u, 'library', fare]);
    await db.query("select keke_settle_trusted($1,'complete')", [t]);
  };

  assert.equal(ROUTE_FARE, 200, 'route Keke ₦200');
  assert.equal(KOROPE.fare, 150, 'Korope ₦150');
  await ride(ROUTE_FARE); assert.equal(await balance(), 800, 'route Keke charged');
  await ride(KOROPE.fare); assert.equal(await balance(), 650, 'Korope charged');
  for (const d of kekeDestinations.filter((x) => x.id !== 'car-park')) assert(fareFor(d.id) >= 100 && fareFor(d.id) <= 1200, `private ride to ${d.id} allowed`);
  await assert.rejects(() => ride(50), /Invalid fare/);
  await assert.rejects(() => ride(1300), /Invalid fare/);
  assert.equal(await balance(), 650);
  console.log(`KEKE FARES DB PASSED: route Keke ₦${ROUTE_FARE} and Korope ₦${KOROPE.fare} accepted and charged, private rides in range, out-of-range fares refused, 049 re-runnable.`);
}
main().catch((e) => { console.error(e); process.exit(1); });
