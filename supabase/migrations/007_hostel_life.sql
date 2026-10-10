-- 007: Off-campus life and trusted persistent jobs. Apply once AFTER 006.
-- Existing identities, balances, friends, avatars and inventory rows are not rewritten.
begin;
create table public.hostel_catalog(id text primary key, name text not null, category text not null,
 price integer not null check(price>0), placement_type text not null, credit boolean not null default false,
 consumable boolean not null default false);
insert into public.hostel_catalog values
('hostel_chair','Plastic Chair','Room',150,'floor',false,false),
('hostel_table','Small Table','Room',250,'floor',false,false),
('hostel_bedsheet','Bedsheet','Room',200,'bed',false,false),
('hostel_pillow','Pillow','Room',100,'bed',false,false),
('hostel_curtain','Curtain','Room',200,'wall',false,false),
('hostel_fan_basic','Standing Fan','Room',350,'floor',false,false),
('hostel_poster','Wall Poster','Room',100,'wall',false,false),
('hostel_rug','Small Rug','Room',250,'floor',false,false),
('hostel_tv_basic','TV','Entertainment',500,'floor',true,false),
('hostel_speaker','Small Speaker','Entertainment',300,'desk',true,false),
('hostel_ps_console','PS Console','Entertainment',800,'desk',true,false),
('hostel_game_pad','Game Pad','Entertainment',200,'desk',true,false),
('hostel_lamp','Rechargeable Lamp','Power',250,'desk',false,false),
('hostel_generator_small','Generator','Power',700,'floor',true,false),
('hostel_fuel_can','Fuel Can','Power',150,'none',false,false),
('hostel_food_garri','Garri','Foodstuff',100,'none',false,true),
('hostel_food_indomie','Indomie','Foodstuff',80,'none',false,true),
('hostel_food_bread','Bread','Foodstuff',100,'none',false,true),
('hostel_food_eggs','Eggs','Foodstuff',120,'none',false,true),
('hostel_food_rice','Rice','Foodstuff',200,'none',false,true),
('hostel_food_spaghetti','Spaghetti','Foodstuff',150,'none',false,true),
('hostel_food_water','Water','Foodstuff',50,'none',false,true),
('hostel_gas_small_cylinder','Small Gas Cylinder','Basics',500,'floor',false,false),
('hostel_gas_refill','Gas Refill','Basics',150,'none',false,false),
('hostel_pot','Pot','Basics',150,'desk',false,false),
('hostel_plate','Plate','Basics',50,'desk',false,false);
create table public.hostel_rooms(owner_id uuid primary key references public.profiles(id) on delete cascade,
 privacy text not null default 'invite' check(privacy in ('private','friends','invite')),
 style text not null default 'resumption', tv_on boolean not null default false,
 rested_at timestamptz, visited_at timestamptz, security_at timestamptz);
insert into public.hostel_rooms(owner_id) select id from public.profiles;
create table public.hostel_invites(owner_id uuid references public.hostel_rooms(owner_id) on delete cascade,
 guest_id uuid references public.profiles(id) on delete cascade, status text not null default 'pending'
 check(status in ('pending','accepted','declined')), expires_at timestamptz not null default now()+interval '2 hours',
 primary key(owner_id,guest_id), check(owner_id<>guest_id));
create table public.room_placements(owner_id uuid references public.hostel_rooms(owner_id) on delete cascade,
 item_id text references public.hostel_catalog(id), anchor text not null,
 rotation integer not null default 0 check(rotation in(0,90,180,270)), primary key(owner_id,item_id), unique(owner_id,anchor));
create table public.game_debts(id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id),
 item_id text not null references public.hostel_catalog(id), amount integer not null check(amount>0),
 created_at timestamptz not null default now(), due_at timestamptz not null default now()+interval '48 hours', paid_at timestamptz);
create unique index one_open_item_debt on public.game_debts(user_id,item_id) where paid_at is null;
create table public.hostel_receipts(user_id uuid references public.profiles(id), request_id uuid not null,
 operation text not null, result jsonb not null, primary key(user_id,request_id));

