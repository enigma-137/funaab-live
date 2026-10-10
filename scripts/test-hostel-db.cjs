const { PGlite } = require(process.env.PGLITE_MODULE || '@electric-sql/pglite');
const fs = require('node:fs'),
  path = require('node:path'),
  assert = require('node:assert/strict');
(async () => {
  const db = new PGlite();
  await db.exec(`create role anon; create role authenticated; create role service_role;
 create schema auth; create table auth.users(id uuid primary key);
 create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
 grant usage on schema public,auth to anon,authenticated; grant execute on function auth.uid() to anon,authenticated;`);
  const dir = path.join(__dirname, '../supabase/migrations');
  for (const file of fs
    .readdirSync(dir)
    .sort()
    .filter((f) => /^00[1-5]_/.test(f)))
    await db.exec(fs.readFileSync(path.join(dir, file), 'utf8'));
  // Supabase's standard existing table grants before the new migration.
  await db.exec('grant all on all tables in schema public to anon,authenticated;');
  const beta = '00000000-0000-4000-8000-000000000001',
    fresh = '00000000-0000-4000-8000-000000000002';
  await db.query('insert into auth.users values($1),($2)', [beta, fresh]);
  await db.query("insert into profiles(id,username,college) values($1,'BetaStudent','COLFHEC')", [
    beta,
  ]);
  await db.query('insert into wallets(user_id,balance) values($1,7777)', [beta]);
  await db.query("insert into inventory(user_id,item_id,item_name) values($1,'jollof','Jollof')", [
    beta,
  ]);
  const before = await db.query('select * from wallets');
  await db.exec(fs.readFileSync(path.join(dir, '006_student_journey.sql'), 'utf8'));
  assert.deepEqual((await db.query('select * from wallets')).rows, before.rows);
  assert.equal(
    (await db.query('select beta_player from student_journeys where user_id=$1', [beta])).rows[0]
      .beta_player,
    true,
  );
  await db.query("insert into profiles(id,username,college) values($1,'NewStudent','COLFHEC')", [
    fresh,
  ]);
  await db.query('insert into friends(user_id,friend_id) values($1,$2)', [beta, fresh]);
  const friends = (await db.query('select * from friends')).rows;
  const inventory = (await db.query('select * from inventory')).rows;
  const avatar = {
    bodyType: 'feminine',
    skinTone: '#8d5524',
    hairstyle: 'braids',
    hairColor: '#211b18',
    topStyle: 'polo',
    topColor: '#15803d',
    bottomStyle: 'jeans',
    bottomColor: '#27364a',
    shoeStyle: 'sneakers',
    shoeColor: '#eeeeea',
    shirtColor: '#15803d',
    skinColor: '#8d5524',
  };
  async function as(id) {
    await db.exec('reset role');
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]);
    await db.exec('set role authenticated');
  }
  await as(beta);
  await db.query('select public.ensure_student_journey()');
  const accepted = (await db.query('select * from accept_game_admission($1)', ['FST'])).rows[0];
  assert(accepted.game_matric_number);
  assert.equal(accepted.onboarding_completed, false, 'Accepting admission does not bypass avatar setup');
  const acceptedAgain = (await db.query('select * from accept_game_admission($1)', ['FST'])).rows[0];
  assert.equal(acceptedAgain.game_matric_number, accepted.game_matric_number);
  const completed = (
    await db.query('select * from public.complete_student_profile($1,$2,$3)', [
      'FST',
      JSON.stringify(avatar),
      false,
    ])
  ).rows[0];
  assert.equal(completed.id, beta);
  assert.equal(completed.game_matric_number, accepted.game_matric_number);
  assert.equal(completed.username, 'BetaStudent');
  assert.equal(completed.onboarding_completed, true);
  assert.deepEqual(completed.avatar_config, avatar);
  const again = (
    await db.query('select * from public.complete_student_profile($1,$2,$3)', [
      'FST',
      JSON.stringify(avatar),
      false,
    ])
  ).rows[0];
  assert.equal(again.game_matric_number, completed.game_matric_number);
  await assert.rejects(
    db.query("update profiles set game_matric_number='spoof' where id=$1", [beta]),
    /permission denied/,
  );
  await assert.rejects(
    db.query('update student_journeys set beta_player=false where user_id=$1', [beta]),
    /permission denied/,
  );
  await assert.rejects(db.query('select claim_orientation_badge()'), /Explore all five stops/);
  await db.query(
    "update student_journeys set orientation_steps=array['car-park','keke','college','food','student'] where user_id=$1",
    [beta],
  );
  const badge = (await db.query('select * from claim_orientation_badge()')).rows[0];
  const repeat = (await db.query('select * from claim_orientation_badge()')).rows[0];
  assert.equal(
    String(badge.orientation_badge_claimed_at),
    String(repeat.orientation_badge_claimed_at),
  );
  await as(fresh);
  const journey = (await db.query('select * from ensure_student_journey()')).rows[0];
  assert.equal(journey.beta_player, false);
  assert.equal(
    (await db.query('select * from student_journeys where user_id=$1', [beta])).rows.length,
    0,
    'Another user cannot read story',
  );
  const other = (
    await db.query('select * from complete_student_profile($1,$2,$3)', [
      'FST',
      JSON.stringify(avatar),
      true,
    ])
  ).rows[0];
  assert.notEqual(other.game_matric_number, completed.game_matric_number);
  await assert.rejects(
    db.query('select * from complete_student_profile($1,$2,$3)', [
      'FST',
      JSON.stringify({ ...avatar, hairstyle: 'bad' }),
      true,
    ]),
    /Invalid avatar/,
  );
  assert.equal(
    (await db.query('select course_id,game_matric_number from profiles where id=$1', [beta])).rows
      .length,
    1,
    'Public identity remains available',
  );
  await db.exec('reset role');
  assert.deepEqual((await db.query('select * from wallets')).rows, before.rows);
  assert.deepEqual((await db.query('select * from friends')).rows, friends);
  assert.deepEqual((await db.query('select * from inventory')).rows, inventory);
  await db.exec('set role anon');
  await assert.rejects(db.query('select * from ensure_student_journey()'), /permission denied/);

  await db.exec('reset role');
  const legacy = {};
  for(const table of ['profiles','wallets','friends','inventory']) legacy[table]=(await db.query('select * from '+table+' order by id')).rows;
  await db.exec(fs.readFileSync(path.join(dir,'007_hostel_life.sql'),'utf8'));
  for(const table of Object.keys(legacy)) assert.deepEqual((await db.query('select * from '+table+' order by id')).rows,legacy[table],table+' preserved by 007');
  assert.equal((await db.query('select count(*)::int n from hostel_rooms')).rows[0].n,2);
  await as(beta);
  const cmd=async(action,data={},key='10000000-0000-4000-8000-'+String(++counter).padStart(12,'0'))=>(await db.query('select hostel_command($1,$2,$3) result',[action,JSON.stringify(data),key])).rows[0].result;
  let counter=0;
  const key='20000000-0000-4000-8000-000000000001';
  const bal=Number((await db.query('select balance from wallets where user_id=$1',[beta])).rows[0].balance);
  await cmd('purchase',{item:'hostel_tv_basic'},key);await cmd('purchase',{item:'hostel_tv_basic'},key);
  assert.equal(Number((await db.query('select balance from wallets where user_id=$1',[beta])).rows[0].balance),bal-500);
  assert.equal((await db.query("select quantity from inventory where item_id='hostel_tv_basic'")).rows[0].quantity,1);
  await assert.rejects(cmd('purchase',{item:'hostel_tv_basic'}),/already own/);
  await assert.rejects(db.query("insert into inventory(user_id,item_id,item_name) values($1,'hostel_ps_console','Cheat')",[beta]),/permission denied/);
  await assert.rejects(db.query("select process_wallet_purchase(p_item_id=>'hostel_ps_console',p_amount=>0)"),/Iya Ibeji/);
  const oldPurchaseFunctions=(await db.query("select oid::regprocedure::text sig,has_function_privilege('authenticated',oid,'EXECUTE') allowed from pg_proc where pronamespace='public'::regnamespace and proname like 'process_wallet_purchase%'")).rows;
  assert.equal(oldPurchaseFunctions.filter(f=>f.allowed).length,1,'Only canonical guarded purchase RPC remains executable');
  await cmd('place',{item:'hostel_tv_basic',anchor:'floor-b',rotation:90});
  await assert.rejects(cmd('place',{item:'hostel_tv_basic',anchor:'wall-a'}),/Invalid placement/);
  await cmd('place',{item:'hostel_tv_basic',anchor:'floor-c',rotation:180});
  assert.equal((await db.query('select hostel_snapshot($1) s',[beta])).rows[0].s.placements[0].anchor,'floor-c');
  await cmd('place',{item:'hostel_tv_basic',anchor:null});
  assert.equal((await db.query('select hostel_snapshot($1) s',[beta])).rows[0].s.placements.length,0);
  await cmd('purchase',{item:'hostel_ps_console',credit:true});
  await assert.rejects(cmd('place',{item:'hostel_ps_console',anchor:'desk-a'}),/Small Table/);
  const debt=(await db.query('select * from game_debts')).rows[0];assert.equal(debt.amount,880);
  await assert.rejects(cmd('purchase',{item:'hostel_generator_small',credit:true}),/credit limit/);
  await cmd('pay',{debt:debt.id});await cmd('pay',{debt:debt.id});
  assert.equal(Number((await db.query('select balance from wallets where user_id=$1',[beta])).rows[0].balance),bal-500-880);
  await cmd('invite',{guest:fresh});await as(fresh);
  await assert.rejects(db.query('select hostel_snapshot($1)',[beta]),/private/);
  await cmd('respond',{owner:beta,accept:true});
  assert.equal((await db.query('select hostel_snapshot($1) s',[beta])).rows[0].s.room.owner_id,beta);
  await assert.rejects(db.query("insert into room_placements values($1,'hostel_tv_basic','floor-a',0)",[beta]),/permission denied/);
  assert.equal((await db.query('select * from game_debts where user_id=$1',[beta])).rows.length,0);
  await as(beta);await cmd('privacy',{privacy:'private'});await as(fresh);
  await assert.rejects(db.query('select hostel_snapshot($1)',[beta]),/private/);
  await as(beta);await cmd('privacy',{privacy:'friends'});await as(fresh);
  await db.query('select hostel_snapshot($1)',[beta]);
  await assert.rejects(db.query("select job_action_trusted($1,'accept','job-food-delivery')",[fresh]),/permission denied/);
  await db.exec('reset role');
  await db.query('insert into wallets(user_id,balance) values($1,5000) on conflict do nothing',[fresh]);
  const trusted=async(action,run=null,x=null,z=null)=>(await db.query('select job_action_trusted($1,$2,$3,$4,$5,$6) r',[fresh,action,'job-food-delivery',run,x,z])).rows[0].r;
  const run=await trusted('accept');assert.equal((await trusted('accept')).id,run.id);
  await assert.rejects(trusted('deliver',run.id,-18,-53),/Collect/);
  await db.query("update job_runs set accepted_at=now()-interval '1 minute' where id=$1",[run.id]);
  await assert.rejects(trusted('pickup',run.id,0,0),/pickup marker/);
  await trusted('pickup',run.id,-28,-26);
  await assert.rejects(trusted('deliver',run.id,-18,-53),/15 seconds/);
  await db.query("update job_runs set pickup_at=now()-interval '1 minute' where id=$1",[run.id]);
  await assert.rejects(trusted('deliver',run.id,-28,-26),/correct destination/);
  const beforeJob=Number((await db.query('select balance from wallets where user_id=$1',[fresh])).rows[0].balance);
  await trusted('deliver',run.id,-18,-53);await trusted('deliver',run.id,-18,-53);
  assert.equal(Number((await db.query('select balance from wallets where user_id=$1',[fresh])).rows[0].balance),beforeJob+250);
  assert.equal((await db.query("select count(*)::int n from wallet_transactions where metadata->>'job_run'=$1",[run.id])).rows[0].n,1);
  await assert.rejects(trusted('accept'),/five minutes/);
  await db.query('select ps_reward_trusted($1,$2,$3,$2)',['match-one',beta,fresh]);
  await db.query('select ps_reward_trusted($1,$2,$3,$2)',['match-one',beta,fresh]);
  assert.equal((await db.query('select count(*)::int n from ps_reward_receipts')).rows[0].n,2);
  assert.equal((await db.query('select sum(reward)::int n from ps_reward_receipts')).rows[0].n,160);
  await db.query('select ps_reward_trusted($1,$2,$3,$2)',['match-two',beta,fresh]);
  assert.equal((await db.query("select sum(reward)::int n from ps_reward_receipts where match_id='match-two'")).rows[0].n,0);
  await as(beta);await cmd('sleep');await cmd('purchase',{item:'hostel_generator_small',credit:true});
  await db.exec('reset role');await db.query("update game_debts set due_at=now()-interval '2 days' where user_id=$1 and paid_at is null",[beta]);
  await as(beta);await cmd('security');
  assert((await db.query('select hostel_snapshot($1) s',[beta])).rows[0].s.room.security_at);
  await db.exec('set role anon');await assert.rejects(db.query("select hostel_command('ensure')"),/permission denied/);
  console.log('HOSTEL SQL PASSED: preservation, atomic checkout/retry, credit limit/payment, placement, privacy/invites, RLS, jobs/replay/timing/ledger, PS limits, sleep, overdue.');

  await db.close();
  console.log(
    'SQL PASSED: all six migrations; beta/new routing; profile, wallet, friends, inventory preservation; unique stable matric; avatar persistence; RLS; protected fields; idempotent badge; anonymous rejection.',
  );
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
