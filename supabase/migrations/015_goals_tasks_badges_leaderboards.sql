-- 015: Goals. Daily tasks with an all-three bonus and streaks, badges, and weekly leaderboards.
-- Apply once AFTER 014. Game Naira only.
--
-- Nothing here trusts the client about progress: every task and badge is counted from records the
-- server already writes (wallet ledger, job runs, lecture attendance, Keke tickets, Game Den
-- receipts, friends). The one exception is college visits, which only unlock a badge (no money).
-- Task rewards are paid once per task per Africa/Lagos day: the primary key makes a second claim
-- impossible, and the profile row lock serializes concurrent claims.
-- Amounts mirror src/config/goals.ts; scripts/test-goals-db.cjs replays every migration.
begin;

-- ---------------------------------------------------------------------------------------------
-- 1. Game Den results, so wins can be counted. Older receipts are inferred from the fixed reward
--    they paid (012: 250/100/150, 007: 120/40/80); unpaid older receipts stay unknown.
-- ---------------------------------------------------------------------------------------------
alter table public.ps_reward_receipts add column if not exists outcome text
 check (outcome in ('win','loss','draw'));
update public.ps_reward_receipts set outcome = case
  when reward in (250,120) then 'win' when reward in (100,40) then 'loss' when reward in (150,80) then 'draw' end
 where outcome is null;
create index if not exists ps_reward_outcome on public.ps_reward_receipts(outcome, created_at desc);

-- Same rules as 012; now also records each player's outcome (even when the daily cap pays ₦0).
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

-- Weekly leaderboards scan by time.
create index if not exists wallet_tx_created on public.wallet_transactions(created_at);
create index if not exists lecture_attendance_created on public.lecture_attendance(created_at);

-- ---------------------------------------------------------------------------------------------
-- 2. Daily tasks. Each student gets 3 tasks a Lagos day, picked deterministically from the pool.
-- ---------------------------------------------------------------------------------------------
create table public.daily_task_catalog(
 id text primary key,
 title text not null,
 target integer not null check (target between 1 and 10),
 reward integer not null check (reward between 0 and 500)
);
insert into public.daily_task_catalog values
 ('allowance','Claim your daily allowance',1,50),
 ('job','Finish a campus job',1,50),
 ('two_jobs','Finish 2 campus jobs',2,50),
 ('lecture','Attend a lecture',1,50),
 ('keke','Take a keke ride',1,50),
 ('game_den','Play a Game Den match',1,50),
 ('food','Buy something to eat',1,50);
alter table public.daily_task_catalog enable row level security;
create policy "Anyone signed in can read tasks" on public.daily_task_catalog for select to authenticated using (true);
grant select on public.daily_task_catalog to authenticated;

create table public.daily_task_claims(
 user_id uuid not null references public.profiles(id) on delete cascade,
 day date not null,
 task text not null, -- a catalog id, or 'bonus' for the all-three bonus
 reward integer not null check (reward >= 0),
 streak integer,
 created_at timestamptz not null default now(),
 primary key (user_id, day, task)
);
alter table public.daily_task_claims enable row level security;
create policy "Read own task claims" on public.daily_task_claims for select to authenticated using (auth.uid() = user_id);
grant select on public.daily_task_claims to authenticated;

create function public.goals_today() returns date language sql stable as $$
 select (now() at time zone 'Africa/Lagos')::date $$;

/** Today's three task ids for a student. */
create function public.daily_tasks_for(p_user uuid, p_day date) returns setof text
language sql stable security definer set search_path=public as $$
 select id from daily_task_catalog order by md5(p_user::text || p_day::text || id) limit 3 $$;

/** How far a student got on a task during one Lagos day, counted from server records. */
create function public.daily_task_count(p_user uuid, p_task text, p_day date) returns integer
language plpgsql stable security definer set search_path=public as $$
declare s timestamptz := p_day::timestamp at time zone 'Africa/Lagos';
 e timestamptz := (p_day + 1)::timestamp at time zone 'Africa/Lagos'; n bigint := 0;
begin
 if p_task = 'allowance' then
  select count(*) into n from wallet_transactions where user_id=p_user and type='daily_reward' and created_at>=s and created_at<e;
 elsif p_task in ('job','two_jobs') then
  select count(*) into n from job_runs where user_id=p_user and status='completed' and completed_at>=s and completed_at<e;
 elsif p_task = 'lecture' then
  select count(*) into n from lecture_attendance where user_id=p_user and created_at>=s and created_at<e;
 elsif p_task = 'keke' then
  select count(*) into n from keke_tickets where user_id=p_user and status='completed' and created_at>=s and created_at<e;
 elsif p_task = 'game_den' then
  select count(*) into n from ps_reward_receipts where user_id=p_user and created_at>=s and created_at<e;
 elsif p_task = 'food' then
  select count(*) into n from wallet_transactions where user_id=p_user and type='food_purchase' and created_at>=s and created_at<e;
 end if;
 return n;
end $$;

