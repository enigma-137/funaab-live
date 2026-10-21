-- 053 Room shop: sales go straight to the wallet.
-- The app now settles room shop sales by itself while the student is on (no Collect button), so each
-- payout says what sold, e.g. "Room shop: sold 2 snacks". Rules are unchanged: one sale per 20 minutes
-- per item, 15 a day, and the shared ₦25,000 daily hustle cap (039).
create or replace function public.collect_shop() returns jsonb
language plpgsql security definer set search_path=public as $$
declare u uuid := auth.uid(); s room_shops; c shop_stock_catalog; v_ready integer; v_total integer := 0; v_paid integer;
begin
 if u is null then raise exception 'Authentication required'; end if;
 perform 1 from profiles where id=u for update;
 for s in select * from room_shops where user_id=u and units>0 order by item for update loop
  select * into c from shop_stock_catalog where id=s.item;
  -- Sold so far (one per 20 min), limited by today's 15-sale limit and what the cash cap can still pay,
  -- so stock is never used up without being paid for.
  v_ready := least(s.units, floor(extract(epoch from now()-s.selling_since)/1200)::integer,
   greatest(0,15-shop_sold_today(u)), floor(greatest(0,25000-hustle_paid_today(u))/c.unit_price::numeric)::integer);
  continue when v_ready<=0;
  v_paid := pay_hustle(u,'shop',s.item||':'||extract(epoch from clock_timestamp())::text,v_ready*c.unit_price,
   'Room shop: sold '||v_ready||' '||case c.id when 'snacks' then 'snack' when 'data' then 'data card' else lower(c.title) end
    ||case when v_ready=1 then '' else 's' end);
  update room_shops set units=units-v_ready,selling_since=selling_since+(v_ready*interval '20 minutes'),
   sold_today=case when sold_day=lagos_today() then sold_today else 0 end+v_ready,sold_day=lagos_today()
   where user_id=u and item=s.item;
  v_total := v_total+v_paid;
 end loop;
 return shop_state_for(u)||jsonb_build_object('paid',v_total,'balance',(select balance from wallets where user_id=u));
end $$;
