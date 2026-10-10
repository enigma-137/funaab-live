-- Run after 005. Additive: no wallet, inventory, friend or job data is rewritten.
begin;
alter table public.profiles
  add column onboarding_completed boolean not null default false,
  add column course_id text,
  add column game_matric_number text unique;

revoke update, insert on public.profiles from authenticated, anon;
grant insert(id, username, college, avatar_config, last_world) on public.profiles to authenticated;
grant update(username, college, avatar_config, last_world, is_online, updated_at) on public.profiles to authenticated;

create table public.game_courses (
  id text primary key, name text not null, college text not null,
  game_cutoff integer not null check (game_cutoff between 0 and 100)
);
comment on table public.game_courses is 'Fictional game catalogue and cutoffs. Not university admissions guidance.';
insert into public.game_courses values
 ('AGE','Agricultural Engineering','COLENG',60), ('CVE','Civil Engineering','COLENG',65),
 ('MEE','Mechanical Engineering','COLENG',65), ('FST','Food Science and Technology','COLFHEC',60),
 ('NTD','Nutrition and Dietetics','COLFHEC',58), ('HSM','Home Science and Management','COLFHEC',0),
 ('AEC','Agricultural Economics','COLAMRUD',50), ('ARD','Agricultural Extension and Rural Development','COLAMRUD',0),
 ('CPT','Crop Protection','COLPLANT',0), ('HRT','Horticulture','COLPLANT',48),
 ('ANP','Animal Production and Health','COLANIM',50), ('ANN','Animal Nutrition','COLANIM',0),
 ('VET','Veterinary Medicine','COLVET',68), ('BCH','Biochemistry','COLBIOS',60),
 ('MCB','Microbiology','COLBIOS',58), ('BIO','Biological Sciences','COLBIOS',0),
 ('CSC','Computer Science','COLPHYS',65), ('MTH','Mathematics','COLPHYS',0), ('PHY','Physics','COLPHYS',48);
alter table public.game_courses enable row level security;
create policy "Authenticated game catalogue" on public.game_courses for select to authenticated using (true);
grant select on public.game_courses to authenticated;
alter table public.profiles add constraint profiles_game_course_fk foreign key (course_id) references public.game_courses(id);

-- Private story state is kept OUT of the existing publicly readable profiles table.
create table public.student_journeys (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  beta_player boolean not null default false,
  draft jsonb not null default '{}'::jsonb check (octet_length(draft::text) < 8192),
  admission_story_completed boolean not null default false,
  orientation_steps text[] not null default '{}',
  orientation_completed boolean not null default false,
  orientation_badge_claimed_at timestamptz,
  constraint valid_orientation_steps check (orientation_steps <@ array['car-park','keke','college','food','student']::text[])
);
-- Snapshot beta membership once, at migration time. Future accounts default to new.
insert into public.student_journeys(user_id, beta_player) select id, true from public.profiles;
alter table public.student_journeys enable row level security;
create policy "Read own journey" on public.student_journeys for select to authenticated using (auth.uid() = user_id);
create policy "Update own draft" on public.student_journeys for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
revoke all on public.student_journeys from anon, authenticated;
grant select on public.student_journeys to authenticated;
grant update(draft, orientation_steps) on public.student_journeys to authenticated;

create sequence public.game_matric_sequence start 1000;
revoke all on sequence public.game_matric_sequence from public, anon, authenticated;

create function public.ensure_student_journey() returns public.student_journeys
language plpgsql security definer set search_path = public as $$
declare result public.student_journeys;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  insert into public.student_journeys(user_id) values(auth.uid()) on conflict do nothing;
  select * into result from public.student_journeys where user_id = auth.uid();
  return result;
end $$;

