-- 045: Fuel for the cars you own (bought in the shop, 041). Apply once AFTER 044 (safe to re-run).
-- Each car has a 40-litre tank and starts with 10 litres. Fuel costs ₦150 a litre at the station.
-- The game reports fuel burnt while you drive, at most 2 litres per report; the tank never goes
-- below empty. Mirrors src/config/cars.ts (scripts/test-cars-db.ts checks drift).
begin;

create table if not exists public.car_fuel(
 user_id uuid not null references public.profiles(id) on delete cascade,
 car_id text not null references public.hostel_catalog(id),
 litres numeric(6,2) not null default 10 check (litres between 0 and 40),
 updated_at timestamptz not null default now(),
 primary key (user_id, car_id)
);
alter table public.car_fuel enable row level security;
revoke all on public.car_fuel from anon,authenticated;

create or replace function public.owns_car(p_user uuid,p_car text) returns boolean
language sql stable security definer set search_path=public as $$
 select exists(select 1 from inventory i join hostel_catalog c on c.id=i.item_id
  where i.user_id=p_user and i.item_id=p_car and i.quantity>0 and c.category='Cars') $$;

-- Your cars and how much fuel each has (a new car gets its starter fuel here).
create or replace function public.car_garage() returns jsonb
language plpgsql security definer set search_path=public as $$
declare u uuid := auth.uid();
begin
 if u is null then raise exception 'Authentication required'; end if;
 insert into car_fuel(user_id,car_id,litres)
  select u,i.item_id,10 from inventory i join hostel_catalog c on c.id=i.item_id
  where i.user_id=u and i.quantity>0 and c.category='Cars' on conflict do nothing;
 return jsonb_build_object('tank',40,'price_per_litre',150,'cars',coalesce((select jsonb_agg(jsonb_build_object('car',f.car_id,'litres',f.litres) order by f.car_id)
  from car_fuel f where f.user_id=u and owns_car(u,f.car_id)),'[]'::jsonb));
end $$;

create or replace function public.buy_fuel(p_car text,p_litres integer) returns jsonb
language plpgsql security definer set search_path=public as $$
declare u uuid := auth.uid(); have numeric; add numeric; cost numeric; b numeric;
begin
 if u is null then raise exception 'Authentication required'; end if;
 if not owns_car(u,p_car) then raise exception 'That is not your car'; end if;
 if p_litres is null or p_litres<1 then raise exception 'Choose how many litres'; end if;
 perform car_garage();
 select litres into have from car_fuel where user_id=u and car_id=p_car for update;
 add := least(p_litres, floor(40-have));
 if add<1 then raise exception 'The tank is already full'; end if;
 cost := add*150;
 perform ensure_player_wallet(u);
 select balance into b from wallets where user_id=u for update;
 if b<cost then raise exception 'Fuel for % litres is ₦%. Top up your wallet first.',add,cost; end if;
 update wallets set balance=balance-cost,updated_at=now() where user_id=u returning balance into b;
 insert into wallet_transactions(user_id,type,amount,balance_after,description,metadata)
  values(u,'fuel',-cost,b,'Fuel: '||add||' litres',jsonb_build_object('car',p_car,'litres',add));
 update car_fuel set litres=litres+add,updated_at=now() where user_id=u and car_id=p_car returning litres into have;
 return jsonb_build_object('car',p_car,'litres',have,'bought',add,'cost',cost,'balance',b);
end $$;

-- Fuel burnt while driving, reported in small steps. Never below empty, never more than 2 litres a step.
create or replace function public.burn_fuel(p_car text,p_litres numeric) returns numeric
language plpgsql security definer set search_path=public as $$
declare u uuid := auth.uid(); have numeric;
begin
 if u is null then raise exception 'Authentication required'; end if;
 if not owns_car(u,p_car) then raise exception 'That is not your car'; end if;
 if p_litres is null or p_litres<0 or p_litres>2 then raise exception 'Invalid fuel report'; end if;
 perform car_garage();
 update car_fuel set litres=greatest(0,litres-round(p_litres,2)),updated_at=now() where user_id=u and car_id=p_car returning litres into have;
 return have;
end $$;

revoke all on function public.owns_car(uuid,text) from public,anon,authenticated;
revoke all on function public.car_garage(),public.buy_fuel(text,integer),public.burn_fuel(text,numeric) from public,anon;
grant execute on function public.car_garage(),public.buy_fuel(text,integer),public.burn_fuel(text,numeric) to authenticated;
commit;
