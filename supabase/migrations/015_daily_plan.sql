-- 015 Today's Plan: three daily goals per student, a daily streak and streak badges.
-- Additive only. Goal values mirror src/config/dailyPlan.ts (scripts/test-daily-plan-db.ts checks drift).
-- Goals are proven server-side: 'db' goals from existing ledgers, 'worker' goals from counts the
-- multiplayer Worker reports (service role) from trusted positions and actions. Clients never
-- report progress or amounts; they can only ask to claim a goal that the server already sees done.

create table public.daily_goal_catalog(
 id text primary key, title text not null, icon text not null,
 source text not null check(source in('db','worker')),
 target integer not null check(target between 1 and 10),
 reward integer not null check(reward between 0 and 300),
 active boolean not null default true
);
insert into public.daily_goal_catalog(id,title,icon,source,target,reward) values
 ('attend_lecture','Attend a lecture','🎓','db',1,100),
 ('finish_job','Finish a campus job','💼','db',1,100),
 ('buy_food','Buy something to eat','🍲','db',1,100),
 ('ride_keke','Ride a Keke','🛺','db',1,100),
 ('game_den_match','Play a Game Den match','🎮','db',1,100),
 ('take_penalties','Take 3 penalties at the Sports Centre','⚽','worker',3,100),
 ('visit_love_garden','Visit the Love Garden','🌳','worker',1,100),
 ('garden_hangout','Sit in the Love Garden with another student','🪑','worker',1,100),
 ('visit_friend_room','Visit a friend''s hostel room','🚪','worker',1,100),
 ('campus_night','Show up for Campus Night (8–9pm, Love Garden)','🌙','worker',1,100);

create table public.daily_goal_events(
 user_id uuid not null references public.profiles(id) on delete cascade,
 day date not null, kind text not null references public.daily_goal_catalog(id),
 count integer not null default 0 check(count between 0 and 20),
 updated_at timestamptz not null default now(),
 primary key(user_id,day,kind)
);
create table public.daily_goal_claims(
 user_id uuid not null references public.profiles(id) on delete cascade,
 day date not null, goal_id text not null references public.daily_goal_catalog(id),
 reward integer not null, created_at timestamptz not null default now(),
 primary key(user_id,day,goal_id)
);
create table public.daily_streaks(
 user_id uuid primary key references public.profiles(id) on delete cascade,
 current integer not null default 0, best integer not null default 0,
 last_day date, badges text[] not null default '{}'
);

alter table public.daily_goal_catalog enable row level security;
alter table public.daily_goal_events enable row level security;
alter table public.daily_goal_claims enable row level security;
alter table public.daily_streaks enable row level security;
revoke all on public.daily_goal_catalog,public.daily_goal_events,public.daily_goal_claims,public.daily_streaks from anon,authenticated;
grant select on public.daily_goal_catalog to anon,authenticated;
grant select on public.daily_goal_claims,public.daily_streaks to authenticated;
create policy daily_goal_catalog_read on public.daily_goal_catalog for select using(true);
create policy daily_goal_claims_own on public.daily_goal_claims for select using(user_id=auth.uid());
create policy daily_streaks_own on public.daily_streaks for select using(user_id=auth.uid());

create or replace function public.lagos_today() returns date language sql stable as $$
 select (now() at time zone 'Africa/Lagos')::date $$;

-- Deterministic: the same student sees the same three goals all day, a fresh set tomorrow.
create or replace function public.daily_goal_ids(p_user uuid,p_day date) returns text[]
language sql stable security definer set search_path=public as $$
 select coalesce(array_agg(id),'{}') from (
  select id from daily_goal_catalog where active order by md5(p_user::text||':'||p_day::text||':'||id) limit 3
 ) g $$;

create or replace function public.daily_goal_progress(p_user uuid,p_day date,p_goal text) returns integer
language plpgsql stable security definer set search_path=public as $$
declare v_from timestamptz := p_day::timestamp at time zone 'Africa/Lagos';
 v_to timestamptz := (p_day+1)::timestamp at time zone 'Africa/Lagos'; n integer;
begin
 case p_goal
  when 'attend_lecture' then select count(*) into n from lecture_attendance where user_id=p_user and created_at>=v_from and created_at<v_to;
  when 'finish_job' then select count(*) into n from job_runs where user_id=p_user and status='completed' and completed_at>=v_from and completed_at<v_to;
  when 'buy_food' then select count(*) into n from wallet_transactions where user_id=p_user and type='food_purchase' and created_at>=v_from and created_at<v_to;
  when 'ride_keke' then select count(*) into n from keke_tickets where user_id=p_user and status='completed' and created_at>=v_from and created_at<v_to;
  when 'game_den_match' then select count(*) into n from ps_reward_receipts where user_id=p_user and created_at>=v_from and created_at<v_to;
  else select coalesce(max(count),0) into n from daily_goal_events where user_id=p_user and day=p_day and kind=p_goal;
 end case;
 return coalesce(n,0);
end $$;

create or replace function public.daily_plan_for(p_user uuid) returns jsonb
language plpgsql stable security definer set search_path=public as $$
declare v_day date := lagos_today(); v_ids text[] := daily_goal_ids(p_user,lagos_today()); s daily_streaks;
 v_goals jsonb;
