-- 051: Gate Plaza shops and campus billboards. Apply once AFTER 050 (safe to re-run).
-- Who has rented which ad spot. There is no payment or self-serve renting yet: rows are added by an
-- admin (service role). Students can read only the listings that are live right now; a spot with
-- no live row shows as closed ("to let") or "advertisement coming soon".
-- Spot ids mirror PLAZA_SHOPS / BILLBOARDS in src/config/adSpaces.ts (scripts/test-ad-spaces.ts).
begin;

create table if not exists public.ad_listings(
 spot_id text primary key check (spot_id in (
  'plaza-shop-1','plaza-shop-2','plaza-shop-3','plaza-shop-4',
  'plaza-shop-5','plaza-shop-6','plaza-shop-7','plaza-shop-8',
  'billboard-main-gate','billboard-sports-centre','billboard-love-garden','billboard-car-park')),
 business_name text not null check (length(btrim(business_name)) between 1 and 60),
 tagline text check (length(tagline) <= 80),
 description text check (length(description) <= 500),
 flyer_url text check (flyer_url like 'https://%'),
 link_url text check (link_url like 'https://%'),
 contact text check (length(contact) <= 80),
 owner_id uuid references public.profiles(id) on delete set null,
 starts_at timestamptz not null default now(),
 ends_at timestamptz,
 created_at timestamptz not null default now(),
 check (ends_at is null or ends_at > starts_at)
);
alter table public.ad_listings enable row level security;
revoke all on public.ad_listings from anon,authenticated;
grant select (spot_id,business_name,tagline,description,flyer_url,link_url,contact) on public.ad_listings to anon,authenticated;

drop policy if exists ad_listings_live on public.ad_listings;
create policy ad_listings_live on public.ad_listings for select to anon,authenticated
 using (starts_at <= now() and (ends_at is null or ends_at > now()));
commit;
