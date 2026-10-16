// Today's Plan (migration 016): goal draw, server-proven progress, claims, bonus, streaks, drift.
// Run: PGLITE_MODULE=<path to pglite index.cjs> npm run test:daily:db
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { DAILY_GOALS, DAILY_PLAN } from '../src/config/dailyPlan';

const require = createRequire(import.meta.url);
const { PGlite } = require(process.env.PGLITE_MODULE || '@electric-sql/pglite');

async function main() {
  const db = new PGlite();
  await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema public,auth to anon,authenticated,service_role;`);
  const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '../supabase/migrations');
  for (const f of fs.readdirSync(dir).sort()) await db.exec(fs.readFileSync(path.join(dir, f), 'utf8'));
  const rows = async (sql: string, p: unknown[] = []) => (await db.query(sql, p)).rows as any[];
  const one = async (sql: string, p: unknown[] = []) => (await rows(sql, p))[0];
  const call = async (user: string | null, sql: string, p: unknown[] = []) => {
    await db.exec(user ? `set role authenticated; select set_config('request.jwt.claim.sub','${user}',false);` : `set role anon; select set_config('request.jwt.claim.sub','',false);`);
    try { return (await rows(sql, p))[0]; } finally { await db.exec("reset role; select set_config('request.jwt.claim.sub','',false);"); }
  };
  const fails = async (user: string | null, sql: string, re: RegExp, p: unknown[] = []) => {
    await assert.rejects(() => call(user, sql, p), re);
  };
  const asService = async (sql: string, p: unknown[] = []) => {
    await db.exec('set role service_role;');
    try { return (await rows(sql, p))[0]; } finally { await db.exec('reset role;'); }
  };
  let n = 0;
  const student = async (name: string) => {
    const id = `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`;
    await db.query('insert into auth.users values($1)', [id]);
    await db.query("insert into profiles(id,username,college) values($1,$2,'COLENG')", [id, name]);
    await call(id, 'select ensure_player_wallet()');
    return id;
  };
  const balance = async (u: string) => Number((await one('select balance from wallets where user_id=$1', [u])).balance);

  // Drift: catalog and bonus match the client config.
  const catalog = await rows('select id,title,icon,source,target,reward from daily_goal_catalog order by id');
  assert.deepEqual(catalog, [...DAILY_GOALS].sort((a, b) => a.id.localeCompare(b.id)).map(({ id, title, icon, source, target, reward }) => ({ id, title, icon, source, target, reward })), 'catalog matches src/config/dailyPlan.ts');
  assert.match((await rows("select pg_get_functiondef('public.claim_daily_goal(text)'::regprocedure) d"))[0].d, new RegExp(`v_bonus := ${DAILY_PLAN.ALL_DONE_BONUS};`), 'all-done bonus matches');

  // Auth and privileges.
  await fails(null, 'select daily_plan() r', /permission denied|Authentication/);
  const ada = await student('Ada');
  await fails(ada, `select daily_goal_event_trusted('${ada}','visit_love_garden',1)`, /permission denied/, []);
  await fails(ada, `insert into daily_goal_claims(user_id,day,goal_id,reward) values('${ada}',lagos_today(),'buy_food',100)`, /permission denied/);

  // Draw: 3 distinct goals, stable all day, differs between students.
  const plan = (await call(ada, 'select daily_plan() r')).r;
  assert.equal(plan.goals.length, DAILY_PLAN.GOALS_PER_DAY);
  assert.equal(new Set(plan.goals.map((g: any) => g.id)).size, 3);
  assert.deepEqual((await call(ada, 'select daily_plan() r')).r.goals.map((g: any) => g.id), plan.goals.map((g: any) => g.id), 'stable');
  const others = new Set<string>();
  for (let i = 0; i < 6; i++) others.add(JSON.stringify((await call(await student(`S${i}`), 'select daily_plan() r')).r.goals.map((g: any) => g.id)));
  assert(others.size > 1, 'students get different plans');
  assert.equal(plan.streak.current, 0);

  // Make Ada's three goals done through the real ledgers / the Worker path.
  const prove = async (u: string, goal: string) => {
    switch (goal) {
      case 'attend_lecture': await db.query("insert into lecture_attendance(user_id,lecture_id,duration_seconds,reward_claimed) values($1,'fst201',60,100)", [u]); break;
      case 'finish_job': await db.query("insert into job_runs(user_id,job_id,status,completed_at,reward_claimed) values($1,(select id from job_catalog limit 1),'completed',now(),true)", [u]); break;
      case 'buy_food': await db.query("insert into wallet_transactions(user_id,type,amount,balance_after,description) values($1,'food_purchase',-400,0,'Suya')", [u]); break;
      case 'ride_keke': await db.query("insert into keke_tickets(id,user_id,destination,fare,status) values(gen_random_uuid(),$1,'library',50,'completed')", [u]); break;
      case 'game_den_match': await db.query("insert into ps_reward_receipts(match_id,user_id,reward,created_at) values('m1',$1,100,now())", [u]); break;
      default: {
        const target = DAILY_GOALS.find((g) => g.id === goal)!.target;
        for (let i = 0; i < target; i++) await asService(`select daily_goal_event_trusted($1,$2,1) n`, [u, goal]);
      }
    }
  };
  const [g1, g2, g3] = plan.goals.map((g: any) => g.id as string);
  await fails(ada, 'select claim_daily_goal($1) r', /Not done yet/, [g1]);
  const notMine = DAILY_GOALS.map((g) => g.id).find((id) => !plan.goals.some((g: any) => g.id === id))!;
  await prove(ada, notMine);
  await fails(ada, 'select claim_daily_goal($1) r', /not on today/, [notMine]);

  const start = await balance(ada);
  await prove(ada, g1);
  const c1 = (await call(ada, 'select claim_daily_goal($1) r', [g1])).r;
  assert.equal(c1.paid, 1000);
  assert.equal(await balance(ada), start + 1000);
  await fails(ada, 'select claim_daily_goal($1) r', /Already claimed/, [g1]);
  assert.equal(c1.goals.find((g: any) => g.id === g1).claimed, true);
  await prove(ada, g2); await prove(ada, g3);
  await call(ada, 'select claim_daily_goal($1) r', [g2]);
  const last = (await call(ada, 'select claim_daily_goal($1) r', [g3])).r;
  assert.equal(last.paid, 1000 + DAILY_PLAN.ALL_DONE_BONUS, 'last goal pays the all-done bonus');
  assert.equal(await balance(ada), start + 3000 + DAILY_PLAN.ALL_DONE_BONUS);
  assert.equal(last.streak.current, 1);
  assert.equal(last.streak.done_today, true);
  assert.equal(Number((await one("select count(*) n from wallet_transactions where user_id=$1 and type in('daily_goal','daily_plan_bonus')", [ada])).n), 4, 'ledgered');

  // Worker events: only worker goals, bounded amounts, capped counts.
  const bob = await student('Bob');
  await assert.rejects(() => asService("select daily_goal_event_trusted($1,'buy_food',1)", [bob]), /Unknown goal/);
  await assert.rejects(() => asService("select daily_goal_event_trusted($1,'take_penalties',50)", [bob]), /Invalid amount/);
  for (let i = 0; i < 8; i++) await asService("select daily_goal_event_trusted($1,'take_penalties',5)", [bob]);
  assert.equal(Number((await one("select count from daily_goal_events where user_id=$1 and kind='take_penalties'", [bob])).count), 20, 'capped');

  // Streak: consecutive days grow it, a missed day resets it, badges at 3 and 7.
  const streakDay = async (u: string, day: string) => {
    await db.query('update daily_streaks set last_day=$2::date-1 where user_id=$1', [u, day]); // pretend yesterday was completed
  };
  await db.query("update daily_streaks set current=2,last_day=lagos_today()-1 where user_id=$1", [ada]);
  await db.query('delete from daily_goal_claims where user_id=$1', [ada]);
  for (const g of [g1, g2, g3]) await call(ada, 'select claim_daily_goal($1) r', [g]);
  let s = await one('select * from daily_streaks where user_id=$1', [ada]);
  assert.equal(s.current, 3); assert.deepEqual(s.badges, ['streak_3']);
  await db.query("update daily_streaks set current=6,last_day=lagos_today()-1 where user_id=$1", [ada]);
  await db.query('delete from daily_goal_claims where user_id=$1', [ada]);
  for (const g of [g1, g2, g3]) await call(ada, 'select claim_daily_goal($1) r', [g]);
  s = await one('select * from daily_streaks where user_id=$1', [ada]);
  assert.equal(s.current, 7); assert.deepEqual(s.badges, ['streak_3', 'streak_7']); assert.equal(s.best, 7);
  await db.query("update daily_streaks set last_day=lagos_today()-3 where user_id=$1", [ada]);
  assert.equal((await call(ada, 'select daily_plan() r')).r.streak.current, 0, 'a missed day shows the streak as broken');
  await db.query('delete from daily_goal_claims where user_id=$1', [ada]);
  for (const g of [g1, g2, g3]) await call(ada, 'select claim_daily_goal($1) r', [g]);
  s = await one('select * from daily_streaks where user_id=$1', [ada]);
  assert.equal(s.current, 1, 'restarts at 1'); assert.equal(s.best, 7, 'best kept'); assert(s.badges.includes('streak_7'), 'badges kept');
  void streakDay;

  // RLS: students read only their own claims/streak.
  const seen = await call(bob, 'select count(*) n from daily_goal_claims');
  assert.equal(Number(seen.n), 0);
  console.log('DAILY PLAN DB PASSED: drift, auth, draw, ledger-proven + worker goals, claims, bonus, caps, streaks, badges, RLS');
}
main().catch((e) => { console.error(e); process.exit(1); });