create function public.hostel_can_enter(p_owner uuid,p_guest uuid) returns boolean
language sql stable security definer set search_path=public as $$
 select p_guest is not null and exists(select 1 from hostel_rooms r where r.owner_id=p_owner and
 (r.owner_id=p_guest or (r.privacy<>'private' and
 not exists(select 1 from blocks where (user_id=p_owner and blocked_user_id=p_guest) or (user_id=p_guest and blocked_user_id=p_owner)) and
 ((r.privacy='friends' and exists(select 1 from friends where status='accepted' and
 ((user_id=p_owner and friend_id=p_guest) or (user_id=p_guest and friend_id=p_owner)))) or
 exists(select 1 from hostel_invites where owner_id=p_owner and guest_id=p_guest and status='accepted' and expires_at>now())))))
$$;
create function public.hostel_snapshot(p_owner uuid) returns jsonb language plpgsql security definer set search_path=public as $$
begin
 if not hostel_can_enter(p_owner,auth.uid()) then raise exception 'Room is private or invite expired'; end if;
 return jsonb_build_object('room',(select to_jsonb(r) from hostel_rooms r where owner_id=p_owner),
 'placements',coalesce((select jsonb_agg(p) from room_placements p where owner_id=p_owner),'[]'),
 'owner_name',(select username from profiles where id=p_owner));
end $$;

