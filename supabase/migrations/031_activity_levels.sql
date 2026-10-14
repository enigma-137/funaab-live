-- 031: Activity levels replace academics. Apply once AFTER 030.
-- Level 1, 2, 3… from XP earned by playing (jobs, hustles, lectures, Game Den, games, plans,
-- rides, room upgrades), capped per Lagos day. Values mirror src/config/levels.ts
-- (scripts/test-levels-db.ts checks drift).
-- XP is recorded by triggers on records the server already writes (wallet transactions, Game Den
-- receipts, football wins), so no payment path changes, plus a Worker-only call for court and
-- rally results. A trigger never blocks the payment it watches.
-- Existing players are backfilled from their history (with the same daily cap).
-- Semesters, CGPA, exams and graduation are retired: their client functions are dropped. The
-- tables stay (no data is deleted), and academic_semester()/academic_semester_from() stay for the
-- College League; lecture_questions stays for Library tutoring.
begin;

create table public.player_xp(
 user_id uuid primary key references public.profiles(id) on delete cascade,
 xp integer not null default 0 check(xp>=0), updated_at timestamptz not null default now()
);
create table public.xp_events(
 user_id uuid not null references public.profiles(id) on delete cascade, source text not null, ref text not null,
 amount integer not null check(amount>0), created_at timestamptz not null default now(),
 primary key(user_id,source,ref)
);
create index xp_events_day on public.xp_events(user_id,created_at);
alter table public.player_xp enable row level security;
alter table public.xp_events enable row level security;
revoke all on public.player_xp,public.xp_events from anon,authenticated;

create or replace function public.xp_amount(p_source text) returns integer language sql immutable as $$
 select case p_source
  when 'campus_job' then 20 when 'hustle_pay' then 15 when 'errand_pay' then 8
  when 'lecture_attendance' then 10 when 'daily_goal' then 10 when 'daily_plan_bonus' then 25
  when 'daily_reward' then 5 when 'home_allowance' then 10 when 'food_purchase' then 3
  when 'keke_fare' then 4 when 'hostel_purchase' then 5 when 'hostel_makeover' then 5
  when 'hostel_expand' then 30 when 'lodge_rent' then 10 when 'game_den' then 10
  when 'football_win' then 15 when 'court_match' then 5 when 'court_win' then 12
  when 'rally_match' then 5 when 'rally_win' then 15 else 0 end $$;

-- Total XP for a level: 25(L-1)(L+2) → 0, 100, 250, 450, 700…
create or replace function public.xp_level(p_xp integer) returns integer language plpgsql immutable as $$
declare l integer := greatest(1, floor((-1 + sqrt(9 + 4*greatest(p_xp,0)/25.0))/2)::integer);
begin
 while 25*l*(l+3) <= p_xp loop l := l+1; end loop; -- 25((l+1)-1)((l+1)+2)
 while l>1 and 25*(l-1)*(l+2) > p_xp loop l := l-1; end loop;
 return l;
end $$;

create or replace function public.xp_today(p_user uuid) returns integer
language sql stable security definer set search_path=public as $$
 select coalesce(sum(amount),0)::integer from xp_events where user_id=p_user
  and created_at>=(lagos_today()::timestamp at time zone 'Africa/Lagos') $$;

-- Grants XP once per (source, ref), up to what is left of today's cap. Returns XP granted.
create or replace function public.award_xp(p_user uuid,p_source text,p_ref text) returns integer
language plpgsql security definer set search_path=public as $$
declare v integer := xp_amount(p_source);
begin
 if p_user is null or v<=0 then return 0; end if;
 insert into player_xp(user_id) values(p_user) on conflict do nothing;
 perform 1 from player_xp where user_id=p_user for update;
 if exists(select 1 from xp_events where user_id=p_user and source=p_source and ref=p_ref) then return 0; end if;
 v := least(v, greatest(0, 400 - xp_today(p_user)));
 if v<=0 then return 0; end if;
 insert into xp_events(user_id,source,ref,amount) values(p_user,p_source,p_ref,v);
 update player_xp set xp=xp+v, updated_at=now() where user_id=p_user;
 return v;
end $$;

create or replace function public.xp_wallet_trigger() returns trigger
language plpgsql security definer set search_path=public as $$
begin
 if xp_amount(new.type)>0 then
  begin perform award_xp(new.user_id,new.type,new.id::text);
  exception when others then null; end;
 end if;
 return new;
