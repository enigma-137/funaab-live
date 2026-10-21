-- 052: Rent a shop or billboard from the game. Apply once AFTER 051 (safe to re-run).
-- A student taps a "to let" spot, fills in their business and uploads a flyer to the public
-- ad-flyers bucket. The request waits for an admin: approving it puts the business on that spot
-- for 7 days (it replaces an expired listing), rejecting it can carry a short reason. Admins can
-- also add days to a listing or end it. Free for now; payment comes later.
--
-- Make yourself an admin (once, in the SQL editor):
--   insert into public.app_admins(user_id) select id from auth.users where email = 'you@example.com';
begin;

create table if not exists public.app_admins(
 user_id uuid primary key references auth.users(id) on delete cascade,
 created_at timestamptz not null default now()
);
alter table public.app_admins enable row level security;
revoke all on public.app_admins from anon,authenticated;

create or replace function public.is_app_admin() returns boolean
language sql stable security definer set search_path=public as $$
 select exists(select 1 from app_admins where user_id=auth.uid()) $$;

create table if not exists public.ad_requests(
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references public.profiles(id) on delete cascade,
 spot_id text not null check (spot_id in (
  'plaza-shop-1','plaza-shop-2','plaza-shop-3','plaza-shop-4',
  'plaza-shop-5','plaza-shop-6','plaza-shop-7','plaza-shop-8',
  'billboard-main-gate','billboard-sports-centre','billboard-love-garden','billboard-car-park')),
 business_name text not null check (length(btrim(business_name)) between 1 and 60),
 tagline text check (length(tagline) <= 80),
 description text check (length(description) <= 500),
 contact text not null check (length(btrim(contact)) between 1 and 80),
 link_url text check (link_url like 'https://%' and length(link_url) <= 300),
 -- Inside the uploader's own folder of the ad-flyers bucket: '<user id>/<file>'.
 flyer_path text not null check (flyer_path ~ '^[0-9a-f-]{36}/[A-Za-z0-9._-]{1,80}$'),
 status text not null default 'pending' check (status in ('pending','approved','rejected')),
 admin_note text check (length(admin_note) <= 200),
 created_at timestamptz not null default now(),
 reviewed_at timestamptz,
 reviewed_by uuid references auth.users(id) on delete set null
);
-- One waiting request per student per spot.
create unique index if not exists ad_requests_one_pending on public.ad_requests(user_id, spot_id) where status = 'pending';
create index if not exists ad_requests_status on public.ad_requests(status, created_at);
alter table public.ad_requests enable row level security;
revoke all on public.ad_requests from anon,authenticated;

-- A listing is live from starts_at until ends_at (open-ended when null), as in 051's policy.
create or replace function public.ad_spot_taken_by_other(p_spot text, p_user uuid) returns timestamptz
language sql stable security definer set search_path=public as $$
 select coalesce(ends_at, 'infinity'::timestamptz) from ad_listings
 where spot_id=p_spot and starts_at<=now() and (ends_at is null or ends_at>now())
   and owner_id is distinct from p_user $$;

-- Ask for a spot. The flyer must already be uploaded to the caller's folder.
create or replace function public.submit_ad_request(
 p_spot text, p_business_name text, p_tagline text, p_description text,
 p_contact text, p_link_url text, p_flyer_path text) returns uuid
language plpgsql security definer set search_path=public as $$
declare
 u uuid := auth.uid(); v_id uuid; v_taken timestamptz; v_has_flyer boolean := true;
 v_name text := btrim(coalesce(p_business_name,''));
 v_tagline text := nullif(btrim(coalesce(p_tagline,'')),'');
 v_description text := nullif(btrim(coalesce(p_description,'')),'');
 v_contact text := btrim(coalesce(p_contact,''));
 v_link text := nullif(btrim(coalesce(p_link_url,'')),'');
