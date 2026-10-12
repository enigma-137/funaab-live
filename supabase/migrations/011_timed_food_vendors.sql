-- 011: Timed campus food vendors (Mai Suya, Indomie & Egg). Apply once AFTER 010.
-- Additive: existing wallets, ledger rows, inventory and Floral World purchases are untouched.
-- Game Naira only. Hours/prices mirror src/config/foodVendors.ts (drift-checked by
-- scripts/test-food-vendors-db.ts). The database clock in Africa/Lagos decides opening hours,
-- so a changed phone clock can never buy from a closed vendor.
begin;

create table public.food_vendors(
 id text primary key, name text not null, closed_message text not null
);
insert into public.food_vendors values
 ('mai_suya','Mai Suya','Mai Suya has closed for the night.'),
 ('indomie_egg','Indomie & Egg','Indomie & Egg is closed right now.');

-- Local Africa/Lagos wall-clock windows; opens inclusive, closes exclusive.
create table public.food_vendor_hours(
 vendor_id text not null references public.food_vendors(id) on delete cascade,
 opens time not null, closes time not null,
 primary key(vendor_id,opens), check(closes>opens)
);
insert into public.food_vendor_hours values
 ('mai_suya','19:00','23:00'),
 ('indomie_egg','07:00','11:00'),('indomie_egg','19:00','23:00');

create table public.food_vendor_items(
 id text primary key check(id like 'vendor_%'),
 vendor_id text not null references public.food_vendors(id) on delete cascade,
 name text not null, price integer not null check(price>0)
);
insert into public.food_vendor_items values
 ('vendor_suya_beef','mai_suya','Beef Suya',800),
 ('vendor_suya_chicken','mai_suya','Chicken Suya',700),
 ('vendor_indomie_plain','indomie_egg','Plain Indomie',600),
 ('vendor_indomie_egg','indomie_egg','Indomie + Egg',800);

-- Idempotent retries: the same request id never charges twice.
create table public.food_vendor_receipts(
 user_id uuid not null references public.profiles(id) on delete cascade,
 request_id uuid not null, result jsonb not null, created_at timestamptz not null default now(),
 primary key(user_id,request_id)
);

create function public.food_vendor_is_open(p_vendor text,p_at timestamptz default now())
returns boolean language sql stable set search_path=public as $$
 select exists(select 1 from food_vendor_hours h where h.vendor_id=p_vendor
  and (p_at at time zone 'Africa/Lagos')::time>=h.opens and (p_at at time zone 'Africa/Lagos')::time<h.closes)
$$;

-- Server clock + open flags: the client uses this to correct a wrong device clock for display.
create function public.food_vendor_status() returns jsonb language sql stable security definer set search_path=public as $$
 select jsonb_build_object('server_now',now(),
  'open',(select jsonb_object_agg(id,food_vendor_is_open(id)) from food_vendors))
$$;

create function public.food_vendor_purchase(p_vendor text,p_item text,p_request uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare u uuid:=auth.uid(); v food_vendors; it food_vendor_items; b numeric; result jsonb;
begin
 if u is null then raise exception 'Authentication required'; end if;
 if p_request is null then raise exception 'Missing request id'; end if;
 -- Lock order matches hostel/keke: profile, then wallet.
 perform 1 from profiles where id=u for update;
 if not found then raise exception 'Profile missing'; end if;
 select r.result into result from food_vendor_receipts r where user_id=u and request_id=p_request;
 if found then return result; end if;
 select * into v from food_vendors where id=p_vendor;
 if not found then raise exception 'Unknown vendor'; end if;
 -- Price comes only from the server menu; the client sends ids, never amounts.
 select * into it from food_vendor_items where id=p_item and vendor_id=p_vendor;
 if not found then raise exception 'That is not on the % menu',v.name; end if;
 if not food_vendor_is_open(p_vendor) then raise exception '%',v.closed_message; end if;
 select balance into b from wallets where user_id=u for update;
 if not found then raise exception 'Open your wallet first'; end if;
 if b<it.price then raise exception 'Insufficient funds for % (₦%)',it.name,it.price; end if;
 b:=b-it.price;
 update wallets set balance=b,updated_at=now() where user_id=u;
 insert into wallet_transactions(user_id,type,amount,balance_after,description,metadata)
  values(u,'food_purchase',-it.price,b,v.name||': '||it.name,jsonb_build_object('vendor',v.id,'item',it.id,'request',p_request));
 insert into inventory(user_id,item_id,item_name,item_type,quantity) values(u,it.id,it.name,'food',1)
  on conflict(user_id,item_id) do update set quantity=inventory.quantity+1,updated_at=now();
 result:=jsonb_build_object('success',true,'balance',b,'vendor',v.id,'item',it.id,'name',it.name,'price',it.price);
 insert into food_vendor_receipts(user_id,request_id,result) values(u,p_request,result);
 return result;
end $$;

-- Close the legacy path: process_wallet_purchase prices unknown items from the client, so vendor
-- items must only ever be bought through food_vendor_purchase (same guard 007 added for hostel items).
create or replace function public.process_wallet_purchase(p_type text default 'food_purchase',p_amount numeric default null,p_description text default null,p_item_id text default null,p_item_name text default null,p_user_id uuid default null)
returns jsonb language plpgsql security definer set search_path=public as $$
begin
 if auth.uid() is null or (p_user_id is not null and p_user_id<>auth.uid()) then raise exception 'Authentication required'; end if;
 if p_item_id like 'hostel_%' then raise exception 'Use Iya Ibeji checkout'; end if;
 if p_item_id like 'vendor_%' then raise exception 'Order this from the vendor stall'; end if;
 return process_wallet_purchase_pre007(p_type,p_amount,p_description,p_item_id,p_item_name,auth.uid());
end $$;

alter table public.food_vendors enable row level security;
alter table public.food_vendor_hours enable row level security;
alter table public.food_vendor_items enable row level security;
alter table public.food_vendor_receipts enable row level security;
revoke all on public.food_vendors,public.food_vendor_hours,public.food_vendor_items,public.food_vendor_receipts from anon,authenticated;
grant select on public.food_vendors,public.food_vendor_hours,public.food_vendor_items to anon,authenticated;
create policy food_vendors_read on public.food_vendors for select using(true);
create policy food_vendor_hours_read on public.food_vendor_hours for select using(true);
create policy food_vendor_items_read on public.food_vendor_items for select using(true);

revoke all on function public.food_vendor_is_open(text,timestamptz),public.food_vendor_status(),public.food_vendor_purchase(text,text,uuid) from public,anon,authenticated;
grant execute on function public.food_vendor_status() to anon,authenticated;
grant execute on function public.food_vendor_purchase(text,text,uuid) to authenticated;
commit;
