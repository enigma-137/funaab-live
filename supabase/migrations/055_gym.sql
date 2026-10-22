-- 055: FUNAAB Fitness Gym. Apply once AFTER 054.
-- A ₦1,000 pass covers one session: mornings 06:00–10:00 or evenings 16:00–21:00 (Lagos). Only the
-- Worker sells it, after checking you are at the door while the gym is open; buying again in the same
-- session costs nothing. Each finished set at a station gives XP once per station per session.
-- Mirrors src/config/gym.ts and src/config/levels.ts.
begin;

create table public.gym_passes(
 user_id uuid not null references public.profiles(id) on delete cascade,
 pass_key text not null, paid integer not null check(paid>0), created_at timestamptz not null default now(),
 primary key(user_id,pass_key)
);
alter table public.gym_passes enable row level security;
revoke all on public.gym_passes from anon,authenticated;

-- "2026-10-22-am" while a session is open, null between sessions.
create or replace function public.gym_pass_key(p_at timestamptz default now()) returns text
language sql stable as $$
 select case
  when extract(hour from (p_at at time zone 'Africa/Lagos')) between 6 and 9 then to_char(p_at at time zone 'Africa/Lagos','YYYY-MM-DD')||'-am'
  when extract(hour from (p_at at time zone 'Africa/Lagos')) between 16 and 20 then to_char(p_at at time zone 'Africa/Lagos','YYYY-MM-DD')||'-pm'
  else null end $$;

create or replace function public.gym_entry_trusted(p_user uuid) returns jsonb
language plpgsql security definer set search_path=public as $$
declare v_key text := gym_pass_key(); b numeric;
begin
 if v_key is null then raise exception 'The gym is closed. It opens 6–10 AM and 4–9 PM.'; end if;
 perform 1 from profiles where id=p_user for update;
 if not found then raise exception 'Profile missing'; end if;
 if exists(select 1 from gym_passes where user_id=p_user and pass_key=v_key) then
  return jsonb_build_object('pass',v_key,'charged',false);
 end if;
 update wallets set balance=balance-1000,updated_at=now() where user_id=p_user and balance>=1000 returning balance into b;
 if b is null then raise exception 'A gym pass is ₦1,000. Top up your wallet first.'; end if;
 insert into gym_passes(user_id,pass_key,paid) values(p_user,v_key,1000);
 insert into wallet_transactions(user_id,type,amount,balance_after,description,metadata)
  values(p_user,'gym_pass',-1000,b,'Gym pass ('||case when v_key like '%-am' then 'morning' else 'evening' end||')',jsonb_build_object('pass',v_key));
 return jsonb_build_object('pass',v_key,'charged',true,'balance',b);
end $$;

-- XP: a gym session (the pass) and each finished set.
create or replace function public.xp_amount(p_source text) returns integer language sql immutable as $$
 select case p_source
  when 'campus_job' then 20 when 'hustle_pay' then 15 when 'errand_pay' then 8
  when 'lecture_attendance' then 10 when 'daily_goal' then 10 when 'daily_plan_bonus' then 25
  when 'daily_reward' then 5 when 'home_allowance' then 10 when 'food_purchase' then 3
  when 'keke_fare' then 4 when 'hostel_purchase' then 5 when 'hostel_makeover' then 5
  when 'hostel_expand' then 30 when 'lodge_rent' then 10 when 'game_den' then 10
  when 'football_win' then 15 when 'court_match' then 5 when 'court_win' then 12
  when 'rally_match' then 5 when 'rally_win' then 15
  when 'party_ticket' then 10 when 'arcade_match' then 4 when 'arcade_win' then 8
  when 'gym_pass' then 10 when 'gym_set' then 6 else 0 end $$;

create or replace function public.xp_event_trusted(p_user uuid,p_source text,p_ref text) returns integer
language plpgsql security definer set search_path=public as $$
begin
 if p_source not in('court_match','court_win','rally_match','rally_win','arcade_match','arcade_win','gym_set') then raise exception 'Unknown XP source'; end if;
 if p_ref is null or length(p_ref) not between 1 and 96 then raise exception 'Invalid reference'; end if;
 return award_xp(p_user,p_source,p_ref);
end $$;

revoke all on function public.gym_entry_trusted(uuid),public.gym_pass_key(timestamptz) from public,anon,authenticated;
grant execute on function public.gym_entry_trusted(uuid) to service_role;
revoke all on function public.xp_amount(text),public.xp_event_trusted(uuid,text,text) from public,anon,authenticated;
grant execute on function public.xp_event_trusted(uuid,text,text) to service_role;

commit;
