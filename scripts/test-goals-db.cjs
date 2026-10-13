// Goals (migration 015): daily tasks are verified from server records and paid once, the
// all-three bonus grows with the streak, badges count real activity, and leaderboards ignore
// transfers. Replays every migration in an in-memory Postgres.
const { PGlite } = require(process.env.PGLITE_MODULE || '@electric-sql/pglite');
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
(async () => {
  const db = new PGlite();
  await db.exec(`create role anon; create role authenticated; create role service_role;
 create schema auth; create table auth.users(id uuid primary key);
 create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
 grant usage on schema public,auth to anon,authenticated; grant execute on function auth.uid() to anon,authenticated;`);
  const dir = path.join(__dirname, '../supabase/migrations');
  for (const file of fs.readdirSync(dir).sort()) await db.exec(fs.readFileSync(path.join(dir, file), 'utf8'));

  const ids = { ada: 'a', tobi: 'b', kemi: 'c' };
  for (const [name, c] of Object.entries(ids)) {
    ids[name] = `00000000-0000-4000-8000-0000000000${c}${c}`;
    await db.query('insert into auth.users values($1)', [ids[name]]);
    await db.query('insert into profiles(id,username,college) values($1,$2,$3)', [ids[name], name, name === 'kemi' ? 'COLFHEC' : 'COLENG']);
  }
  const su = async () => { await db.exec('reset role'); await db.query("select set_config('request.jwt.claim.sub','',false)"); };
  const as = async (id) => { await su(); await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]); await db.exec('set role authenticated'); };
  const rpc = async (id, sql, args = []) => { await as(id); try { return (await db.query(sql, args)).rows[0]; } finally { await su(); } };
  const tasks = (id) => rpc(id, 'select get_daily_tasks() t').then((r) => r.t);
  const claim = (id, task) => rpc(id, 'select claim_daily_task($1) r', [task]).then((r) => r.r);
  const balance = async (id) => Number((await db.query('select balance from wallets where user_id=$1', [id])).rows[0].balance);
  const tx = (id, type, amount) => db.query("insert into wallet_transactions(user_id,type,amount,balance_after,description) values($1,$2,$3,0,'test')", [id, type, amount]);

  // Make a task's evidence exist for today, the way the real game would record it.
  const evidence = {
    allowance: (id) => tx(id, 'daily_reward', 300),
    job: (id) => db.query("insert into job_runs(user_id,job_id,status,completed_at,reward_claimed) values($1,'job-game-den','completed',now(),true)", [id]),
    two_jobs: async (id) => { await evidence.job(id); await evidence.job(id); },
    lecture: (id) => db.query("insert into lecture_attendance(user_id,lecture_id,duration_seconds,reward_claimed) values($1,'L1',60,100)", [id]),
    keke: (id) => db.query("insert into keke_tickets(id,user_id,destination,fare,status) values(gen_random_uuid(),$1,'COLENG',50,'completed')", [id]),
    game_den: (id) => db.query("select ps_reward_trusted('m-'||gen_random_uuid(),$1,$2,$1)", [id, id === ids.kemi ? ids.ada : ids.kemi]),
    food: (id) => tx(id, 'food_purchase', -150),
  };

  for (const id of Object.values(ids)) await rpc(id, 'select ensure_player_wallet()');

  // 1. Three tasks a day, deterministic, not claimable before they're done.
  const today = await tasks(ids.ada);
  assert.equal(today.tasks.length, 3, 'three tasks a day');
  assert.deepEqual((await tasks(ids.ada)).tasks.map((t) => t.id), today.tasks.map((t) => t.id), 'same tasks on reload');
  assert.equal(today.streak, 0);
  assert.equal(today.bonus.reward, 100, 'first bonus is ₦100');
  await assert.rejects(() => claim(ids.ada, today.tasks[0].id), /Not done yet/);
  const notToday = (await db.query('select id from daily_task_catalog')).rows.map((r) => r.id).find((t) => !today.tasks.some((x) => x.id === t));
  await evidence[notToday](ids.ada);
  await assert.rejects(() => claim(ids.ada, notToday), /not one of today/, 'only today\'s tasks pay');
  await assert.rejects(() => claim(ids.ada, 'bonus'), /all three/, 'bonus needs all three');

  // 2. Do the tasks, claim each once.
  for (const t of today.tasks) if (t.id !== notToday) await evidence[t.id](ids.ada);
  const progressed = await tasks(ids.ada);
  assert(progressed.tasks.every((t) => t.progress === t.target && !t.claimed), 'progress counted from records');
  const start = await balance(ids.ada);
  for (const t of today.tasks) assert.equal((await claim(ids.ada, t.id)).reward, 50);
  await assert.rejects(() => claim(ids.ada, today.tasks[0].id), /Already claimed/, 'no double claim');
  const bonus = await claim(ids.ada, 'bonus');
  assert.deepEqual([bonus.reward, bonus.streak], [100, 1]);
  await assert.rejects(() => claim(ids.ada, 'bonus'), /Already claimed/);
  assert.equal(await balance(ids.ada), start + 250, '3 × ₦50 + ₦100 paid exactly once');
  const after = await tasks(ids.ada);
  assert.deepEqual([after.streak, after.best_streak, after.bonus.claimed, after.bonus.reward], [1, 1, true, 100]);

  // 3. Streaks: two earlier bonus days make today day 3 → ₦150. A gap resets it.
  await db.query("insert into daily_task_claims(user_id,day,task,reward,streak) values($1,goals_today()-1,'bonus',100,1),($1,goals_today()-2,'bonus',100,1),($1,goals_today()-5,'bonus',100,1)", [ids.tobi]);
  const tobi = await tasks(ids.tobi);
  assert.deepEqual([tobi.streak, tobi.bonus.reward, tobi.best_streak], [2, 150, 2]);
  for (const t of tobi.tasks) await evidence[t.id](ids.tobi);
  for (const t of tobi.tasks) await claim(ids.tobi, t.id);
  assert.deepEqual(await claim(ids.tobi, 'bonus').then((r) => [r.reward, r.streak]), [150, 3]);
  assert.equal((await db.query('select goals_bonus_for(7) a, goals_bonus_for(30) b')).rows.map((r) => [r.a, r.b])[0].join(), '250,250', 'bonus caps at ₦250');

  // 4. Game Den outcomes are recorded, even when the daily cap pays ₦0.
  await db.query("select ps_reward_trusted('final',$1,$2,$2)", [ids.ada, ids.kemi]);
  const outcomes = (await db.query("select user_id,outcome from ps_reward_receipts where match_id='final' order by outcome")).rows;
  assert.deepEqual(outcomes.map((r) => r.outcome), ['loss', 'win']);

  // 5. Badges.
  assert.equal(await rpc(ids.ada, 'select record_college_visit($1) n', ['coleng']).then((r) => r.n), 1);
  assert.equal(await rpc(ids.ada, 'select record_college_visit($1) n', ['coleng']).then((r) => r.n), 1, 'visits count once');
  await assert.rejects(() => rpc(ids.ada, 'select record_college_visit($1)', ['moon']), /Unknown college/);
  const badges = await rpc(ids.ada, 'select get_achievements() a').then((r) => r.a);
  assert.equal(badges.colleges, 1);
  assert(badges.jobs >= 1 || today.tasks.every((t) => !['job', 'two_jobs'].includes(t.id)));
  const kemiBadges = await rpc(ids.ada, 'select get_achievements($1) a', [ids.kemi]).then((r) => r.a);
  assert(kemiBadges.den_wins >= 1, 'others\' badges are visible and wins counted');
  assert.equal(badges.best_streak, 1);

  // 6. Leaderboards: transfers and bets never count.
  await tx(ids.kemi, 'p2p_transfer_in', 99999);
  await tx(ids.kemi, 'campus_bet_payout', 99999);
  await tx(ids.kemi, 'campus_job', 40);
  await evidence.lecture(ids.kemi);
  const boards = await rpc(ids.kemi, 'select get_leaderboards() b').then((r) => r.b);
  const kemiRow = boards.earners.find((e) => e.username === 'kemi');
  assert(kemiRow && kemiRow.value < 99999, 'transfers and bet payouts excluded');
  assert(boards.me.rank >= 1 && boards.me.earned === kemiRow.value && kemiRow.me === true);
  assert(boards.den_wins.some((r) => r.username === 'kemi'), 'Game Den wins this week');
  const fhec = boards.colleges.find((c) => c.college === 'COLFHEC');
  assert(fhec && fhec.value >= 1 && fhec.students === 1, 'college attendance this week');
  const sorted = boards.earners.map((e) => e.value);
  assert.deepEqual(sorted, [...sorted].sort((a, b) => b - a), 'earners sorted');

  // 7. Locked down.
  await su(); await db.exec('set role anon');
  await assert.rejects(() => db.query('select get_daily_tasks()'), /permission denied/);
  await assert.rejects(() => db.query("select claim_daily_task('job')"), /permission denied/);
  await su(); await db.exec('set role authenticated');
  await assert.rejects(() => db.query("select daily_task_count($1,'job',current_date)", [ids.ada]), /permission denied/, 'helpers are internal');
  await assert.rejects(() => db.query("insert into daily_task_claims values($1,current_date,'x',999,null,now())", [ids.ada]), /permission denied|row-level/, 'clients cannot write claims');
  await su();
  console.log('GOALS DB PASSED: 3 tasks/day from records, claim once, bonus + streak (cap ₦250), outcomes, badges, leaderboards exclude transfers/bets, locked down.');
})().catch((e) => { console.error(e); process.exit(1); });
