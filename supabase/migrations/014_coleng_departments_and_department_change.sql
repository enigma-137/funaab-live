-- 014: All five COLENG departments, and students can change department. Apply once AFTER 013.
-- Game catalogue only (not admissions guidance). Mirrors src/config/academics.ts.
begin;

-- 1. COLENG departments, matching funaab.edu.ng. AGE keeps its id (existing students keep it).
update public.game_courses set name = 'Agricultural and Bio-Resources Engineering' where id = 'AGE';
insert into public.game_courses (id, name, college, game_cutoff) values
  ('EEE', 'Electrical and Electronics Engineering', 'COLENG', 65),
  ('MCE', 'Mechatronics Engineering', 'COLENG', 63)
on conflict (id) do update set name = excluded.name, college = excluded.college, game_cutoff = excluded.game_cutoff;

-- 2. Change department after admission: once every 24 hours. College follows the department,
--    and the matric number keeps its year and serial but takes the new department prefix.
alter table public.profiles add column if not exists course_changed_at timestamptz;

create or replace function public.change_game_department(p_course_id text) returns public.profiles
language plpgsql security definer set search_path = public as $$
declare result public.profiles; selected public.game_courses;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select * into selected from public.game_courses where id = p_course_id;
  if not found then raise exception 'Choose a department'; end if;
  select * into result from public.profiles where id = auth.uid() for update;
  if not found then raise exception 'Profile missing'; end if;
  if result.course_id = p_course_id then return result; end if;
  if result.course_changed_at is not null and result.course_changed_at > now() - interval '24 hours' then
    raise exception 'You can change department once a day. Try again tomorrow.';
  end if;
  update public.profiles set
    course_id = selected.id,
    college = selected.college,
    game_matric_number = case
      when game_matric_number is null then null
      else selected.id || substr(game_matric_number, position('/' in game_matric_number)) end,
    course_changed_at = now(),
    updated_at = now()
    where id = auth.uid() returning * into result;
  return result;
end $$;
revoke all on function public.change_game_department(text) from public, anon;
grant execute on function public.change_game_department(text) to authenticated;

commit;
