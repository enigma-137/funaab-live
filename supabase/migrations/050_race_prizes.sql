-- 050: Campus Grand Prix prizes. Apply once AFTER 049 (safe to re-run).
-- The Worker watches each lap (checkpoints on the trusted position, its own clock, rivals by time)
-- and calls race_reward_trusted with the place it saw. 1st ₦3,000, 2nd ₦1,500, 3rd ₦500, paid for at
-- most 3 races a Lagos day; later laps still count but pay nothing. Only cars you own win prizes.
-- Mirrors RACE_PRIZES / RACE_PRIZE_DAILY_LIMIT in src/config/carRace.ts (scripts/test-race-db.ts).
begin;

create or replace function public.race_reward_trusted(p_user uuid,p_car text,p_place integer,p_ms integer)
returns jsonb language plpgsql security definer set search_path=public as $$
declare prize integer; paid integer; b numeric;
begin
 if p_place is null or p_place not between 1 and 3 then raise exception 'Invalid place'; end if;
 if p_ms is null or p_ms not between 20000 and 600000 then raise exception 'Invalid lap time'; end if;
 if not owns_car(p_user,p_car) then raise exception 'That is not your car'; end if;
 perform ensure_player_wallet(p_user);
 select balance into b from wallets where user_id=p_user for update;
 select count(*) into paid from wallet_transactions where user_id=p_user and type='race_prize'
  and created_at>=(lagos_today()::timestamp at time zone 'Africa/Lagos');
 if paid>=3 then return jsonb_build_object('prize',0,'paid_today',paid,'balance',b); end if;
 prize := (array[3000,1500,500])[p_place];
 update wallets set balance=balance+prize,updated_at=now() where user_id=p_user returning balance into b;
 insert into wallet_transactions(user_id,type,amount,balance_after,description,metadata)
  values(p_user,'race_prize',prize,b,'Campus Grand Prix: place '||p_place,jsonb_build_object('car',p_car,'place',p_place,'ms',p_ms));
 return jsonb_build_object('prize',prize,'paid_today',paid+1,'balance',b);
end $$;

revoke all on function public.race_reward_trusted(uuid,text,integer,integer) from public,anon,authenticated;
grant execute on function public.race_reward_trusted(uuid,text,integer,integer) to service_role;
commit;
