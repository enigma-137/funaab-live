-- 020 Weekly College League. Additive only; values mirror src/config/collegeLeague.ts
-- (scripts/test-league-db.ts checks drift). Points come from existing server records:
--  daily goal claimed 10 · lecture attended 5 · Game Den match 5 · hustle payment 2 ·
--  penalty challenge win 15 (reported by the Worker). Per-student cap 200 a week.
-- Weeks match academic semesters (Monday–Sunday, Lagos). Colleges are ranked by average points
-- per active student, with at least 2 active students to be ranked.

create table public.league_events(
 user_id uuid not null references public.profiles(id) on delete cascade, kind text not null check(kind in('football_win')),
 ref text not null, created_at timestamptz not null default now(), primary key(kind,ref)
);
alter table public.league_events enable row level security;
revoke all on public.league_events from anon,authenticated;

create or replace function public.league_event_trusted(p_user uuid,p_kind text,p_ref text) returns void
language sql security definer set search_path=public as $$
 insert into league_events(user_id,kind,ref) values(p_user,p_kind,p_ref) on conflict do nothing $$;

-- Capped points per student for one week.
create or replace function public.league_student_points(p_week integer) returns table(user_id uuid,college text,points integer)
language sql stable security definer set search_path=public as $$
 with b as (select academic_semester_from(p_week) f, academic_semester_from(p_week+1) t),
 raw as (
  select c.user_id, 10 pts from daily_goal_claims c, b where c.created_at>=b.f and c.created_at<b.t
  union all select a.user_id, 5 from lecture_attendance a, b where a.created_at>=b.f and a.created_at<b.t
  union all select r.user_id, 5 from ps_reward_receipts r, b where r.created_at>=b.f and r.created_at<b.t
  union all select h.user_id, 2 from hustle_payments h, b where h.created_at>=b.f and h.created_at<b.t
  union all select e.user_id, 15 from league_events e, b where e.created_at>=b.f and e.created_at<b.t
 )
 select r.user_id, p.college, least(200, sum(r.pts))::integer
 from raw r join profiles p on p.id=r.user_id group by r.user_id, p.college $$;

create or replace function public.league_table(p_week integer) returns jsonb
language sql stable security definer set search_path=public as $$
 select coalesce(jsonb_agg(x order by x.ranked desc, x.average desc, x.total desc, x.college),'[]') from (
  select college, count(*)::integer active, sum(points)::integer total, round(avg(points),1) average,
   count(*)>=2 ranked
  from league_student_points(p_week) group by college
 ) x $$;

create or replace function public.college_league() returns jsonb
language plpgsql stable security definer set search_path=public as $$
declare u uuid := auth.uid(); v_week integer := academic_semester(lagos_today()); v_college text; v_last jsonb;
begin
 if u is null then raise exception 'Authentication required'; end if;
 select college into v_college from profiles where id=u;
 v_last := league_table(v_week-1);
 return jsonb_build_object('week_ends_at',academic_semester_from(v_week+1),'my_college',v_college,
  'my_points',coalesce((select points from league_student_points(v_week) where user_id=u),0),'cap',200,
  'table',league_table(v_week),
  'last_champion',(select e->>'college' from jsonb_array_elements(v_last) e where (e->>'ranked')::boolean limit 1));
end $$;

-- The campus banner: last week's champion (public, no personal data).
create or replace function public.league_champion() returns text
language sql stable security definer set search_path=public as $$
 select e->>'college' from jsonb_array_elements(league_table(academic_semester(lagos_today())-1)) e
 where (e->>'ranked')::boolean limit 1 $$;

revoke all on function public.league_event_trusted(uuid,text,text),public.league_student_points(integer),public.league_table(integer) from public,anon,authenticated;
grant execute on function public.league_event_trusted(uuid,text,text) to service_role;
revoke all on function public.college_league(),public.league_champion() from public,anon;
grant execute on function public.college_league(),public.league_champion() to authenticated;