create function public.complete_student_profile(p_course_id text, p_avatar jsonb, p_story_completed boolean default false)
returns public.profiles language plpgsql security definer set search_path = public as $$
declare result public.profiles; selected public.game_courses; k text;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select * into selected from public.game_courses where id = p_course_id;
  if not found then raise exception 'Choose a game course'; end if;
  if p_avatar is null or jsonb_typeof(p_avatar) <> 'object' or octet_length(p_avatar::text) > 2048 then raise exception 'Invalid avatar'; end if;
  if coalesce(p_avatar->>'bodyType','') not in ('masculine','feminine')
    or coalesce(p_avatar->>'hairstyle','') not in ('low-cut','short-afro','fade','short-twists','natural-puff','braids','bun','short-natural')
    or coalesce(p_avatar->>'topStyle','') not in ('t-shirt','polo','shirt','hoodie','blouse')
    or coalesce(p_avatar->>'bottomStyle','') not in ('trousers','jeans','joggers','skirt')
    or coalesce(p_avatar->>'shoeStyle','') not in ('sneakers','flats') then raise exception 'Invalid avatar style'; end if;
  foreach k in array array['skinTone','hairColor','topColor','bottomColor','shoeColor'] loop
    if coalesce(p_avatar->>k,'') !~ '^#[0-9a-fA-F]{6}$' then raise exception 'Invalid avatar color'; end if;
  end loop;
  -- Serializes retries and competing tabs; the sequence plus unique constraint ensures uniqueness.
  select * into result from public.profiles where id = auth.uid() for update;
  if not found then raise exception 'Profile missing'; end if;
  if result.game_matric_number is not null and result.course_id is distinct from p_course_id then raise exception 'Your admitted course is already set'; end if;
  update public.profiles set course_id = selected.id, college = selected.college,
    avatar_config = p_avatar,
    game_matric_number = coalesce(game_matric_number, selected.id || '/' || to_char(now(), 'YY') || '/' || nextval('public.game_matric_sequence')::text),
    onboarding_completed = true, updated_at = now()
    where id = auth.uid() returning * into result;
  perform public.ensure_student_journey();
  update public.student_journeys set admission_story_completed = admission_story_completed or p_story_completed,
    draft = '{}'::jsonb where user_id = auth.uid();
  return result;
end $$;

create function public.accept_game_admission(p_course_id text) returns public.profiles
language plpgsql security definer set search_path = public as $$
declare result public.profiles; selected public.game_courses;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select * into selected from public.game_courses where id=p_course_id;
  if not found then raise exception 'Choose a game course'; end if;
  select * into result from public.profiles where id=auth.uid() for update;
  if not found then raise exception 'Profile missing'; end if;
  if result.game_matric_number is not null and result.course_id is distinct from p_course_id then raise exception 'Game admission already accepted'; end if;
  update public.profiles set course_id=selected.id, college=selected.college,
    game_matric_number=coalesce(game_matric_number, selected.id || '/' || to_char(now(),'YY') || '/' || nextval('public.game_matric_sequence')::text)
    where id=auth.uid() returning * into result;
  return result;
end $$;

-- Orientation rewards a campus badge, not spendable currency. Self-reported movement
-- cannot mint money. One lock/one timestamp makes retries and concurrent claims safe.
create function public.claim_orientation_badge() returns public.student_journeys
language plpgsql security definer set search_path = public as $$
declare result public.student_journeys;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select * into result from public.student_journeys where user_id = auth.uid() for update;
  if not found then raise exception 'Journey missing'; end if;
  if not (array['car-park','keke','college','food','student']::text[] <@ result.orientation_steps) then raise exception 'Explore all five stops first'; end if;
  update public.student_journeys set orientation_completed = true,
    orientation_badge_claimed_at = coalesce(orientation_badge_claimed_at, now())
    where user_id = auth.uid() returning * into result;
  return result;
end $$;

revoke all on function public.ensure_student_journey() from public, anon;
revoke all on function public.complete_student_profile(text,jsonb,boolean) from public, anon;
revoke all on function public.claim_orientation_badge() from public, anon;
grant execute on function public.ensure_student_journey() to authenticated;
grant execute on function public.complete_student_profile(text,jsonb,boolean) to authenticated;
grant execute on function public.claim_orientation_badge() to authenticated;
revoke all on function public.accept_game_admission(text) from public, anon;
grant execute on function public.accept_game_admission(text) to authenticated;
commit;