end $$;
create trigger xp_wallet after insert on public.wallet_transactions for each row execute function public.xp_wallet_trigger();

-- Every Game Den match counts, including ₦0 receipts once the reward cap is reached.
create or replace function public.xp_game_den_trigger() returns trigger
language plpgsql security definer set search_path=public as $$
begin
 begin perform award_xp(new.user_id,'game_den',new.match_id);
 exception when others then null; end;
 return new;
end $$;
create trigger xp_game_den after insert on public.ps_reward_receipts for each row execute function public.xp_game_den_trigger();

create or replace function public.xp_league_trigger() returns trigger
language plpgsql security definer set search_path=public as $$
begin
 begin perform award_xp(new.user_id,new.kind,new.ref);
 exception when others then null; end;
 return new;
end $$;
create trigger xp_league after insert on public.league_events for each row execute function public.xp_league_trigger();

-- Court and rally results live only in the Worker, which reports them here.
create or replace function public.xp_event_trusted(p_user uuid,p_source text,p_ref text) returns integer
language plpgsql security definer set search_path=public as $$
begin
 if p_source not in('court_match','court_win','rally_match','rally_win') then raise exception 'Unknown XP source'; end if;
 if p_ref is null or length(p_ref) not between 1 and 96 then raise exception 'Invalid reference'; end if;
 return award_xp(p_user,p_source,p_ref);
end $$;

create or replace function public.my_level() returns jsonb
language plpgsql stable security definer set search_path=public as $$
declare v integer;
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 select xp into v from player_xp where user_id=auth.uid();
 v := coalesce(v,0);
 return jsonb_build_object('xp',v,'level',xp_level(v),'today',xp_today(auth.uid()),'cap',400);
end $$;

-- Anyone signed in can see another student's level (never their XP history).
create or replace function public.level_public(p_user uuid) returns jsonb
language plpgsql stable security definer set search_path=public as $$
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 return jsonb_build_object('level',xp_level(coalesce((select xp from player_xp where user_id=p_user),0)));
end $$;

-- Backfill: history with the same weights and daily cap, as one row dated in the past so it
-- never uses up today's cap.
with history as (
 select user_id, (created_at at time zone 'Africa/Lagos')::date d, xp_amount(type) x from wallet_transactions where xp_amount(type)>0
 union all select user_id, (created_at at time zone 'Africa/Lagos')::date, xp_amount('game_den') from ps_reward_receipts where user_id is not null
 union all select user_id, (created_at at time zone 'Africa/Lagos')::date, xp_amount(kind) from league_events
), days as (
 select h.user_id, least(400, sum(h.x))::integer x from history h join profiles p on p.id=h.user_id group by h.user_id, h.d
), totals as (select user_id, sum(x)::integer x from days group by user_id having sum(x)>0)
, ins as (
 insert into xp_events(user_id,source,ref,amount,created_at)
  select user_id,'backfill','history',x,'2000-01-01'::timestamptz from totals on conflict do nothing returning user_id,amount
)
insert into player_xp(user_id,xp) select user_id,amount from ins
 on conflict(user_id) do update set xp=player_xp.xp+excluded.xp, updated_at=now();

-- Retire the academic career (017): semesters, quizzes, exams, CGPA and graduation.
drop function if exists public.academic_state();
drop function if exists public.lecture_quiz(text);
drop function if exists public.submit_lecture_quiz(uuid,jsonb);
drop function if exists public.start_semester_exam();
drop function if exists public.submit_semester_exam(jsonb);
drop function if exists public.academic_public(uuid);
revoke all on public.academic_records,public.semester_results from anon,authenticated;

revoke all on function public.xp_amount(text),public.xp_level(integer),public.xp_today(uuid),public.award_xp(uuid,text,text),
 public.xp_wallet_trigger(),public.xp_game_den_trigger(),public.xp_league_trigger(),public.xp_event_trusted(uuid,text,text) from public,anon,authenticated;
grant execute on function public.xp_event_trusted(uuid,text,text) to service_role;
revoke all on function public.my_level(),public.level_public(uuid) from public,anon;
grant execute on function public.my_level(),public.level_public(uuid) to authenticated;

commit;
