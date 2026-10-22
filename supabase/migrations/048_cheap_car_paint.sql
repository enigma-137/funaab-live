-- 048: A cheaper car (Kia Picanto, ₦80,000) and resprays. Apply once AFTER 047 (safe to re-run).
-- A respray costs ₦5,000 and paints one of your cars in a colour from the list; the colour is kept
-- with the car's fuel row and returned by car_garage(). Mirrors src/config/cars.ts and
-- src/config/hostelItems.ts (scripts/test-cars-db.ts checks drift).
begin;

insert into public.hostel_catalog(id,name,category,price,placement_type,credit,consumable) values
 ('car_picanto','Kia Picanto','Cars',80000,'none',false,false)
on conflict(id) do nothing;

alter table public.car_fuel add column if not exists paint text;
alter table public.car_fuel drop constraint if exists car_fuel_paint_check;
alter table public.car_fuel add constraint car_fuel_paint_check check (paint is null or paint in
 ('silver','black','white','red','blue','green','yellow','orange','purple','pink'));

-- Your cars, their fuel and paint (a new car gets its starter fuel here).
create or replace function public.car_garage() returns jsonb
language plpgsql security definer set search_path=public as $$
declare u uuid := auth.uid();
begin
 if u is null then raise exception 'Authentication required'; end if;
 insert into car_fuel(user_id,car_id,litres)
  select u,i.item_id,10 from inventory i join hostel_catalog c on c.id=i.item_id
  where i.user_id=u and i.quantity>0 and c.category='Cars' on conflict do nothing;
 return jsonb_build_object('tank',40,'price_per_litre',150,'cars',coalesce((select jsonb_agg(jsonb_build_object('car',f.car_id,'litres',f.litres,'paint',f.paint) order by f.car_id)
  from car_fuel f where f.user_id=u and owns_car(u,f.car_id)),'[]'::jsonb));
end $$;

-- Respray one of your cars. The same colour again is refused (no charge).
create or replace function public.paint_car(p_car text,p_paint text) returns jsonb
language plpgsql security definer set search_path=public as $$
declare u uuid := auth.uid(); was text; cost numeric := 5000; b numeric;
begin
 if u is null then raise exception 'Authentication required'; end if;
 if not owns_car(u,p_car) then raise exception 'That is not your car'; end if;
 if p_paint is null or p_paint not in ('silver','black','white','red','blue','green','yellow','orange','purple','pink') then raise exception 'Choose a colour'; end if;
 perform car_garage();
 select paint into was from car_fuel where user_id=u and car_id=p_car for update;
 if was is not distinct from p_paint then raise exception 'Your car is already that colour'; end if;
 perform ensure_player_wallet(u);
 select balance into b from wallets where user_id=u for update;
 if b<cost then raise exception 'A respray is ₦%. Top up your wallet first.',cost; end if;
 update wallets set balance=balance-cost,updated_at=now() where user_id=u returning balance into b;
 insert into wallet_transactions(user_id,type,amount,balance_after,description,metadata)
  values(u,'car_paint',-cost,b,'Car respray: '||p_paint,jsonb_build_object('car',p_car,'paint',p_paint));
 update car_fuel set paint=p_paint,updated_at=now() where user_id=u and car_id=p_car;
 return jsonb_build_object('car',p_car,'paint',p_paint,'cost',cost,'balance',b);
end $$;

revoke all on function public.paint_car(text,text) from public,anon;
grant execute on function public.car_garage(),public.paint_car(text,text) to authenticated;
commit;