create function public.hostel_command(p_action text,p_data jsonb default '{}',p_request uuid default gen_random_uuid())
returns jsonb language plpgsql security definer set search_path=public as $$
declare u uuid:=auth.uid(); c hostel_catalog; b numeric; d game_debts; result jsonb; a text; t text; o uuid; n integer;
begin
 if u is null then raise exception 'Authentication required'; end if;
 -- One lock order for every command: profile, room, wallet. Serializes tabs and retries.
 perform 1 from profiles where id=u for update;
 select r.result into result from hostel_receipts r where user_id=u and request_id=p_request;
 if found then return result; end if;
 insert into hostel_rooms(owner_id) values(u) on conflict do nothing;
 if p_action='ensure' then
   update hostel_rooms set visited_at=coalesce(visited_at,now()) where owner_id=u;
 elsif p_action='purchase' then
   select * into c from hostel_catalog where id=p_data->>'item';
   if not found then raise exception 'Unknown item'; end if;
   if not c.consumable and exists(select 1 from inventory where user_id=u and item_id=c.id) then raise exception 'You already own this item'; end if;
   select balance into b from wallets where user_id=u for update;
   if not found then raise exception 'Open your wallet first'; end if;
   if coalesce((p_data->>'credit')::boolean,false) then
     if not c.credit then raise exception 'This item is pay-now only'; end if;
     n:=ceil(c.price*1.1);
     if exists(select 1 from game_debts where user_id=u and paid_at is null and due_at<now()) then raise exception 'Pay overdue game debt before borrowing again'; end if;
     if n+coalesce((select sum(amount) from game_debts where user_id=u and paid_at is null),0)>1500 then raise exception 'Game credit limit is ₦1,500'; end if;
     insert into game_debts(user_id,item_id,amount) values(u,c.id,n);
     insert into wallet_transactions(user_id,type,amount,balance_after,description) values(u,'hostel_credit',0,b,'Iya Ibeji credit: '||c.name||' — debt ₦'||n);
   else
     if b<c.price then raise exception 'Insufficient funds'; end if;
     update wallets set balance=balance-c.price,updated_at=now() where user_id=u returning balance into b;
     insert into wallet_transactions(user_id,type,amount,balance_after,description) values(u,'hostel_purchase',-c.price,b,'Iya Ibeji: '||c.name);
   end if;
   insert into inventory(user_id,item_id,item_name,item_type,quantity) values(u,c.id,c.name,'hostel',1)
    on conflict(user_id,item_id) do update set quantity=inventory.quantity+1,updated_at=now();
 elsif p_action='pay' then
   select * into d from game_debts where id=(p_data->>'debt')::uuid and user_id=u for update;
   if not found then raise exception 'Debt not found'; end if;
   if d.paid_at is null then
     select balance into b from wallets where user_id=u for update;
     if b is null or b<d.amount then raise exception 'Insufficient funds; campus jobs are available'; end if;
     update wallets set balance=balance-d.amount,updated_at=now() where user_id=u returning balance into b;
     update game_debts set paid_at=now() where id=d.id;
     insert into wallet_transactions(user_id,type,amount,balance_after,description) values(u,'hostel_debt',-d.amount,b,'Paid Iya Ibeji game debt');
   end if;
 elsif p_action='place' then
   select * into c from hostel_catalog where id=p_data->>'item';
   if not found or not exists(select 1 from inventory where user_id=u and item_id=c.id and quantity>0) then raise exception 'Item is not owned'; end if;
   a:=p_data->>'anchor';
   if c.id='hostel_table' and exists(select 1 from room_placements where owner_id=u and anchor like 'desk-%') and a is distinct from 'floor-b' then raise exception 'Return desk items to inventory before moving the table'; end if;
   if a is null then delete from room_placements where owner_id=u and item_id=c.id;
   else
     t:=split_part(a,'-',1);
     if a not in('floor-a','floor-b','floor-c','floor-d','wall-a','wall-b','desk-a','desk-b','bed-a','bed-b') or t<>c.placement_type then raise exception 'Invalid placement anchor'; end if;
     if t='desk' and not exists(select 1 from room_placements where owner_id=u and item_id='hostel_table' and anchor='floor-b') then raise exception 'Place a Small Table at floor-b first'; end if;
     if t='wall' and coalesce((p_data->>'rotation')::integer,0)<>0 then raise exception 'Wall items face into the room'; end if;
     insert into room_placements(owner_id,item_id,anchor,rotation) values(u,c.id,a,coalesce((p_data->>'rotation')::integer,0))
      on conflict(owner_id,item_id) do update set anchor=excluded.anchor,rotation=excluded.rotation;
   end if;
 elsif p_action='privacy' then
   update hostel_rooms set privacy=p_data->>'privacy' where owner_id=u;
 elsif p_action='invite' then
   o:=(p_data->>'guest')::uuid;
   if not exists(select 1 from friends where status='accepted' and ((user_id=u and friend_id=o) or (friend_id=u and user_id=o))) then raise exception 'Invite an accepted friend'; end if;
   if exists(select 1 from blocks where (user_id=u and blocked_user_id=o) or (user_id=o and blocked_user_id=u)) then raise exception 'Invite unavailable'; end if;
   insert into hostel_invites(owner_id,guest_id,status,expires_at) values(u,o,'pending',now()+interval '2 hours')
    on conflict(owner_id,guest_id) do update set status='pending',expires_at=excluded.expires_at;
 elsif p_action='respond' then
   update hostel_invites set status=case when (p_data->>'accept')::boolean then 'accepted' else 'declined' end
    where owner_id=(p_data->>'owner')::uuid and guest_id=u and expires_at>now();
   if not found then raise exception 'Invite expired'; end if;
 elsif p_action='revoke' then
   delete from hostel_invites where owner_id=u and guest_id=(p_data->>'guest')::uuid;
 elsif p_action='tv' then
   if not exists(select 1 from room_placements where owner_id=u and item_id='hostel_tv_basic') then raise exception 'Place your TV first'; end if;
   update hostel_rooms set tv_on=not tv_on where owner_id=u;
 elsif p_action='sleep' then
   update hostel_rooms set rested_at=now() where owner_id=u;
 elsif p_action='consume' then
   select * into c from hostel_catalog where id=p_data->>'item' and consumable;
   if not found then raise exception 'Not a snack'; end if;
   select quantity into n from inventory where user_id=u and item_id=c.id for update;
   if n is null then raise exception 'Item not owned'; end if;
   if n=1 then delete from inventory where user_id=u and item_id=c.id;
   else update inventory set quantity=quantity-1 where user_id=u and item_id=c.id; end if;
 elsif p_action='security' then
   if not exists(select 1 from game_debts where user_id=u and paid_at is null and due_at+interval '24 hours'<now()) then raise exception 'No overdue visit'; end if;
   update hostel_rooms set security_at=now() where owner_id=u;
 else raise exception 'Unknown hostel action'; end if;
 result:=jsonb_build_object('success',true);
 insert into hostel_receipts values(u,p_request,p_action,result);
 return result;
