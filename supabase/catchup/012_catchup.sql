-- Catch-up for a database that skipped migration 012 (economy rebalance) but has 013-037.
-- Order matters: 012, then the newer Game Den function (015), then 027 (job radius), then 038 (daily 500).
-- Run once. Tested by scripts/test-catchup-012.ts.

-- 012: Economy rebalance + money-endpoint hardening. Apply once AFTER 011.
-- Game Naira only. Existing wallet balances, ledger rows, inventory, debts and receipts are NOT
-- rewritten: no UPDATE touches wallets here. New values mirror src/config/economy.ts,
-- src/config/foodVendors.ts and src/config/hostelItems.ts; scripts/test-economy-db.ts replays every
-- migration and fails if they drift.
begin;

-- ---------------------------------------------------------------------------------------------
-- 1. Starter wallet ₦7,500 — granted only when a student's wallet is first created.
--    wallets.user_id is unique, so the starter (and its ledger row) can only ever be granted once.
-- ---------------------------------------------------------------------------------------------
alter table public.wallets alter column balance set default 7500.00;

create or replace function public.ensure_player_wallet(p_user_id uuid default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare u uuid := auth.uid(); w wallets;
begin
 -- Identity comes only from the session; p_user_id is accepted for old clients and ignored.
 if u is null then return jsonb_build_object('success',false,'error','Unauthorized: User not authenticated'); end if;
 insert into wallets(user_id,balance,starter_balance_granted_at) values(u,7500.00,now())
  on conflict(user_id) do nothing returning * into w;
 if found then
  insert into wallet_transactions(user_id,type,amount,balance_after,description)
   values(u,'starter_bonus',7500.00,7500.00,'FUNAAB Resumption Starter Allowance');
 else
  select * into w from wallets where user_id=u;
 end if;
 return jsonb_build_object('success',true,'user_id',w.user_id,'balance',w.balance,
  'starter_granted',w.starter_balance_granted_at is not null);
end $$;

-- ---------------------------------------------------------------------------------------------
-- 2. Daily allowance ₦300, once per 20 hours (was ₦1,000).
-- ---------------------------------------------------------------------------------------------
create or replace function public.claim_daily_reward(p_user_id uuid default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare u uuid := auth.uid(); v_reward constant numeric := 300.00; v_last timestamptz; b numeric;
begin
 if u is null then return jsonb_build_object('success',false,'error','Unauthorized: User not authenticated'); end if;
 perform ensure_player_wallet();
 -- Row lock serializes concurrent claims: the second one sees the new timestamp.
 select balance,last_daily_reward_at into b,v_last from wallets where user_id=u for update;
 if v_last is not null and now()-v_last < interval '20 hours' then
  return jsonb_build_object('success',false,'error','Daily reward already claimed today. Please check back tomorrow!');
 end if;
 update wallets set balance=balance+v_reward,last_daily_reward_at=now(),updated_at=now()
  where user_id=u returning balance into b;
 insert into wallet_transactions(user_id,type,amount,balance_after,description)
  values(u,'daily_reward',v_reward,b,'Daily Campus Student Stipend');
 return jsonb_build_object('success',true,'reward',v_reward,'balance',b);
end $$;

-- ---------------------------------------------------------------------------------------------
-- 3. Lecture attendance ₦100, server-priced. Once per lecture per hour, at most 3 paid lectures per
--    Africa/Lagos day. p_allowance is kept in the signature for old clients and ignored.
-- ---------------------------------------------------------------------------------------------
create or replace function public.claim_lecture_attendance(p_lecture_id text,p_duration_seconds integer,
 p_allowance numeric,p_user_id uuid default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare u uuid := auth.uid(); v_reward constant numeric := 100.00; v_daily_limit constant integer := 3;
 b numeric; v_day_start timestamptz;
begin
 if u is null then return jsonb_build_object('success',false,'error','Unauthorized: User not authenticated'); end if;
 if p_lecture_id is null or length(p_lecture_id) not between 1 and 64 then
  return jsonb_build_object('success',false,'error','Unknown lecture');
 end if;
 if coalesce(p_duration_seconds,0) < 30 then
  return jsonb_build_object('success',false,'error','You must attend for at least 30 seconds to be eligible for attendance allowance');
 end if;
 perform ensure_player_wallet();
 select balance into b from wallets where user_id=u for update;
 if exists(select 1 from lecture_attendance where user_id=u and lecture_id=p_lecture_id and now()-created_at < interval '1 hour') then
  return jsonb_build_object('success',false,'error','Lecture attendance allowance already claimed for this session');
 end if;
 v_day_start := date_trunc('day', now() at time zone 'Africa/Lagos') at time zone 'Africa/Lagos';
 if (select count(*) from lecture_attendance where user_id=u and created_at>=v_day_start and reward_claimed>0) >= v_daily_limit then
  return jsonb_build_object('success',false,'error','Daily lecture allowance limit reached (3 lectures). Attendance still counts!');
 end if;
 update wallets set balance=balance+v_reward,updated_at=now() where user_id=u returning balance into b;
 insert into lecture_attendance(user_id,lecture_id,duration_seconds,reward_claimed) values(u,p_lecture_id,p_duration_seconds,v_reward);
 insert into wallet_transactions(user_id,type,amount,balance_after,description,metadata)
  values(u,'lecture_attendance',v_reward,b,'Lecture Attendance Allowance: '||p_lecture_id,
   jsonb_build_object('lectureId',p_lecture_id,'durationSeconds',p_duration_seconds));
 return jsonb_build_object('success',true,'reward',v_reward,'balance',b);
end $$;

-- ---------------------------------------------------------------------------------------------
-- 4. Close the user-id fallback on money RPCs. These were executable by PUBLIC (Postgres default)
--    and resolve identity as coalesce(auth.uid(), p_*_id): an anonymous caller could name any
--    student, e.g. as the SENDER of a P2P transfer. With anon/PUBLIC revoked, every caller has an
--    auth.uid(), so the fallback id is never used.
-- ---------------------------------------------------------------------------------------------
revoke all on function public.ensure_player_wallet(uuid) from public, anon;
revoke all on function public.claim_daily_reward(uuid) from public, anon;
revoke all on function public.claim_lecture_attendance(text,integer,numeric,uuid) from public, anon;
revoke all on function public.transfer_money_p2p(text,numeric,text,uuid) from public, anon;
grant execute on function public.ensure_player_wallet(uuid) to authenticated, service_role;
grant execute on function public.claim_daily_reward(uuid) to authenticated, service_role;
grant execute on function public.claim_lecture_attendance(text,integer,numeric,uuid) to authenticated, service_role;
grant execute on function public.transfer_money_p2p(text,numeric,text,uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------------------------
-- 5. Campus jobs: higher pay, first-job-of-the-day bonus, and the COLENG drop-off moved with the
--    enlarged COLENG building (forecourt is now z=-51; the old z=-57 point is 6m away, outside
--    the 5m delivery radius).
-- ---------------------------------------------------------------------------------------------
alter table public.job_catalog drop constraint if exists job_catalog_reward_check;
alter table public.job_catalog add constraint job_catalog_reward_check check(reward between 100 and 1000);
update public.job_catalog set reward=500, dest_x=80, dest_z=-51 where id='job-food-delivery'; -- long delivery
update public.job_catalog set reward=350 where id='job-medical-errand';
update public.job_catalog set reward=300 where id='job-sports-cones';
update public.job_catalog set reward=250 where id='job-game-den';

create or replace function public.job_action_trusted(p_user uuid,p_action text,p_job text default null,p_run uuid default null,p_x numeric default null,p_z numeric default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare j job_catalog; r job_runs; b numeric; v_bonus integer := 0;
 v_day_start timestamptz := date_trunc('day', now() at time zone 'Africa/Lagos') at time zone 'Africa/Lagos';
begin
 perform 1 from profiles where id=p_user for update;
 if not found then raise exception 'Profile missing'; end if;
 if p_action='accept' then
  select * into r from job_runs where user_id=p_user and status in('accepted','picked_up');
  if found then return to_jsonb(r); end if;
  select * into j from job_catalog where id=p_job;
  if not found then raise exception 'Unknown job'; end if;
  if (select count(*) from job_runs where user_id=p_user and completed_at>now()-interval '24 hours')>=12 then raise exception 'Daily shift limit reached'; end if;
  if exists(select 1 from job_runs where user_id=p_user and job_id=p_job and completed_at>now()-interval '5 minutes') then raise exception 'This job resets five minutes after completion'; end if;
  insert into job_runs(user_id,job_id) values(p_user,p_job) returning * into r;
 else
  select * into r from job_runs where id=p_run and user_id=p_user for update;
  if not found then raise exception 'Active job not found'; end if;
  select * into j from job_catalog where id=r.job_id;
  if r.status='completed' then return to_jsonb(r); end if;
  if p_action='cancel' and r.status in('accepted','picked_up') then
   update job_runs set status='cancelled' where id=r.id returning * into r;
  elsif p_action='pickup' then
   if r.status<>'accepted' then raise exception 'Order already collected'; end if;
   if p_x is null or p_z is null or sqrt(power(p_x-j.source_x,2)+power(p_z-j.source_z,2))>5 then raise exception 'Go to the pickup marker'; end if;
   if now()<r.accepted_at+interval '3 seconds' then raise exception 'Wait for the order to be ready'; end if;
   update job_runs set status='picked_up',pickup_at=now() where id=r.id returning * into r;
  elsif p_action='deliver' then
   if r.status<>'picked_up' or r.pickup_at is null then raise exception 'Collect the order first'; end if;
   if p_x is null or p_z is null or sqrt(power(p_x-j.dest_x,2)+power(p_z-j.dest_z,2))>5 then raise exception 'Go to the correct destination'; end if;
   if now()<r.pickup_at+interval '15 seconds' then raise exception 'Complete the route or station check first (15 seconds minimum)'; end if;
   select balance into b from wallets where user_id=p_user for update;
   if b is null then raise exception 'Open your wallet first'; end if;
   -- Bonus only for the first completion of the Lagos day; this run is not completed yet, and the
   -- profile lock above serializes concurrent deliveries, so it cannot be paid twice.
   if not exists(select 1 from job_runs where user_id=p_user and status='completed' and completed_at>=v_day_start) then
    v_bonus := 200;
   end if;
   update wallets set balance=balance+j.reward,updated_at=now() where user_id=p_user returning balance into b;
   insert into wallet_transactions(user_id,type,amount,balance_after,description,metadata) values(p_user,'campus_job',j.reward,b,j.title,jsonb_build_object('job_run',r.id));
   if v_bonus > 0 then
    update wallets set balance=balance+v_bonus,updated_at=now() where user_id=p_user returning balance into b;
    insert into wallet_transactions(user_id,type,amount,balance_after,description,metadata) values(p_user,'campus_job_bonus',v_bonus,b,'First job of the day bonus',jsonb_build_object('job_run',r.id));
   end if;
   update job_runs set status='completed',completed_at=now(),reward_claimed=true where id=r.id returning * into r;
   return to_jsonb(r) || jsonb_build_object('paid',j.reward,'bonus',v_bonus);
  else raise exception 'Invalid job action'; end if;
 end if;
 return to_jsonb(r);
end $$;
revoke all on function public.job_action_trusted(uuid,text,text,uuid,numeric,numeric) from public,anon,authenticated;
grant execute on function public.job_action_trusted(uuid,text,text,uuid,numeric,numeric) to service_role;

-- ---------------------------------------------------------------------------------------------
-- 6. Game Den: winner ₦250 / loser ₦100 / draw ₦150. Still 6 rewarded matches a day and a
--    2-minute cooldown, plus at most 2 rewarded matches a day against the same opponent.
-- ---------------------------------------------------------------------------------------------
alter table public.ps_reward_receipts add column if not exists opponent uuid references public.profiles(id);
create index if not exists ps_reward_pair on public.ps_reward_receipts(user_id,opponent,created_at desc);

create or replace function public.ps_reward_trusted(p_match text,p_host uuid,p_guest uuid,p_winner uuid)
returns void language plpgsql security definer set search_path=public as $$
declare u uuid; v_opponent uuid; n integer; b numeric;
begin
 if p_host=p_guest or p_host is null or p_guest is null then raise exception 'Two distinct students required'; end if;
 if p_winner is not null and p_winner not in(p_host,p_guest) then raise exception 'Invalid winner'; end if;
 perform 1 from profiles where id in(p_host,p_guest) order by id for update;
 foreach u in array array[p_host,p_guest] loop
  if exists(select 1 from ps_reward_receipts where match_id=p_match and user_id=u) then continue; end if;
  v_opponent := case when u=p_host then p_guest else p_host end;
  n := case when p_winner is null then 150 when u=p_winner then 250 else 100 end;
  if (select count(*) from ps_reward_receipts where user_id=u and created_at>now()-interval '24 hours' and reward>0)>=6
   or exists(select 1 from ps_reward_receipts where user_id=u and created_at>now()-interval '2 minutes' and reward>0)
   or (select count(*) from ps_reward_receipts where user_id=u and opponent=v_opponent and created_at>now()-interval '24 hours' and reward>0)>=2
  then n := 0; end if;
  insert into ps_reward_receipts(match_id,user_id,reward,created_at,opponent) values(p_match,u,n,now(),v_opponent);
  if n>0 then
   update wallets set balance=balance+n,updated_at=now() where user_id=u returning balance into b;
   if not found then raise exception 'Wallet missing'; end if;
   insert into wallet_transactions(user_id,type,amount,balance_after,description,metadata) values(u,'ps_reward',n,b,'Game Den match reward',jsonb_build_object('match',p_match));
  end if;
 end loop;
end $$;
revoke all on function public.ps_reward_trusted(text,uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.ps_reward_trusted(text,uuid,uuid,uuid) to service_role;

-- ---------------------------------------------------------------------------------------------
-- 7. Hostel (Iya Ibeji) prices. Open debts keep the amount agreed when they were taken.
-- ---------------------------------------------------------------------------------------------
update public.hostel_catalog h set price=v.price from (values
 ('hostel_chair',200),('hostel_table',350),('hostel_bedsheet',250),('hostel_pillow',150),
 ('hostel_curtain',250),('hostel_fan_basic',600),('hostel_poster',150),('hostel_rug',350),
 ('hostel_tv_basic',900),('hostel_speaker',500),('hostel_ps_console',1500),('hostel_game_pad',300),
 ('hostel_lamp',350),('hostel_generator_small',1200),('hostel_gas_small_cylinder',700),('hostel_pot',250)
) v(id,price) where h.id=v.id;

-- ---------------------------------------------------------------------------------------------
-- 8. Timed vendors (Mai Suya, Indomie & Egg).
-- ---------------------------------------------------------------------------------------------
update public.food_vendor_items i set price=v.price from (values
 ('vendor_suya_beef',400),('vendor_suya_chicken',350),('vendor_indomie_plain',250),('vendor_indomie_egg',350)
) v(id,price) where i.id=v.id;

-- ---------------------------------------------------------------------------------------------
-- 9. Floral World + food court: one server menu. Previously Floral World prices were hard-coded
--    in process_wallet_purchase_pre007 (₦1,000–₦1,300 meals) and food-court items had no server
--    price at all, so the client's amount was charged. Unknown menu items are now refused.
-- ---------------------------------------------------------------------------------------------
create table public.campus_food_menu(
 id text primary key, vendor text not null check(vendor in('floral_world','food_court')),
 name text not null, price integer not null check(price>0), item_type text not null check(item_type in('food','drink'))
);
insert into public.campus_food_menu values
 ('fw_jollof_chicken','floral_world','Jollof Rice + Chicken',500,'food'),
 ('fw_fried_chicken','floral_world','Fried Rice + Chicken',500,'food'),
 ('fw_rice_beef','floral_world','Rice + Beef',450,'food'),
 ('fw_spaghetti','floral_world','Spaghetti Special',350,'food'),
 ('fw_water','floral_world','Chilled Bottled Water',50,'drink'),
 ('fw_malt','floral_world','Chilled Malt Drink',150,'drink'),
 ('jollof_chicken','food_court','Jollof Rice & Crispy Chicken',500,'food'),
 ('shawarma_beef','food_court','Campus Special Beef Shawarma',600,'food'),
 ('suya_spicy','food_court','FUNAAB Evening Beef Suya',400,'food'),
 ('cold_water','food_court','Chilled Bottle Water',50,'drink'),
 ('malt_drink','food_court','Chilled Malt Drink',150,'drink');
alter table public.campus_food_menu enable row level security;
revoke all on public.campus_food_menu from anon,authenticated;
grant select on public.campus_food_menu to anon,authenticated;
create policy campus_food_menu_read on public.campus_food_menu for select using(true);

create or replace function public.process_wallet_purchase(p_type text default 'food_purchase',p_amount numeric default null,p_description text default null,p_item_id text default null,p_item_name text default null,p_user_id uuid default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare u uuid := auth.uid(); m campus_food_menu; b numeric;
begin
 if u is null or (p_user_id is not null and p_user_id<>u) then raise exception 'Authentication required'; end if;
 if p_item_id like 'hostel_%' then raise exception 'Use Iya Ibeji checkout'; end if;
 if p_item_id like 'vendor_%' then raise exception 'Order this from the vendor stall'; end if;
 if p_item_id is not null then
  -- Price and name come only from the server menu; p_amount/p_item_name are ignored.
  select * into m from campus_food_menu where id=p_item_id;
  if not found then raise exception 'That item is not on any campus menu'; end if;
  perform ensure_player_wallet();
  select balance into b from wallets where user_id=u for update;
  if b < m.price then
   return jsonb_build_object('success',false,'error','Insufficient funds in student wallet','balance',b,'required',m.price);
  end if;
  b := b - m.price;
  update wallets set balance=b,updated_at=now() where user_id=u;
  insert into wallet_transactions(user_id,type,amount,balance_after,description,metadata)
   values(u,'food_purchase',-m.price,b,'Food: '||m.name,jsonb_build_object('item',m.id,'vendor',m.vendor));
  insert into inventory(user_id,item_id,item_name,item_type,quantity) values(u,m.id,m.name,m.item_type,1)
   on conflict(user_id,item_id) do update set quantity=inventory.quantity+1,updated_at=now();
  return jsonb_build_object('success',true,'balance',b,'item',m.id,'name',m.name,'price',m.price);
 end if;
 -- Item-less debits (lawn fine, legacy fare) keep the existing path; it can only debit, never credit.
 return process_wallet_purchase_pre007(p_type,p_amount,p_description,null,p_item_name,u);
end $$;
revoke all on function public.process_wallet_purchase(text,numeric,text,text,text,uuid) from public,anon;
grant execute on function public.process_wallet_purchase(text,numeric,text,text,text,uuid) to authenticated;

commit;


-- Restore the newer Game Den reward function from 015 (012 replaced it with the older one).
begin;
create or replace function public.ps_reward_trusted(p_match text,p_host uuid,p_guest uuid,p_winner uuid)
returns void language plpgsql security definer set search_path=public as $$
declare u uuid; v_opponent uuid; n integer; b numeric; v_outcome text;
begin
 if p_host=p_guest or p_host is null or p_guest is null then raise exception 'Two distinct students required'; end if;
 if p_winner is not null and p_winner not in(p_host,p_guest) then raise exception 'Invalid winner'; end if;
 perform 1 from profiles where id in(p_host,p_guest) order by id for update;
 foreach u in array array[p_host,p_guest] loop
  if exists(select 1 from ps_reward_receipts where match_id=p_match and user_id=u) then continue; end if;
  v_opponent := case when u=p_host then p_guest else p_host end;
  v_outcome := case when p_winner is null then 'draw' when u=p_winner then 'win' else 'loss' end;
  n := case v_outcome when 'draw' then 150 when 'win' then 250 else 100 end;
  if (select count(*) from ps_reward_receipts where user_id=u and created_at>now()-interval '24 hours' and reward>0)>=6
   or exists(select 1 from ps_reward_receipts where user_id=u and created_at>now()-interval '2 minutes' and reward>0)
   or (select count(*) from ps_reward_receipts where user_id=u and opponent=v_opponent and created_at>now()-interval '24 hours' and reward>0)>=2
  then n := 0; end if;
  insert into ps_reward_receipts(match_id,user_id,reward,created_at,opponent,outcome) values(p_match,u,n,now(),v_opponent,v_outcome);
  if n>0 then
   update wallets set balance=balance+n,updated_at=now() where user_id=u returning balance into b;
   if not found then raise exception 'Wallet missing'; end if;
   insert into wallet_transactions(user_id,type,amount,balance_after,description,metadata) values(u,'ps_reward',n,b,'Game Den match reward',jsonb_build_object('match',p_match));
  end if;
 end loop;
end $$;
revoke all on function public.ps_reward_trusted(text,uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.ps_reward_trusted(text,uuid,uuid,uuid) to service_role;
commit;

-- 027: COLENG food delivery is counted at the door. Apply once AFTER 026 (safe to re-run).
-- The drop-off was a point on the open forecourt 6 m from COLENG's door with a 5 m radius, so
-- students who walked up to the door never got a Deliver button. Jobs now have their own
-- drop-off radius; the COLENG delivery is centred just in front of the door with 7.5 m.
-- Mirrors src/config/campusJobs.ts (scripts/test-economy-db.ts checks drift). Reward unchanged.
begin;

alter table public.job_catalog add column if not exists dest_radius numeric not null default 5;
update public.job_catalog set dest_x=80, dest_z=-54, dest_radius=7.5 where id='job-food-delivery';

-- Same as 012, except the delivery check uses the job's own radius.
create or replace function public.job_action_trusted(p_user uuid,p_action text,p_job text default null,p_run uuid default null,p_x numeric default null,p_z numeric default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare j job_catalog; r job_runs; b numeric; v_bonus integer := 0;
 v_day_start timestamptz := date_trunc('day', now() at time zone 'Africa/Lagos') at time zone 'Africa/Lagos';
begin
 perform 1 from profiles where id=p_user for update;
 if not found then raise exception 'Profile missing'; end if;
 if p_action='accept' then
  select * into r from job_runs where user_id=p_user and status in('accepted','picked_up');
  if found then return to_jsonb(r); end if;
  select * into j from job_catalog where id=p_job;
  if not found then raise exception 'Unknown job'; end if;
  if (select count(*) from job_runs where user_id=p_user and completed_at>now()-interval '24 hours')>=12 then raise exception 'Daily shift limit reached'; end if;
  if exists(select 1 from job_runs where user_id=p_user and job_id=p_job and completed_at>now()-interval '5 minutes') then raise exception 'This job resets five minutes after completion'; end if;
  insert into job_runs(user_id,job_id) values(p_user,p_job) returning * into r;
 else
  select * into r from job_runs where id=p_run and user_id=p_user for update;
  if not found then raise exception 'Active job not found'; end if;
  select * into j from job_catalog where id=r.job_id;
  if r.status='completed' then return to_jsonb(r); end if;
  if p_action='cancel' and r.status in('accepted','picked_up') then
   update job_runs set status='cancelled' where id=r.id returning * into r;
  elsif p_action='pickup' then
   if r.status<>'accepted' then raise exception 'Order already collected'; end if;
   if p_x is null or p_z is null or sqrt(power(p_x-j.source_x,2)+power(p_z-j.source_z,2))>5 then raise exception 'Go to the pickup marker'; end if;
   if now()<r.accepted_at+interval '3 seconds' then raise exception 'Wait for the order to be ready'; end if;
   update job_runs set status='picked_up',pickup_at=now() where id=r.id returning * into r;
  elsif p_action='deliver' then
   if r.status<>'picked_up' or r.pickup_at is null then raise exception 'Collect the order first'; end if;
   if p_x is null or p_z is null or sqrt(power(p_x-j.dest_x,2)+power(p_z-j.dest_z,2))>j.dest_radius then raise exception 'Go to the correct destination'; end if;
   if now()<r.pickup_at+interval '15 seconds' then raise exception 'Complete the route or station check first (15 seconds minimum)'; end if;
   select balance into b from wallets where user_id=p_user for update;
   if b is null then raise exception 'Open your wallet first'; end if;
   -- Bonus only for the first completion of the Lagos day; this run is not completed yet, and the
   -- profile lock above serializes concurrent deliveries, so it cannot be paid twice.
   if not exists(select 1 from job_runs where user_id=p_user and status='completed' and completed_at>=v_day_start) then
    v_bonus := 200;
   end if;
   update wallets set balance=balance+j.reward,updated_at=now() where user_id=p_user returning balance into b;
   insert into wallet_transactions(user_id,type,amount,balance_after,description,metadata) values(p_user,'campus_job',j.reward,b,j.title,jsonb_build_object('job_run',r.id));
   if v_bonus > 0 then
    update wallets set balance=balance+v_bonus,updated_at=now() where user_id=p_user returning balance into b;
    insert into wallet_transactions(user_id,type,amount,balance_after,description,metadata) values(p_user,'campus_job_bonus',v_bonus,b,'First job of the day bonus',jsonb_build_object('job_run',r.id));
   end if;
   update job_runs set status='completed',completed_at=now(),reward_claimed=true where id=r.id returning * into r;
   return to_jsonb(r) || jsonb_build_object('paid',j.reward,'bonus',v_bonus);
  else raise exception 'Invalid job action'; end if;
 end if;
 return to_jsonb(r);
end $$;
revoke all on function public.job_action_trusted(uuid,text,text,uuid,numeric,numeric) from public,anon,authenticated;
grant execute on function public.job_action_trusted(uuid,text,text,uuid,numeric,numeric) to service_role;

commit;


-- 038: Daily allowance is ₦500, once per 20 hours. Apply once AFTER 037 (safe to re-run).
-- Mirrors ECONOMY_CONFIG.DAILY_RESUMPTION_ALLOWANCE in src/config/economy.ts. Existing balances
-- and ledger rows are not touched.
begin;

create or replace function public.claim_daily_reward(p_user_id uuid default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare u uuid := auth.uid(); v_reward constant numeric := 500.00; v_last timestamptz; b numeric;
begin
 if u is null then return jsonb_build_object('success',false,'error','Unauthorized: User not authenticated'); end if;
 perform ensure_player_wallet();
 -- Row lock serializes concurrent claims: the second one sees the new timestamp.
 select balance,last_daily_reward_at into b,v_last from wallets where user_id=u for update;
 if v_last is not null and now()-v_last < interval '20 hours' then
  return jsonb_build_object('success',false,'error','Daily reward already claimed today. Please check back tomorrow!');
 end if;
 update wallets set balance=balance+v_reward,last_daily_reward_at=now(),updated_at=now()
  where user_id=u returning balance into b;
 insert into wallet_transactions(user_id,type,amount,balance_after,description)
  values(u,'daily_reward',v_reward,b,'Daily Campus Student Stipend');
 return jsonb_build_object('success',true,'reward',v_reward,'balance',b);
end $$;

revoke all on function public.claim_daily_reward(uuid) from public, anon;
grant execute on function public.claim_daily_reward(uuid) to authenticated, service_role;

commit;

notify pgrst, 'reload schema';