/** Consecutive days, ending on p_through, on which the student claimed the all-three bonus. */
create function public.goals_streak(p_user uuid, p_through date) returns integer
language plpgsql stable security definer set search_path=public as $$
declare n integer := 0; d date := p_through;
begin
 while n < 3650 and exists(select 1 from daily_task_claims where user_id=p_user and day=d and task='bonus') loop
  n := n + 1; d := d - 1;
 end loop;
 return n;
end $$;

create function public.goals_best_streak(p_user uuid) returns integer
language sql stable security definer set search_path=public as $$
 select coalesce(max(c), 0)::integer from (
  select count(*) c from (
   select day - (row_number() over (order by day))::integer g from daily_task_claims where user_id=p_user and task='bonus'
  ) x group by g
 ) y $$;

/** All-three bonus for a given streak day: ₦100 on day 1, +₦25 a day, capped at ₦250 from day 7. */
create function public.goals_bonus_for(p_streak integer) returns integer language sql immutable as $$
 select 100 + 25 * least(greatest(p_streak, 1) - 1, 6) $$;

create function public.get_daily_tasks() returns jsonb
language plpgsql stable security definer set search_path=public as $$
declare u uuid := auth.uid(); d date := goals_today(); v_tasks jsonb; v_bonus boolean; v_streak integer;
begin
 if u is null then raise exception 'Authentication required'; end if;
 select coalesce(jsonb_agg(jsonb_build_object(
   'id',c.id,'title',c.title,'target',c.target,'reward',c.reward,
   'progress',least(daily_task_count(u,c.id,d),c.target),
   'claimed',exists(select 1 from daily_task_claims k where k.user_id=u and k.day=d and k.task=c.id))
  order by md5(u::text || d::text || c.id)), '[]'::jsonb)
  into v_tasks from daily_task_catalog c where c.id in (select daily_tasks_for(u,d));
 v_bonus := exists(select 1 from daily_task_claims where user_id=u and day=d and task='bonus');
 v_streak := case when v_bonus then goals_streak(u,d) else goals_streak(u,d-1) end;
 return jsonb_build_object('day',d,'tasks',v_tasks,'streak',v_streak,'best_streak',goals_best_streak(u),
  'bonus',jsonb_build_object('claimed',v_bonus,
   'reward',case when v_bonus then (select reward from daily_task_claims where user_id=u and day=d and task='bonus')
            else goals_bonus_for(v_streak + 1) end));
end $$;

create function public.claim_daily_task(p_task text) returns jsonb
language plpgsql security definer set search_path=public as $$
declare u uuid := auth.uid(); d date := goals_today(); c daily_task_catalog; v_reward integer;
 v_streak integer; b numeric; v_kind text; v_desc text;
begin
 if u is null then raise exception 'Authentication required'; end if;
 perform 1 from profiles where id=u for update;
 if not found then raise exception 'Profile missing'; end if;
 if exists(select 1 from daily_task_claims where user_id=u and day=d and task=p_task) then
  raise exception 'Already claimed today';
 end if;
 if p_task = 'bonus' then
  if (select count(*) from daily_task_claims where user_id=u and day=d and task<>'bonus') < 3 then
   raise exception 'Finish and claim all three tasks first';
  end if;
  v_streak := goals_streak(u, d - 1) + 1;
  v_reward := goals_bonus_for(v_streak);
  v_kind := 'daily_task_bonus';
  v_desc := 'All daily tasks done (day ' || v_streak || ' streak)';
 else
  if p_task is null or p_task not in (select daily_tasks_for(u,d)) then raise exception 'That is not one of today''s tasks'; end if;
  select * into c from daily_task_catalog where id=p_task;
  if daily_task_count(u,p_task,d) < c.target then raise exception 'Not done yet'; end if;
  v_reward := c.reward;
  v_kind := 'daily_task';
  v_desc := 'Daily task: ' || c.title;
 end if;
 perform ensure_player_wallet();
 select balance into b from wallets where user_id=u for update;
 if not found then raise exception 'Wallet missing'; end if;
 insert into daily_task_claims(user_id,day,task,reward,streak) values(u,d,p_task,v_reward,v_streak);
 update wallets set balance=balance+v_reward,updated_at=now() where user_id=u returning balance into b;
 insert into wallet_transactions(user_id,type,amount,balance_after,description,metadata)
  values(u,v_kind,v_reward,b,v_desc,jsonb_build_object('task',p_task,'day',d));
 return jsonb_build_object('success',true,'task',p_task,'reward',v_reward,'balance',b,'streak',v_streak);
end $$;

-- ---------------------------------------------------------------------------------------------
-- 3. Badges. Progress is counted on read; badges pay nothing.
-- ---------------------------------------------------------------------------------------------
create table public.college_visits(
 user_id uuid not null references public.profiles(id) on delete cascade,
 place text not null check (place in ('colfhec','coleng','colerm','colvet','colanim','colplant','colcoms','colbios','colphys')),
 first_at timestamptz not null default now(),
 primary key (user_id, place)
);
alter table public.college_visits enable row level security;
create policy "Read own college visits" on public.college_visits for select to authenticated using (auth.uid() = user_id);
grant select on public.college_visits to authenticated;