end $$;

-- Restrict direct writes; the existing inventory is reused, not duplicated.
revoke insert,update,delete on public.inventory from anon,authenticated;
-- Prevent the legacy food RPC from minting the new reserved hostel catalogue for free.
alter function public.process_wallet_purchase(text,numeric,text,text,text,uuid) rename to process_wallet_purchase_pre007;
revoke all on function public.process_wallet_purchase_pre007(text,numeric,text,text,text,uuid) from public,anon,authenticated;
create function public.process_wallet_purchase(p_type text default 'food_purchase',p_amount numeric default null,p_description text default null,p_item_id text default null,p_item_name text default null,p_user_id uuid default null)
returns jsonb language plpgsql security definer set search_path=public as $$
begin
 if auth.uid() is null or (p_user_id is not null and p_user_id<>auth.uid()) then raise exception 'Authentication required'; end if;
 if p_item_id like 'hostel_%' then raise exception 'Use Iya Ibeji checkout'; end if;
 return process_wallet_purchase_pre007(p_type,p_amount,p_description,p_item_id,p_item_name,auth.uid());
end $$;

create table public.job_catalog(id text primary key,title text not null,reward integer not null check(reward between 100 and 300),
 source_x numeric,source_z numeric,dest_x numeric,dest_z numeric);
insert into job_catalog values
 ('job-food-delivery','Floral World food delivery',250,-28,-26,-18,-53),
 ('job-medical-errand','Health Centre dispatch',200,-20,-10,0,-31),
 ('job-sports-cones','Sports Centre pitch check',175,-36,2,-50,12),
 ('job-game-den','Game Den controller shift',200,36,-1,42,-1);
create table public.job_runs(id uuid primary key default gen_random_uuid(),user_id uuid not null references profiles(id),
 job_id text not null references job_catalog(id),status text not null default 'accepted' check(status in('accepted','picked_up','completed','cancelled')),
 accepted_at timestamptz not null default now(),pickup_at timestamptz,completed_at timestamptz,reward_claimed boolean not null default false);
