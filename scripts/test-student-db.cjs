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
  // 029 widens the style allowlist to the client's avatarOptions, no more and no less.
  await db.exec('reset role');
  await db.exec(fs.readFileSync(path.join(dir, '029_avatar_styles.sql'), 'utf8'));
  await as(fresh);
  const options = fs.readFileSync(path.join(__dirname, '../src/config/avatar.ts'), 'utf8');
  for (const key of ['hairstyle', 'topStyle', 'bottomStyle', 'shoeStyle']) {
    const list = options.match(new RegExp(`${key}: \\[([^\\]]*)\\]`))[1];
    const values = [...list.matchAll(/'([^']+)'/g)].map((m) => m[1]);
    assert(values.length > 3, key);
    for (const value of values)
      await db.query('select * from complete_student_profile($1,$2,$3)', [
        'FST',
        JSON.stringify({ ...avatar, [key]: value }),
        true,
      ]);
    await assert.rejects(
      db.query('select * from complete_student_profile($1,$2,$3)', [
        'FST',
        JSON.stringify({ ...avatar, [key]: 'cape' }),
        true,
      ]),
      /Invalid avatar style/,
    );
  }
  // The last accepted save stays; the rejected one changed nothing.
  assert.equal(
    (await db.query("select avatar_config->>'shoeStyle' s from profiles where id=$1", [fresh])).rows[0].s,
    'boots',
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
  await db.close();
  console.log(
    'SQL PASSED: all six migrations plus 029 avatar styles (synced with avatarOptions); beta/new routing; profile, wallet, friends, inventory preservation; unique stable matric; avatar persistence; RLS; protected fields; idempotent badge; anonymous rejection.',
  );
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