create function public.record_college_visit(p_place text) returns integer
language plpgsql security definer set search_path=public as $$
declare u uuid := auth.uid();
begin
 if u is null then raise exception 'Authentication required'; end if;
 if p_place not in ('colfhec','coleng','colerm','colvet','colanim','colplant','colcoms','colbios','colphys') then
  raise exception 'Unknown college';
 end if;
 insert into college_visits(user_id,place) values(u,p_place) on conflict do nothing;
 return (select count(*) from college_visits where user_id=u)::integer;
end $$;

/** Badge progress for any student (badges are public, like usernames). */
create function public.get_achievements(p_user uuid default null) returns jsonb
language plpgsql stable security definer set search_path=public as $$
declare u uuid := coalesce(p_user, auth.uid());
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 return jsonb_build_object(
  'jobs',(select count(*) from job_runs where user_id=u and status='completed'),
  'keke',(select count(*) from keke_tickets where user_id=u and status='completed'),
  'den_wins',(select count(*) from ps_reward_receipts where user_id=u and outcome='win'),
  'full_class_days',(select count(*) from (
     select (created_at at time zone 'Africa/Lagos')::date from lecture_attendance where user_id=u and reward_claimed>0
     group by 1 having count(*)>=3) x),
  'colleges',(select count(*) from college_visits where user_id=u),
  'best_streak',goals_best_streak(u),
  'friends',(select count(*) from friends where user_id=u and status='accepted'));
end $$;

-- ---------------------------------------------------------------------------------------------
-- 4. Weekly leaderboards (Monday 00:00 Lagos). Earnings count only what students earn by playing:
--    jobs, lectures, allowance, Game Den and tasks. Transfers, refunds and bets never count.
-- ---------------------------------------------------------------------------------------------
create function public.get_leaderboards() returns jsonb
language plpgsql stable security definer set search_path=public as $$
declare u uuid := auth.uid();
 ws timestamptz := date_trunc('week', now() at time zone 'Africa/Lagos') at time zone 'Africa/Lagos';
 v_earners jsonb; v_den jsonb; v_colleges jsonb; v_mine integer; v_rank integer;
begin
 if u is null then raise exception 'Authentication required'; end if;
 with e as (
  select user_id, sum(amount)::integer amount, min(created_at) first_at from wallet_transactions
   where created_at>=ws and amount>0
    and type in ('campus_job','campus_job_bonus','lecture_attendance','daily_reward','ps_reward','daily_task','daily_task_bonus')
   group by user_id
 )
 select
  (select coalesce(jsonb_agg(jsonb_build_object('username',p.username,'college',p.college,'value',t.amount,'me',p.id=u)
     order by t.amount desc, t.first_at), '[]'::jsonb)
    from (select * from e order by amount desc, first_at limit 10) t join profiles p on p.id=t.user_id),
  (select amount from e where user_id=u),
  (select count(*)+1 from e where amount > (select amount from e where user_id=u))
 into v_earners, v_mine, v_rank;
 if v_mine is null then v_rank := null; end if;
 select coalesce(jsonb_agg(jsonb_build_object('username',p.username,'college',p.college,'value',w.wins,'me',p.id=u)
   order by w.wins desc, w.first_at), '[]'::jsonb)
  into v_den from (
   select user_id, count(*)::integer wins, min(created_at) first_at from ps_reward_receipts
    where outcome='win' and created_at>=ws group by user_id order by wins desc, first_at limit 10
  ) w join profiles p on p.id=w.user_id;
 select coalesce(jsonb_agg(jsonb_build_object('college',x.college,'value',x.lectures,'students',x.students)
   order by x.lectures desc, x.college), '[]'::jsonb)
  into v_colleges from (
   select p.college, count(*)::integer lectures, count(distinct a.user_id)::integer students
    from lecture_attendance a join profiles p on p.id=a.user_id
    where a.created_at>=ws group by p.college
  ) x;
 return jsonb_build_object('week_start',ws,'earners',v_earners,'den_wins',v_den,'colleges',v_colleges,
  'me',jsonb_build_object('earned',coalesce(v_mine,0),'rank',v_rank));
end $$;

-- ---------------------------------------------------------------------------------------------
-- 5. Grants: students call the four entry points; the helpers are internal.
-- ---------------------------------------------------------------------------------------------
revoke all on function public.daily_tasks_for(uuid,date) from public,anon,authenticated;
revoke all on function public.daily_task_count(uuid,text,date) from public,anon,authenticated;
revoke all on function public.goals_streak(uuid,date) from public,anon,authenticated;
revoke all on function public.goals_best_streak(uuid) from public,anon,authenticated;
revoke all on function public.get_daily_tasks() from public,anon;
revoke all on function public.claim_daily_task(text) from public,anon;
revoke all on function public.record_college_visit(text) from public,anon;
revoke all on function public.get_achievements(uuid) from public,anon;
revoke all on function public.get_leaderboards() from public,anon;
grant execute on function public.get_daily_tasks() to authenticated;
grant execute on function public.claim_daily_task(text) to authenticated;
grant execute on function public.record_college_visit(text) to authenticated;
grant execute on function public.get_achievements(uuid) to authenticated;
grant execute on function public.get_leaderboards() to authenticated;

commit;
