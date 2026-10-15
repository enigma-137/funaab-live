// The Arena (migration 033): night boundaries, ₦5,000 ticket once per night, closed hours, funds,
// Worker-only sales, XP for the night out and arcade games, drift.
// Run: PGLITE_MODULE=<path to pglite index.cjs> npx tsx scripts/test-party-db.ts
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { PARTY_HALL, partyNight, partyOpen } from '../src/config/partyHall';

const require = createRequire(import.meta.url);
const { PGlite } = require(process.env.PGLITE_MODULE || '@electric-sql/pglite');

async function main() {
  const db = new PGlite();
  await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema public,auth to anon,authenticated,service_role;`);
  const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '../supabase/migrations');
  for (const f of fs.readdirSync(dir).sort()) await db.exec(fs.readFileSync(path.join(dir, f), 'utf8'));
  let sql = fs.readFileSync(path.join(dir, '033_party_hall.sql'), 'utf8');
  // Amounts may have been rescaled since (039): also check the live functions as they are now.
  sql += (await db.query("select string_agg(pg_get_functiondef(p.oid), chr(10)) d from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prokind='f'")).rows[0].d + fs.readFileSync(path.join(dir, '039_economy_x10.sql'), 'utf8');
  const rows = async (q: string, p: unknown[] = []) => (await db.query(q, p)).rows as any[];
  const svc = async (q: string, p: unknown[] = []) => { await db.exec('set role service_role;'); try { return (await rows(q, p))[0]; } finally { await db.exec('reset role;'); } };
  const as = async (u: string, q: string) => { await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub','${u}',false);`); try { return (await rows(q))[0]; } finally { await db.exec('reset role;'); } };
  const ada = '00000000-0000-4000-8000-0000000000a1', bisi = '00000000-0000-4000-8000-0000000000b2';
  for (const [id, name, money] of [[ada, 'Ada', 12000], [bisi, 'Bisi', 3000]] as const) {
    await db.query('insert into auth.users values($1)', [id]);
    await db.query("insert into profiles(id,username,college) values($1,$2,'COLENG')", [id, name]);
    await db.query('insert into wallets(user_id,balance) values($1,$2) on conflict(user_id) do update set balance=excluded.balance', [id, money]);
  }
  const balance = async (u: string) => Number((await rows('select balance from wallets where user_id=$1', [u]))[0].balance);

  // Drift and night boundaries agree with the client.
  assert(sql.includes(`balance>=${PARTY_HALL.gateFee}`) && sql.includes(`balance-${PARTY_HALL.gateFee}`), 'gate fee');
  assert(sql.includes(`>= ${PARTY_HALL.opensMinute / 60}`) && sql.includes(`< ${PARTY_HALL.closesMinute / 60}`), 'hours');
  for (const [utc, night, open] of [
    ['2026-10-14T17:59:00Z', '2026-10-14', false], // 18:59 Lagos (closed; dated today)
    ['2026-10-14T18:00:00Z', '2026-10-14', true], // 19:00
    ['2026-10-14T22:59:00Z', '2026-10-14', true], // 23:59
    ['2026-10-15T01:30:00Z', '2026-10-14', true], // 02:30 next day: same night
    ['2026-10-15T03:59:00Z', '2026-10-14', true], // 04:59
    ['2026-10-15T04:00:00Z', '2026-10-14', false], // 05:00 closed
    ['2026-10-15T11:00:00Z', '2026-10-15', false], // noon (closed; tonight's date)
  ] as const) {
    const ms = Date.parse(utc);
    assert.equal(partyNight(ms), night, `client night ${utc}`);
    assert.equal(partyOpen(ms), open, `client open ${utc}`);
    const r = (await rows('select party_night($1)::text n, party_open($1) o', [utc]))[0];
    assert.equal(r.n, night, `db night ${utc}`); assert.equal(r.o, open, `db open ${utc}`);
  }

  // Only the Worker sells tickets.
  await assert.rejects(as(ada, `select party_entry_trusted('${ada}')`), /permission denied/);
  await assert.rejects(as(ada, 'select * from party_tickets'), /permission denied/);

  // Closed hours (force the clock's answer).
  await db.exec("create or replace function public.party_open(p_at timestamptz default now()) returns boolean language sql stable as $$ select false $$");
  await assert.rejects(svc('select party_entry_trusted($1)', [ada]), /opens at 7 PM/);
  assert.equal(await balance(ada), 12000);
  await db.exec("create or replace function public.party_open(p_at timestamptz default now()) returns boolean language sql stable as $$ select true $$");

  // ₦5,000 once per night; re-entry the same night is free.
  const first = (await svc('select party_entry_trusted($1) r', [ada])).r;
  assert.equal(first.charged, true); assert.equal(Number(first.balance), 7000);
  const again = (await svc('select party_entry_trusted($1) r', [ada])).r;
  assert.equal(again.charged, false); assert.equal(again.night, first.night);
  assert.equal(await balance(ada), 7000);
  assert.equal((await rows("select count(*)::int c from wallet_transactions where user_id=$1 and type='party_ticket' and amount=-5000", [ada]))[0].c, 1);
  // A new night charges again.
  await db.query('update party_tickets set night=night-1 where user_id=$1', [ada]);
  assert.equal((await svc('select party_entry_trusted($1) r', [ada])).r.charged, true);
  assert.equal(await balance(ada), 2000);
  // Not enough money: nothing changes.
  await assert.rejects(svc('select party_entry_trusted($1)', [bisi]), /₦5,000/);
  assert.equal(await balance(bisi), 3000);
  assert.equal((await rows('select count(*)::int c from party_tickets where user_id=$1', [bisi]))[0].c, 0);

  // XP: the night out counts once per ticket; arcade results come from the Worker.
  const lvl = async (u: string) => (await as(u, 'select my_level() l')).l;
  assert.equal((await lvl(ada)).xp, 20);
  assert.equal((await svc("select xp_event_trusted($1,'arcade_win','pool:m1') x", [ada])).x, 8);
  assert.equal((await svc("select xp_event_trusted($1,'arcade_match','pool:m1') x", [ada])).x, 4);
  assert.equal((await lvl(ada)).xp, 32);

  // The bar is on the menu.
  assert.equal((await rows("select count(*)::int c from food_vendor_items where vendor_id='party_bar'"))[0].c, 5);

  await db.close();
  console.log('PARTY DB PASSED: night boundaries match the client, closed hours, ₦5,000 once per night, new night charges, funds check, Worker-only, XP, bar menu.');
}
main().catch((e) => { console.error(e); process.exit(1); });