create unique index one_active_job on job_runs(user_id) where status in('accepted','picked_up');
create index job_run_history on job_runs(user_id,completed_at desc);
create function public.job_action_trusted(p_user uuid,p_action text,p_job text default null,p_run uuid default null,p_x numeric default null,p_z numeric default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare j job_catalog; r job_runs; b numeric;
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
   update wallets set balance=balance+j.reward,updated_at=now() where user_id=p_user returning balance into b;
   insert into wallet_transactions(user_id,type,amount,balance_after,description,metadata) values(p_user,'campus_job',j.reward,b,j.title,jsonb_build_object('job_run',r.id));
   update job_runs set status='completed',completed_at=now(),reward_claimed=true where id=r.id returning * into r;
  else raise exception 'Invalid job action'; end if;
 end if;
 return to_jsonb(r);
end $$;
-- Retire the client-priced reward endpoint; grants change here, never in old migrations.

do $$ declare r record; begin
 for r in select oid::regprocedure as sig from pg_proc where pronamespace='public'::regnamespace and proname='claim_job_reward' loop
 execute format('revoke all on function %s from public,anon,authenticated',r.sig);
 end loop;
end $$;
create table public.ps_reward_receipts(match_id text,user_id uuid references profiles(id),reward integer not null,
 created_at timestamptz not null default now(),primary key(match_id,user_id));
create function public.ps_reward_trusted(p_match text,p_host uuid,p_guest uuid,p_winner uuid)
returns void language plpgsql security definer set search_path=public as $$
declare u uuid; n integer; b numeric;
begin
 if p_host=p_guest or p_host is null or p_guest is null then raise exception 'Two distinct students required'; end if;
 if p_winner is not null and p_winner not in(p_host,p_guest) then raise exception 'Invalid winner'; end if;
 perform 1 from profiles where id in(p_host,p_guest) order by id for update;
 foreach u in array array[p_host,p_guest] loop
  if exists(select 1 from ps_reward_receipts where match_id=p_match and user_id=u) then continue; end if;
  n:=case when p_winner is null then 80 when u=p_winner then 120 else 40 end;
  if (select count(*) from ps_reward_receipts where user_id=u and created_at>now()-interval '24 hours' and reward>0)>=6
   or exists(select 1 from ps_reward_receipts where user_id=u and created_at>now()-interval '2 minutes' and reward>0) then n:=0; end if;
  insert into ps_reward_receipts values(p_match,u,n,now());
  if n>0 then
   update wallets set balance=balance+n,updated_at=now() where user_id=u returning balance into b;
   if not found then raise exception 'Wallet missing'; end if;
   insert into wallet_transactions(user_id,type,amount,balance_after,description,metadata) values(u,'ps_reward',n,b,'Game Den fixed match reward',jsonb_build_object('match',p_match));
  end if;
 end loop;
end $$;

create function public.create_student_room() returns trigger language plpgsql security definer set search_path=public as $$
begin insert into hostel_rooms(owner_id) values(new.id) on conflict do nothing; return new; end $$;
create trigger student_room_after_profile after insert on profiles for each row execute function create_student_room();

alter table hostel_catalog enable row level security;
alter table hostel_rooms enable row level security;
alter table hostel_invites enable row level security;
alter table room_placements enable row level security;
alter table game_debts enable row level security;
alter table hostel_receipts enable row level security;
alter table job_catalog enable row level security;
alter table job_runs enable row level security;
alter table ps_reward_receipts enable row level security;
revoke all on hostel_catalog,hostel_rooms,hostel_invites,room_placements,game_debts,hostel_receipts,job_catalog,job_runs,ps_reward_receipts from anon,authenticated;
grant select on hostel_catalog,hostel_rooms,hostel_invites,room_placements,game_debts,job_catalog,job_runs,ps_reward_receipts to authenticated;
create policy hostel_catalog_read on hostel_catalog for select to authenticated using(true);
create policy hostel_room_owner on hostel_rooms for select to authenticated using(owner_id=auth.uid());
create policy hostel_placement_owner on room_placements for select to authenticated using(owner_id=auth.uid());
create policy hostel_invite_parties on hostel_invites for select to authenticated using(owner_id=auth.uid() or guest_id=auth.uid());
create policy debt_owner on game_debts for select to authenticated using(user_id=auth.uid());
create policy job_catalog_read on job_catalog for select to authenticated using(true);
create policy job_run_owner on job_runs for select to authenticated using(user_id=auth.uid());
create policy ps_reward_owner on ps_reward_receipts for select to authenticated using(user_id=auth.uid());
revoke all on function hostel_can_enter(uuid,uuid),hostel_snapshot(uuid),hostel_command(text,jsonb,uuid),job_action_trusted(uuid,text,text,uuid,numeric,numeric),ps_reward_trusted(text,uuid,uuid,uuid),create_student_room(),process_wallet_purchase(text,numeric,text,text,text,uuid) from public,anon,authenticated;
grant execute on function hostel_snapshot(uuid),hostel_command(text,jsonb,uuid),process_wallet_purchase(text,numeric,text,text,text,uuid) to authenticated;
grant execute on function hostel_can_enter(uuid,uuid),job_action_trusted(uuid,text,text,uuid,numeric,numeric),ps_reward_trusted(text,uuid,uuid,uuid) to service_role;
-- Disable obsolete purchase overloads that could bypass the reserved item guard.
do $$ declare r record; begin
 for r in select oid::regprocedure as sig from pg_proc where pronamespace='public'::regnamespace and proname='process_wallet_purchase'
 and oid <> 'public.process_wallet_purchase(text,numeric,text,text,text,uuid)'::regprocedure loop
 execute format('revoke all on function %s from public,anon,authenticated',r.sig);
 end loop;
end $$;
commit;
