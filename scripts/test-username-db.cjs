// Change username (migration 023): signup rules, unique ignoring case, once a week, the rules
// can't be skipped with a direct profile update, other profile edits still work, anon blocked.
const { PGlite } = require(process.env.PGLITE_MODULE || '@electric-sql/pglite');
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
(async () => {
  const db = new PGlite();
  // Supabase's default privileges: anon/authenticated get table rights unless a migration narrows them.
  await db.exec(`create role anon; create role authenticated; create role service_role;
 create schema auth; create table auth.users(id uuid primary key);
 create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
 grant usage on schema public,auth to anon,authenticated; grant execute on function auth.uid() to anon,authenticated;
 alter default privileges in schema public grant all on tables to anon, authenticated;
 alter default privileges in schema public grant all on sequences to anon, authenticated;`);
  const dir = path.join(__dirname, '../supabase/migrations');
  for (const file of fs.readdirSync(dir).sort()) await db.exec(fs.readFileSync(path.join(dir, file), 'utf8'));
  const [me, other] = ['00000000-0000-4000-8000-0000000000e1', '00000000-0000-4000-8000-0000000000e2'];
  for (const [id, name] of [[me, 'Derrick_wears'], [other, 'Ada']]) {
    await db.query('insert into auth.users values($1)', [id]);
    await db.query("insert into profiles(id,username,college) values($1,$2,'COLAMRUD')", [id, name]);
  }
  const as = async (id) => { await db.exec('reset role'); await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]); await db.exec('set role authenticated'); };
  const change = (name) => db.query('select * from change_username($1)', [name]).then((r) => r.rows[0]);
  await as(me);
  for (const bad of ['ab', 'a'.repeat(21), 'has space', 'émoji', 'dash-name', '', null])
    await assert.rejects(() => change(bad), /3–20 letters/, `rejects ${JSON.stringify(bad)}`);
  await assert.rejects(() => change('ada'), /already taken/, 'taken, ignoring case');
  await assert.rejects(() => change('ADA'), /already taken/);
  const same = await change('Derrick_wears');
  assert.equal(same.username_changed_at, null, 'saving the same name is a no-op (no cooldown)');
  const changed = await change('  Derrick  ');
  assert.equal(changed.username, 'Derrick', 'trimmed and saved');
  assert(changed.username_changed_at, 'cooldown starts');
  await assert.rejects(() => change('Derrick2'), /once a week/);
  // The rules can't be skipped: no direct username update; other profile edits still work.
  await assert.rejects(() => db.query("update profiles set username='Hacker' where id=$1", [me]), /permission denied/);
  await db.query(`update profiles set avatar_config='{"x":1}'::jsonb where id=$1`, [me]);
  assert.equal((await db.query('select avatar_config from profiles where id=$1', [me])).rows[0].avatar_config.x, 1);
  // A week later it's allowed again, and the old name is free for someone else.
  await db.exec('reset role');
  await db.query("update profiles set username_changed_at = now() - interval '8 days' where id=$1", [me]);
  await as(me);
  assert.equal((await change('Derrick_W')).username, 'Derrick_W');
  await as(other);
  assert.equal((await change('derrick')).username, 'derrick', 'old names are released');
  await db.exec('reset role');
  await db.query("select set_config('request.jwt.claim.sub','',false)");
  await db.exec('set role anon');
  await assert.rejects(() => change('Anon_name'), /permission denied|Authentication required/);
  console.log('USERNAME DB PASSED: signup rules, unique ignoring case, trim, no-op, once a week, direct update blocked, avatar edits still work, released names, anon blocked.');
})().catch((e) => { console.error(e); process.exit(1); });
