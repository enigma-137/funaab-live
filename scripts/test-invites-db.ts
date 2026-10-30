// Invite to earn (migrations 056, 057): codes, who can redeem, ₦10,000 on signup and ₦5,000 at Level 2,
// the cap, no double pay, payout notices, and bringing invites made under 056 up to the new rules.
// Run: PGLITE_MODULE=<path to pglite index.cjs> npm run test:invites:db
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { INVITES, normalizeInviteCode } from '../src/config/invites';
import { xpForLevel } from '../src/config/levels';

const require = createRequire(import.meta.url);
const { PGlite } = require(process.env.PGLITE_MODULE || '@electric-sql/pglite');

async function main() {
  const db = new PGlite();
  await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema public,auth to anon,authenticated,service_role;`);
  const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '../supabase/migrations');
  const sql = fs.readFileSync(path.join(dir, '057_invite_pay_on_signup.sql'), 'utf8');
  for (const f of fs.readdirSync(dir).sort()) if (f < '057') await db.exec(fs.readFileSync(path.join(dir, f), 'utf8'));
  const rows = async (q: string, p: unknown[] = []) => (await db.query(q, p)).rows as any[];
  const as = async (u: string | null, q: string, p: unknown[] = []) => {
    await db.exec(u ? `set role authenticated; select set_config('request.jwt.claim.sub','${u}',false);` : `set role anon; select set_config('request.jwt.claim.sub','',false);`);
    try { return (await rows(q, p))[0]; } finally { await db.exec('reset role;'); }
  };
  const id = (n: number) => `00000000-0000-4000-8000-${n.toString(16).padStart(12, '0')}`;
  const student = async (n: number, name: string, joinedDaysAgo = 0) => {
    await db.query('insert into auth.users values($1)', [id(n)]);
    await db.query("insert into profiles(id,username,college,created_at) values($1,$2,'COLBIOS',now()-make_interval(days=>$3))", [id(n), name, joinedDaysAgo]);
    await db.query('insert into wallets(user_id,balance) values($1,1000) on conflict(user_id) do update set balance=1000', [id(n)]);
    return id(n);
  };
  const balance = async (u: string) => Number((await rows('select balance from wallets where user_id=$1', [u]))[0].balance);
  // Play: campus jobs give XP through the wallet trigger, like the real game.
  const play = async (u: string, jobs: number) => {
    for (let i = 0; i < jobs; i++) await db.query("insert into wallet_transactions(user_id,type,amount,balance_after,description) values($1,'campus_job',0,0,'job')", [u]);
  };

  const J = INVITES.JOIN_REWARD, L = INVITES.LEVEL_REWARD;
  const news = async (u: string) => (await as(u, 'select invite_news() r')).r as any[];

  // Invites made under 056: one already paid ₦10,000 at Level 2, one still waiting.
  const ola = await student(10, 'Ola', 30), early = await student(11, 'Early'), late = await student(12, 'Late');
  const olaCode = (await as(ola, 'select my_invite() r')).r.code;
  await as(early, 'select redeem_invite($1)', [olaCode]);
  await as(late, 'select redeem_invite($1)', [olaCode]);
  await play(early, 5);
  assert.equal(await balance(ola), 1000 + 10000, '056 paid at Level 2');
  await db.exec(sql);
  assert.equal(await balance(ola), 1000 + 10000 + L + J, 'brought up to the new rules');
  const olaNews = (await news(ola)).map((n) => `${n.kind} @${n.username} ${n.amount}`).sort();
  assert.deepEqual(olaNews, [`join @Early ${J}`, `join @Late ${J}`, `level @Early ${L}`]);
  assert.deepEqual(await news(ola), [], 'each notice once');
  await play(late, 5);
  assert.equal(await balance(ola), 1000 + 10000 + 2 * L + J, 'level bonus after the upgrade');

  // Drift: rewards, unlock level, cap and window agree with the client.
  assert(sql.includes(`'joined with your link'`) && sql.includes(`p_invitee,${J},`) && sql.includes(`'join_reward',${J}`) && sql.includes(`return ${J};`), 'join reward');
  assert(sql.includes(`p_invitee,${L},`) && sql.includes(`'level_reward',${L}`) && sql.includes(`return ${L};`) && sql.includes(`'level','amount',${L}`), 'level reward');
  assert(sql.includes(`'join','amount',${J}`), 'join notice');
  assert(sql.includes(`< ${INVITES.UNLOCK_LEVEL} then return 0`) && sql.includes(`'level',${INVITES.UNLOCK_LEVEL}`), 'unlock level');
  assert(sql.includes(`>= ${INVITES.MAX_PAID} then return 0`) && sql.includes(`'max_paid',${INVITES.MAX_PAID}`), 'cap');
  assert(sql.includes(`interval '${INVITES.REDEEM_DAYS} days'`), 'window');
  const s056 = fs.readFileSync(path.join(dir, '056_invite_to_earn.sql'), 'utf8');
  assert(s056.includes(`new.xp>=${xpForLevel(INVITES.UNLOCK_LEVEL)} and old.xp<${xpForLevel(INVITES.UNLOCK_LEVEL)}`), 'unlock xp');

  const toffy = await student(1, 'Toffy', 30);
  const ada = await student(2, 'Ada');

  // Tables are private; anon can only look up who owns a code.
  await assert.rejects(as(ada, 'select * from invites'), /permission denied/);
  await assert.rejects(as(null, 'select my_invite()'), /permission denied/);
  await assert.rejects(as(ada, `select pay_invite('${ada}')`), /permission denied/);
  await assert.rejects(as(ada, `select pay_invite_join('${ada}')`), /permission denied/);

  assert.deepEqual(await news(toffy), [], 'nothing yet');
  const mine = (await as(toffy, 'select my_invite() r')).r;
  assert.equal(normalizeInviteCode(mine.code), mine.code, 'code shape');
  assert.equal((await as(toffy, 'select my_invite() r')).r.code, mine.code, 'code is stable');
  assert.deepEqual([mine.earned, mine.friends], [0, []]);
  assert.equal((await as(null, 'select invite_owner($1) r', [mine.code.toLowerCase()])).r, 'Toffy');
  assert.equal((await as(null, "select invite_owner('ZZZZZZ') r")).r, null);

  // Redeeming.
  await assert.rejects(as(toffy, 'select redeem_invite($1)', [mine.code]), /own invite/);
  await assert.rejects(as(ada, "select redeem_invite('ZZZZZZ')"), /not valid/);
  const joined = (await as(ada, 'select redeem_invite($1) r', [` ${mine.code.toLowerCase()} `])).r;
  assert.deepEqual([joined.id, joined.username], [toffy, 'Toffy']);
  assert.equal(await balance(toffy), 1000 + J, 'paid on signup');
  assert.deepEqual((await news(toffy)).map((n) => [n.kind, n.username, n.amount]), [['join', 'Ada', J]]);
  assert.deepEqual(await news(toffy), []);
  await assert.rejects(as(ada, 'select redeem_invite($1)', [mine.code]), /already joined/);
  assert.equal(await balance(toffy), 1000 + J, 'one signup, one payment');
  const old = await student(3, 'Oldie', INVITES.REDEEM_DAYS + 1);
  await assert.rejects(as(old, 'select redeem_invite($1)', [mine.code]), /new students/);
  const busy = await student(4, 'Busy');
  await play(busy, 5); // 100 XP: already Level 2
  await assert.rejects(as(busy, 'select redeem_invite($1)', [mine.code]), /new students/);
  assert.equal(await balance(toffy), 1000 + J, 'refused links pay nothing');
  // Two new students can't invite each other.
  const dee = await student(5, 'Dee');
  const eve = await student(6, 'Eve');
  await as(eve, 'select redeem_invite($1)', [(await as(dee, 'select my_invite() r')).r.code]);
  await assert.rejects(as(dee, 'select redeem_invite($1)', [(await as(eve, 'select my_invite() r')).r.code]), /invited this student yourself/);

  // Level 2 bonus, once.
  await play(ada, 4); // 80 XP
  assert.equal(await balance(toffy), 1000 + J, 'not yet');
  await play(ada, 1); // 100 XP → Level 2
  assert.equal(await balance(toffy), 1000 + J + L, 'bonus at Level 2');
  await play(ada, 10);
  assert.equal(await balance(toffy), 1000 + J + L, 'paid once');
  const ledger = await rows("select * from wallet_transactions where user_id=$1 and type='invite_reward' order by created_at", [toffy]);
  assert.equal(ledger.length, 2); assert.match(ledger[0].description, /@Ada joined with your link/); assert.match(ledger[1].description, /@Ada reached Level 2/);
  assert.deepEqual((await news(toffy)).map((n) => [n.kind, n.amount]), [['level', L]]);
  assert.equal(await balance(ada), 1000, 'the invitee pays nothing');
  const after = (await as(toffy, 'select my_invite() r')).r;
  assert.equal(Number(after.earned), J + L);
  assert.deepEqual(after.friends.map((f: any) => [f.username, f.level >= 2, f.join_paid, f.level_paid]), [['Ada', true, true, true]]);

  // Cap: only MAX_PAID invites pay, and an unpaid signup gets no Level 2 bonus either.
  const host = await student(100, 'Host');
  const hostCode = (await as(host, 'select my_invite() r')).r.code;
  for (let i = 0; i <= INVITES.MAX_PAID; i++) {
    const s = await student(200 + i, `New${i}`);
    await as(s, 'select redeem_invite($1)', [hostCode]);
    await play(s, 5);
  }
  assert.equal(await balance(host), 1000 + INVITES.MAX_PAID * (J + L), 'capped');
  assert.equal(Number((await rows('select count(*) n from invites where inviter=$1 and join_paid_at is null and level_paid_at is null', [host]))[0].n), 1);

  // A missing wallet skips the payment but never blocks the signup.
  const nowallet = await student(300, 'NoWallet');
  await db.query('delete from wallets where user_id=$1', [nowallet]);
  const nwCode = (await as(nowallet, 'select my_invite() r')).r.code;
  const fresh = await student(301, 'Fresh');
  assert.equal((await as(fresh, 'select redeem_invite($1) r', [nwCode])).r.username, 'NoWallet');

  console.log('invite db tests passed');
}

main().catch((e) => { console.error(e); process.exit(1); });