begin
 if u is null then raise exception 'Authentication required'; end if;
 if not exists(select 1 from profiles where id=u) then raise exception 'Finish setting up your student profile first.'; end if;
 if length(v_name) not between 1 and 60 then raise exception 'Business name must be 1 to 60 characters.'; end if;
 if length(v_tagline) > 80 then raise exception 'Keep the tagline to 80 characters.'; end if;
 if length(v_description) > 500 then raise exception 'Keep the description to 500 characters.'; end if;
 if length(v_contact) not between 1 and 80 then raise exception 'Add a phone number so customers can reach you.'; end if;
 if v_link is not null and (v_link not like 'https://%' or length(v_link) > 300) then raise exception 'The link must start with https://'; end if;
 if p_flyer_path is null or p_flyer_path not like u::text || '/%' then raise exception 'Upload your flyer first.'; end if;
 if to_regclass('storage.objects') is not null then
  execute 'select exists(select 1 from storage.objects where bucket_id = ''ad-flyers'' and name = $1)' into v_has_flyer using p_flyer_path;
 end if;
 if not v_has_flyer then raise exception 'Upload your flyer first.'; end if;
 v_taken := ad_spot_taken_by_other(p_spot, u);
 if v_taken is not null then
  raise exception 'This spot is taken%. Pick another one.',
   case when v_taken = 'infinity' then '' else ' until ' || to_char(v_taken at time zone 'Africa/Lagos', 'FMDD Mon') end;
 end if;
 if (select count(*) from ad_requests where user_id=u and status='pending') >= 3 then
  raise exception 'You already have 3 requests waiting for review.';
 end if;
 begin
  insert into ad_requests(user_id,spot_id,business_name,tagline,description,contact,link_url,flyer_path)
  values(u,p_spot,v_name,v_tagline,v_description,v_contact,v_link,p_flyer_path) returning id into v_id;
 exception
  when unique_violation then raise exception 'You already asked for this spot. It is waiting for review.';
  when check_violation then raise exception 'Please check the details and try again.';
 end;
 return v_id;
end $$;

-- What the game needs for the signed-in student: admin or not, the spots they hold, their requests.
create or replace function public.ad_my_state() returns jsonb
language plpgsql stable security definer set search_path=public as $$
declare u uuid := auth.uid();
begin
 if u is null then raise exception 'Authentication required'; end if;
 return jsonb_build_object(
  'is_admin', is_app_admin(),
  'my_spots', coalesce((select jsonb_object_agg(spot_id, ends_at) from ad_listings
    where owner_id=u and starts_at<=now() and (ends_at is null or ends_at>now())), '{}'),
  'my_requests', coalesce((select jsonb_agg(jsonb_build_object('id',id,'spot_id',spot_id,'business_name',business_name,
    'status',status,'admin_note',admin_note,'created_at',created_at) order by created_at desc)
    from (select * from ad_requests where user_id=u order by created_at desc limit 20) r), '[]'),
  'pending_count', case when is_app_admin() then (select count(*) from ad_requests where status='pending') else 0 end);
end $$;

-- ---------- Admin ----------
create or replace function public.admin_ad_state() returns jsonb
language plpgsql stable security definer set search_path=public as $$
begin
 if not is_app_admin() then raise exception 'Admins only'; end if;
 return jsonb_build_object(
  'requests', coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'spot_id',r.spot_id,'business_name',r.business_name,
    'tagline',r.tagline,'description',r.description,'contact',r.contact,'link_url',r.link_url,'flyer_path',r.flyer_path,
    'created_at',r.created_at,'username',p.username,'college',p.college,
    'spot_taken_until',ad_spot_taken_by_other(r.spot_id,r.user_id)) order by r.created_at)
    from ad_requests r join profiles p on p.id=r.user_id where r.status='pending'), '[]'),
  'listings', coalesce((select jsonb_agg(jsonb_build_object('spot_id',l.spot_id,'business_name',l.business_name,
    'starts_at',l.starts_at,'ends_at',l.ends_at,'owner',p.username,
    'live',l.starts_at<=now() and (l.ends_at is null or l.ends_at>now())) order by l.spot_id)
    from ad_listings l left join profiles p on p.id=l.owner_id), '[]'));
end $$;

