// Catch-up script for a database that skipped migration 012: replay every migration except 012,
// run supabase/catchup/012_catchup.sql, then check it ends up identical to a normal replay.
// Run: PGLITE_MODULE=<path to pglite index.cjs> tsx scripts/test-catchup-012.ts
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const { PGlite } = require(process.env.PGLITE_MODULE || '@electric-sql/pglite');
const here = path.dirname(fileURLToPath(import.meta.url));
const dir = path.join(here, '../supabase/migrations');
// The catch-up was written against 001–038; later migrations are applied on top of both databases below.
const all = fs.readdirSync(dir).sort();
const files = all.filter((f) => f < '039');
const later = all.filter((f) => f >= '039');
const PRE = fs.readFileSync(path.join(here, 'test-economy-db.ts'), 'utf8').match(/await db\.exec\(`(create role anon[^`]*)`\)/)![1];

async function fresh(skip012: boolean) {
  const db = new PGlite();
  await db.exec(PRE);
  for (const f of files) if (!(skip012 && f.startsWith('012_'))) await db.exec(fs.readFileSync(path.join(dir, f), 'utf8'));
  return db;
}
const defs = async (db: any) => {
  const r = await db.query(`select p.proname||'('||pg_get_function_identity_arguments(p.oid)||')' n, md5(pg_get_functiondef(p.oid)) h from pg_proc p join pg_namespace s on s.oid=p.pronamespace where s.nspname='public' order by 1`);
  return Object.fromEntries(r.rows.map((x: any) => [x.n, x.h]));
};
const data = async (db: any) => ({
  jobs: (await db.query('select id,reward,dest_x,dest_z,dest_radius from job_catalog order by id')).rows,
  vendors: (await db.query('select id,price from food_vendor_items order by id')).rows,
  hostel: (await db.query('select id,price from hostel_catalog order by id')).rows,
  walletDefault: (await db.query("select column_default d from information_schema.columns where table_name='wallets' and column_name='balance'")).rows,
});

(async () => {
  const full = await fresh(false), stale = await fresh(true);
  assert.equal((await stale.query("select to_regclass('public.campus_food_menu') r")).rows[0].r, null, 'stale db really lacks 012');
  assert.notDeepEqual((await data(stale)).jobs, (await data(full)).jobs, 'stale db differs before the catch-up');
  await stale.exec(fs.readFileSync(path.join(here, '../supabase/catchup/012_catchup.sql'), 'utf8'));
  assert.deepEqual(await data(stale), await data(full), 'rows match a normal replay');
  const a = await defs(stale), b = await defs(full);
  const diff = Object.keys({ ...a, ...b }).filter((k) => a[k] !== b[k]);
  assert.deepEqual(diff, [], 'every function matches a normal replay: ' + diff.join(', '));
  // Production was caught up this way: the later migrations must apply to it exactly as to a full replay.
  for (const f of later) for (const db of [full, stale]) await db.exec(fs.readFileSync(path.join(dir, f), 'utf8'));
  assert.deepEqual(await data(stale), await data(full), 'rows still match after ' + later.join(', '));
  const a2 = await defs(stale), b2 = await defs(full);
  assert.deepEqual(Object.keys({ ...a2, ...b2 }).filter((k) => a2[k] !== b2[k]), [], 'functions still match after later migrations');
  console.log('CATCH-UP 012 PASSED: jobs, vendor and hostel prices, wallet default and every function match a normal replay.');
})().catch((e) => { console.error(e); process.exit(1); });