begin
 select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'title',c.title,'icon',c.icon,'target',c.target,'reward',c.reward,
   'progress',least(c.target,daily_goal_progress(p_user,v_day,c.id)),
   'claimed',exists(select 1 from daily_goal_claims k where k.user_id=p_user and k.day=v_day and k.goal_id=c.id))
   order by array_position(v_ids,c.id)),'[]') into v_goals
 from daily_goal_catalog c where c.id=any(v_ids);
 select * into s from daily_streaks where user_id=p_user;
 -- A streak survives until the end of the day after its last completed day.
 return jsonb_build_object('day',v_day,'goals',v_goals,'all_done_bonus',150,
  'streak',jsonb_build_object(
    'current',case when s.last_day is not null and s.last_day>=v_day-1 then s.current else 0 end,
    'best',coalesce(s.best,0),'badges',coalesce(to_jsonb(s.badges),'[]'::jsonb),'done_today',s.last_day=v_day));
end $$;

create or replace function public.daily_plan() returns jsonb
language plpgsql stable security definer set search_path=public as $$
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 return daily_plan_for(auth.uid());
end $$;

create or replace function public.claim_daily_goal(p_goal text) returns jsonb
language plpgsql security definer set search_path=public as $$
declare u uuid := auth.uid(); v_day date := lagos_today(); c daily_goal_catalog; b numeric; s daily_streaks;
 v_bonus integer := 0; v_badge text;
begin
 if u is null then raise exception 'Authentication required'; end if;
 perform 1 from profiles where id=u for update; -- serialize claims per student
 select * into c from daily_goal_catalog where id=p_goal and active;
 if not found or not (p_goal=any(daily_goal_ids(u,v_day))) then raise exception 'That goal is not on today''s plan'; end if;
 if exists(select 1 from daily_goal_claims where user_id=u and day=v_day and goal_id=p_goal) then raise exception 'Already claimed'; end if;
 if daily_goal_progress(u,v_day,p_goal) < c.target then raise exception 'Not done yet'; end if;
 perform ensure_player_wallet(u);
 insert into daily_goal_claims(user_id,day,goal_id,reward) values(u,v_day,p_goal,c.reward);
 update wallets set balance=balance+c.reward,updated_at=now() where user_id=u returning balance into b;
 insert into wallet_transactions(user_id,type,amount,balance_after,description,metadata)
  values(u,'daily_goal',c.reward,b,'Today''s Plan: '||c.title,jsonb_build_object('goal',p_goal,'day',v_day));
 -- All of today's goals claimed: bonus + streak.
 if (select count(*) from daily_goal_claims where user_id=u and day=v_day)>=cardinality(daily_goal_ids(u,v_day)) then
  v_bonus := 150;
  update wallets set balance=balance+v_bonus,updated_at=now() where user_id=u returning balance into b;
  insert into wallet_transactions(user_id,type,amount,balance_after,description,metadata)
   values(u,'daily_plan_bonus',v_bonus,b,'Today''s Plan complete',jsonb_build_object('day',v_day));
  insert into daily_streaks(user_id) values(u) on conflict do nothing;
  select * into s from daily_streaks where user_id=u for update;
  if s.last_day is distinct from v_day then
   s.current := case when s.last_day=v_day-1 then s.current+1 else 1 end;
   s.best := greatest(s.best,s.current);
   foreach v_badge in array array['streak_3','streak_7','streak_30'] loop
    if s.current>=split_part(v_badge,'_',2)::int and not v_badge=any(s.badges) then s.badges := s.badges||v_badge; end if;
   end loop;
   update daily_streaks set current=s.current,best=s.best,last_day=v_day,badges=s.badges where user_id=u;
  end if;
 end if;
 return daily_plan_for(u)||jsonb_build_object('balance',b,'paid',c.reward+v_bonus);
end $$;

-- Worker-only progress for goals that need trusted world state.
create or replace function public.daily_goal_event_trusted(p_user uuid,p_kind text,p_amount integer default 1) returns integer
language plpgsql security definer set search_path=public as $$
declare v_day date := lagos_today(); n integer;
begin
 if p_amount is null or p_amount<1 or p_amount>5 then raise exception 'Invalid amount'; end if;
 if not exists(select 1 from daily_goal_catalog where id=p_kind and source='worker') then raise exception 'Unknown goal event'; end if;
 insert into daily_goal_events(user_id,day,kind,count) values(p_user,v_day,p_kind,least(20,p_amount))
  on conflict(user_id,day,kind) do update set count=least(20,daily_goal_events.count+p_amount),updated_at=now()
  returning count into n;
 return n;
end $$;

revoke all on function public.daily_goal_ids(uuid,date),public.daily_goal_progress(uuid,date,text),public.daily_plan_for(uuid),
 public.daily_goal_event_trusted(uuid,text,integer) from public,anon,authenticated;
grant execute on function public.daily_goal_event_trusted(uuid,text,integer) to service_role;
revoke all on function public.daily_plan(),public.claim_daily_goal(text) from public,anon;
grant execute on function public.daily_plan(),public.claim_daily_goal(text) to authenticated;
