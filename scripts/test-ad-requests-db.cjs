// Renting a shop or billboard from the game (migration 052): a student asks for a free spot with an
// uploaded flyer, an admin approves it for 7 days or rejects it, other requests for that spot are
// closed, admins can add days or end a listing, and none of it works for students who aren't admins.
// Run: npm run test:ad-requests:db
const { PGlite } = require(process.env.PGLITE_MODULE || '@electric-sql/pglite');
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
(async () => {
  const db = new PGlite();
  // auth and a minimal storage schema, as on Supabase.
  await db.exec(`create role anon; create role authenticated; create role service_role;
 create schema auth; create table auth.users(id uuid primary key, email text);
 create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
 create schema storage;
 create table storage.buckets(id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
 create table storage.objects(bucket_id text, name text);
 alter table storage.objects enable row level security;
 create function storage.foldername(name text) returns text[] language sql immutable as $$ select string_to_array(name,'/') $$;
 grant usage on schema public,auth,storage to anon,authenticated; grant execute on function auth.uid() to anon,authenticated;`);
  const dir = path.join(__dirname, '../supabase/migrations');
  for (const file of fs.readdirSync(dir).sort()) await db.exec(fs.readFileSync(path.join(dir, file), 'utf8'));
  // Safe to re-run.
  await db.exec(fs.readFileSync(path.join(dir, '052_ad_requests.sql'), 'utf8'));

  const bucket = (await db.query("select public, file_size_limit, allowed_mime_types from storage.buckets where id='ad-flyers'")).rows[0];
  assert.equal(bucket.public, true, 'flyer bucket is public');
  assert.equal(Number(bucket.file_size_limit), 5242880, '5 MB limit');
  assert((await db.query("select 1 from pg_policies where schemaname='storage' and policyname='ad_flyers_upload_own'")).rows.length, 'upload policy');

  const ids = { smile: '00000000-0000-4000-8000-0000000000a1', leah: '00000000-0000-4000-8000-0000000000a2', admin: '00000000-0000-4000-8000-0000000000a3' };
  for (const [name, id] of Object.entries(ids)) {
    await db.query('insert into auth.users values($1,$2)', [id, name + '@x.test']);
    await db.query("insert into profiles(id,username,college) values($1,$2,'COLENG')", [id, name]);
  }
  await db.query('insert into app_admins(user_id) values($1)', [ids.admin]);
  const flyer = async (id, file) => { await db.query("insert into storage.objects values('ad-flyers',$1)", [`${id}/${file}`]); return `${id}/${file}`; };
  const smileFlyer = await flyer(ids.smile, 'a.png'), leahFlyer = await flyer(ids.leah, 'b.png');
  const as = async (id) => { await db.exec('reset role'); await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id || '']); await db.exec(id ? 'set role authenticated' : 'set role anon'); };
  const submit = (spot, name, flyerPath, link = 'https://wa.me/message/X') =>
    db.query('select submit_ad_request($1,$2,$3,$4,$5,$6,$7) id', [spot, name, 'Tagline', 'About us', '0806 000 0000', link, flyerPath]);
  const url = (p) => `https://abc.supabase.co/storage/v1/object/public/ad-flyers/${p}`;

  // A student asks for Shop 2.
  await as(ids.smile);
  await assert.rejects(() => submit('plaza-shop-2', 'Styled by Smile', `${ids.smile}/missing.png`), /Upload your flyer/, 'flyer must be uploaded');
  await assert.rejects(() => submit('plaza-shop-2', 'Styled by Smile', `${ids.leah}/a.png`), /Upload your flyer/, 'only your own folder');
  await assert.rejects(() => submit('plaza-shop-2', 'Styled by Smile', smileFlyer, 'http://insecure'), /https/, 'links must be https');
  await assert.rejects(() => submit('plaza-shop-2', '   ', smileFlyer), /Business name/, 'name required');
  await assert.rejects(() => submit('plaza-shop-99', 'Styled by Smile', smileFlyer), /check the details/, 'unknown spot');
  const smileReq = (await submit('plaza-shop-2', 'Styled by Smile', smileFlyer)).rows[0].id;
  await assert.rejects(() => submit('plaza-shop-2', 'Styled by Smile', smileFlyer), /already asked/, 'one pending per spot');
  let mine = (await db.query('select ad_my_state() s')).rows[0].s;
  assert.equal(mine.is_admin, false);
  assert.equal(mine.my_requests[0].status, 'pending', 'student sees it waiting');
  assert.equal(mine.pending_count, 0, 'students do not see the queue size');
  await assert.rejects(() => db.query('select admin_ad_state()'), /Admins only/);
  await assert.rejects(() => db.query("select review_ad_request($1,true,'x',null)", [smileReq]), /Admins only/);
  await assert.rejects(() => db.query("select admin_end_ad_listing('plaza-shop-1')"), /Admins only/);
  await assert.rejects(() => db.query('select * from ad_requests'), /permission denied/, 'no direct table access');
  await assert.rejects(() => db.query("insert into ad_listings(spot_id,business_name) values('plaza-shop-3','Free ad')"), /permission denied/, 'cannot list yourself');

  // Another student wants the same shop.
  await as(ids.leah);
  const leahReq = (await submit('plaza-shop-2', 'LeahBella', leahFlyer)).rows[0].id;

  // The admin sees both and approves the first.
  await as(ids.admin);
  mine = (await db.query('select ad_my_state() s')).rows[0].s;
  assert.equal(mine.is_admin, true);
  assert.equal(mine.pending_count, 2, 'admin sees how many are waiting');
  const state = (await db.query('select admin_ad_state() s')).rows[0].s;
  assert.deepEqual(state.requests.map((r) => r.username), ['smile', 'leah'], 'oldest first, with who asked');
  await assert.rejects(() => db.query('select review_ad_request($1,true,$2,null)', [smileReq, url(leahFlyer)]), /does not match/, 'flyer URL must be this upload');
  await db.query('select review_ad_request($1,true,$2,null)', [smileReq, url(smileFlyer)]);
  await db.exec('reset role');
  const listing = (await db.query("select *, extract(epoch from ends_at - starts_at)::int as len from ad_listings where spot_id='plaza-shop-2'")).rows[0];
  await as(ids.admin);
  assert.equal(listing.business_name, 'Styled by Smile');
  assert.equal(listing.owner_id, ids.smile);
  assert.equal(listing.flyer_url, url(smileFlyer));
  assert.equal(listing.len, 7 * 86400, 'up for 7 days');
  await db.exec('reset role');
  const leahNow = (await db.query('select status, admin_note from ad_requests where id=$1', [leahReq])).rows[0];
  await as(ids.admin);
  assert.equal(leahNow.status, 'rejected', 'the other request is closed');
  assert.match(leahNow.admin_note, /Another business got this spot/);
  await assert.rejects(() => db.query('select review_ad_request($1,true,$2,null)', [smileReq, url(smileFlyer)]), /already handled/);

  // Students see it live; the owner sees their end date; the shop is now taken for others.
  await as(null);
  assert.equal((await db.query("select business_name from ad_listings where spot_id='plaza-shop-2'")).rows[0].business_name, 'Styled by Smile', 'public sees the live listing');
  await as(ids.smile);
  mine = (await db.query('select ad_my_state() s')).rows[0].s;
  assert(mine.my_spots['plaza-shop-2'], 'owner sees their live spot');
  assert.equal(mine.my_requests[0].status, 'approved');
  await as(ids.leah);
  await assert.rejects(() => submit('plaza-shop-2', 'LeahBella', leahFlyer), /taken until/, 'taken spots cannot be requested');

  // Rejecting with a reason.
  const billboardReq = (await submit('billboard-car-park', 'LeahBella', leahFlyer)).rows[0].id;
  await as(ids.admin);
  await db.query("select review_ad_request($1,false,null,'Flyer is blurry, please upload a clearer one.')", [billboardReq]);
  await as(ids.leah);
  mine = (await db.query('select ad_my_state() s')).rows[0].s;
  assert.equal(mine.my_requests.find((r) => r.id === billboardReq).admin_note, 'Flyer is blurry, please upload a clearer one.', 'student sees why');

  // Three waiting at most.
  for (const n of [3, 4, 5]) await submit(`plaza-shop-${n}`, 'LeahBella', leahFlyer);
  await assert.rejects(() => submit('plaza-shop-6', 'LeahBella', leahFlyer), /3 requests waiting/);

  // Admin: add days, end it; the spot is free again and expired listings are replaced on approval.
  await as(ids.admin);
  await db.exec('reset role');
  const before = (await db.query("select ends_at from ad_listings where spot_id='plaza-shop-2'")).rows[0].ends_at;
  await as(ids.admin);
  const after = (await db.query("select admin_extend_ad_listing('plaza-shop-2',7) e")).rows[0].e;
  assert.equal(Math.round((after - before) / 86400000), 7, '+7 days');
  await assert.rejects(() => db.query("select admin_extend_ad_listing('plaza-shop-2',0)"), /1 to 60/);
  await db.query("select admin_end_ad_listing('plaza-shop-2')");
  await as(null);
  assert.equal((await db.query("select 1 from ad_listings where spot_id='plaza-shop-2'")).rows.length, 0, 'ended listing is hidden');
  await as(ids.leah);
  const retry = (await submit('plaza-shop-2', 'LeahBella', leahFlyer).catch((e) => e));
  assert.match(String(retry.message || ''), /3 requests waiting/, 'still capped');
  await as(ids.admin);
  await db.exec('reset role');
  const leah3 = (await db.query("select id from ad_requests where user_id=$1 and spot_id='plaza-shop-3'", [ids.leah])).rows[0].id;
  await as(ids.admin);
  await db.query('select review_ad_request($1,false,null,null)', [leah3]);
  await as(ids.leah);
  const leah2 = (await submit('plaza-shop-2', 'LeahBella', leahFlyer)).rows[0].id;
  await as(ids.admin);
  await db.query('select review_ad_request($1,true,$2,null)', [leah2, url(leahFlyer)]);
  await as(null);
  assert.equal((await db.query("select business_name from ad_listings where spot_id='plaza-shop-2'")).rows[0].business_name, 'LeahBella', 'expired spot re-let');

  await as(null);
  await assert.rejects(() => db.query('select ad_my_state()'), /permission denied|Authentication required/, 'anon blocked');
  console.log('AD REQUESTS DB PASSED: flyer in own folder, validation, one pending per spot, 3 max, admin-only review, 7-day listing, others closed, reasons shown, taken spots refused, extend/end, re-let, re-runnable.');
})().catch((e) => { console.error(e); process.exit(1); });
