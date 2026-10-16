// Campus Grand Prix prizes (migration 050) and the launch gift (supabase/one-off): the Worker-only payout pays
// ₦3,000 / ₦1,500 / ₦500 by place, three paid races a Lagos day, only for cars you own, never to a
// player directly; the gift pays every existing wallet ₦20,000 exactly once however often it runs.
// Run: npm run test:race:db
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { RACE_PRIZES, RACE_PRIZE_DAILY_LIMIT } from '../src/config/carRace';

const require = createRequire(import.meta.url);
const { PGlite } = require(process.env.PGLITE_MODULE || '@electric-sql/pglite');

async function main() {
  const db = new PGlite();
  await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema public,auth to anon,authenticated,service_role;`);
  const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '../supabase/migrations');
  for (const f of fs.readdirSync(dir).sort()) await db.exec(fs.readFileSync(path.join(dir, f), 'utf8'));
  const prizeSql = fs.readFileSync(path.join(dir, '050_race_prizes.sql'), 'utf8');
  const giftSql = fs.readFileSync(path.join(dir, '../one-off/2026-10-grand-prix-launch-gift.sql'), 'utf8');
  await db.exec(prizeSql); // re-runnable
  assert(prizeSql.includes(`array[${RACE_PRIZES.join(',')}]`) && prizeSql.includes(`paid>=${RACE_PRIZE_DAILY_LIMIT}`), 'prizes match src/config/carRace.ts');

  const rows = async (q: string, p: unknown[] = []) => (await db.query(q, p)).rows as any[];
  const as = async (role: string, user: string | null, q: string, p: unknown[] = []) => {
    await db.exec(`set role ${role}; select set_config('request.jwt.claim.sub','${user ?? ''}',false);`);
    try { return (await rows(q, p))[0]; } finally { await db.exec("reset role; select set_config('request.jwt.claim.sub','',false);"); }
  };
  let n = 0;
  const student = async (name: string, money: number) => {
    const id = `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`;
    await db.query('insert into auth.users values($1)', [id]);
    await db.query("insert into profiles(id,username,college) values($1,$2,'COLENG')", [id, name]);
    await as('authenticated', id, 'select ensure_player_wallet()');
    await db.query('update wallets set balance=$2 where user_id=$1', [id, money]);
    return id;
  };
  const balance = async (u: string) => Number((await rows('select balance from wallets where user_id=$1', [u]))[0].balance);
  const reward = (u: string, place: number, ms = 45000, car = 'car_picanto') =>
    as('service_role', null, 'select race_reward_trusted($1,$2,$3,$4) r', [u, car, place, ms]).then((x) => x.r);

  const ada = await student('Ada', 100000);
  await as('authenticated', ada, "select hostel_command('purchase',$1::jsonb)", [JSON.stringify({ item: 'car_picanto', credit: false })]);
  const start = await balance(ada);

  // Prizes by place, three a day, then laps pay nothing.
  let r = await reward(ada, 1);
  assert.deepEqual([r.prize, r.paid_today], [RACE_PRIZES[0], 1]); assert.equal(Number(r.balance), start + RACE_PRIZES[0]);
  r = await reward(ada, 2); assert.deepEqual([r.prize, r.paid_today], [RACE_PRIZES[1], 2]);
  r = await reward(ada, 3); assert.deepEqual([r.prize, r.paid_today], [RACE_PRIZES[2], 3]);
  r = await reward(ada, 1); assert.deepEqual([r.prize, r.paid_today], [0, 3], 'capped');
  assert.equal(await balance(ada), start + RACE_PRIZES.reduce((a, b) => a + b, 0));
  // Yesterday's prizes don't count against today.
  await db.query("update wallet_transactions set created_at=now()-interval '2 days' where user_id=$1 and type='race_prize'", [ada]);
  assert.equal((await reward(ada, 2)).prize, RACE_PRIZES[1], 'a new day');

  // Bad input, someone else's car, and players can't pay themselves.
  await assert.rejects(() => reward(ada, 0), /Invalid place/);
  await assert.rejects(() => reward(ada, 4), /Invalid place/);
  await assert.rejects(() => reward(ada, 1, 5000), /Invalid lap time/);
  await assert.rejects(() => reward(ada, 1, 45000, 'car_gwagon'), /not your car/);
  const bisi = await student('Bisi', 1000);
  await assert.rejects(() => reward(bisi, 1), /not your car/);
  await assert.rejects(() => as('authenticated', ada, "select race_reward_trusted($1,'car_picanto',1,45000)", [ada]), /permission denied/);
  await assert.rejects(() => as('anon', null, "select race_reward_trusted($1,'car_picanto',1,45000)", [ada]), /permission denied/);

  // Launch gift: every wallet once, however often it runs.
  const before = { ada: await balance(ada), bisi: await balance(bisi) };
  await db.exec(giftSql);
  assert.equal(await balance(ada), before.ada + 20000); assert.equal(await balance(bisi), before.bisi + 20000);
  await db.exec(giftSql); await db.exec(giftSql);
  assert.equal(await balance(ada), before.ada + 20000, 'paid once'); assert.equal(await balance(bisi), before.bisi + 20000, 'paid once');
  const ledger = await rows("select user_id,amount,balance_after from wallet_transactions where type='launch_bonus' order by user_id");
  assert.equal(ledger.length, 2); assert(ledger.every((t) => Number(t.amount) === 20000));
  assert.equal(Number(ledger[0].balance_after), before.ada + 20000, 'ledger shows the new balance');

  console.log(`RACE DB PASSED: ₦${RACE_PRIZES.join(' / ₦')} by place, ${RACE_PRIZE_DAILY_LIMIT} paid races a Lagos day, owners only, Worker-only; ₦20,000 launch gift paid once per wallet.`);
}
main().catch((e) => { console.error(e); process.exit(1); });