-- Approve: the business goes up for 7 days. p_flyer_url is the public URL of the request's flyer.
create or replace function public.review_ad_request(p_id uuid, p_approve boolean, p_flyer_url text, p_note text)
returns void language plpgsql security definer set search_path=public as $$
declare r ad_requests; v_taken timestamptz; v_note text := nullif(btrim(coalesce(p_note,'')),'');
begin
 if not is_app_admin() then raise exception 'Admins only'; end if;
 select * into r from ad_requests where id=p_id for update;
 if r.id is null or r.status <> 'pending' then raise exception 'This request was already handled.'; end if;
 if not p_approve then
  update ad_requests set status='rejected', admin_note=left(v_note,200), reviewed_at=now(), reviewed_by=auth.uid() where id=p_id;
  return;
 end if;
 if p_flyer_url is null or p_flyer_url not like 'https://%/storage/v1/object/public/ad-flyers/' || r.flyer_path then
  raise exception 'Flyer link does not match the upload.';
 end if;
 v_taken := ad_spot_taken_by_other(r.spot_id, r.user_id);
 if v_taken is not null then raise exception 'Another business holds this spot. End that listing first.'; end if;
 insert into ad_listings(spot_id,business_name,tagline,description,flyer_url,link_url,contact,owner_id,starts_at,ends_at,created_at)
 values(r.spot_id,r.business_name,r.tagline,r.description,p_flyer_url,r.link_url,r.contact,r.user_id,now(),now()+interval '7 days',now())
 on conflict(spot_id) do update set business_name=excluded.business_name, tagline=excluded.tagline,
  description=excluded.description, flyer_url=excluded.flyer_url, link_url=excluded.link_url,
  contact=excluded.contact, owner_id=excluded.owner_id, starts_at=excluded.starts_at,
  ends_at=excluded.ends_at, created_at=excluded.created_at;
 update ad_requests set status='approved', admin_note=left(v_note,200), reviewed_at=now(), reviewed_by=auth.uid() where id=p_id;
 -- Everyone else waiting for this spot is told it has gone.
 update ad_requests set status='rejected', admin_note='Another business got this spot. Try a different one.',
  reviewed_at=now(), reviewed_by=auth.uid() where spot_id=r.spot_id and status='pending';
end $$;

-- Add days to a listing (from now if it has already ended).
create or replace function public.admin_extend_ad_listing(p_spot text, p_days integer) returns timestamptz
language plpgsql security definer set search_path=public as $$
declare v_end timestamptz;
begin
 if not is_app_admin() then raise exception 'Admins only'; end if;
 if p_days not between 1 and 60 then raise exception 'Choose 1 to 60 days.'; end if;
 update ad_listings set ends_at = greatest(coalesce(ends_at, now()), now()) + make_interval(days => p_days)
 where spot_id=p_spot returning ends_at into v_end;
 if v_end is null then raise exception 'No listing on that spot.'; end if;
 return v_end;
end $$;

-- Take a business down now; the spot shows "to let" again.
create or replace function public.admin_end_ad_listing(p_spot text) returns void
language plpgsql security definer set search_path=public as $$
begin
 if not is_app_admin() then raise exception 'Admins only'; end if;
 update ad_listings set ends_at=now() where spot_id=p_spot and (ends_at is null or ends_at>now());
end $$;

revoke all on function public.is_app_admin(), public.ad_spot_taken_by_other(text,uuid),
 public.submit_ad_request(text,text,text,text,text,text,text), public.ad_my_state(), public.admin_ad_state(),
 public.review_ad_request(uuid,boolean,text,text), public.admin_extend_ad_listing(text,integer),
 public.admin_end_ad_listing(text) from public,anon,authenticated;
grant execute on function public.submit_ad_request(text,text,text,text,text,text,text), public.ad_my_state(),
 public.admin_ad_state(), public.review_ad_request(uuid,boolean,text,text),
 public.admin_extend_ad_listing(text,integer), public.admin_end_ad_listing(text) to authenticated;

-- Flyer uploads: a public bucket, images up to 5 MB, each student writes only to their own folder
-- and can't overwrite or delete (so an approved flyer can't be swapped afterwards).
do $$
begin
 if to_regclass('storage.buckets') is null then return; end if;
 insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
 values ('ad-flyers', 'ad-flyers', true, 5242880, array['image/jpeg','image/png','image/webp'])
 on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
 execute 'drop policy if exists ad_flyers_upload_own on storage.objects';
 execute $p$create policy ad_flyers_upload_own on storage.objects for insert to authenticated
  with check (bucket_id = 'ad-flyers' and (storage.foldername(name))[1] = auth.uid()::text)$p$;
end $$;
commit;
