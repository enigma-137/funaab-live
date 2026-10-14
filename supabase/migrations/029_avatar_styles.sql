-- 029: More avatar styles. Apply once AFTER 028.
-- Adds hairstyles (long weave, ponytail, bob, locs, big afro, cornrows, gele/headwrap, clean
-- shave), tops (jacket, jersey, kaftan, tank top, gown), bottoms (shorts, long skirt) and shoes
-- (sandals, heels, boots). Only the style allowlist changes; it must match avatarOptions in
-- src/config/avatar.ts. Grants from 006 are kept by create or replace.
begin;

create or replace function public.complete_student_profile(p_course_id text, p_avatar jsonb, p_story_completed boolean default false)
returns public.profiles language plpgsql security definer set search_path = public as $$
declare result public.profiles; selected public.game_courses; k text;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select * into selected from public.game_courses where id = p_course_id;
  if not found then raise exception 'Choose a game course'; end if;
  if p_avatar is null or jsonb_typeof(p_avatar) <> 'object' or octet_length(p_avatar::text) > 2048 then raise exception 'Invalid avatar'; end if;
  if coalesce(p_avatar->>'bodyType','') not in ('masculine','feminine')
    or coalesce(p_avatar->>'hairstyle','') not in ('low-cut','short-afro','fade','short-twists','natural-puff','braids','bun','short-natural',
      'long-weave','ponytail','bob','locs','big-afro','cornrows','headwrap','bald')
    or coalesce(p_avatar->>'topStyle','') not in ('t-shirt','polo','shirt','hoodie','blouse','jacket','jersey','kaftan','tank-top','gown')
    or coalesce(p_avatar->>'bottomStyle','') not in ('trousers','jeans','joggers','skirt','shorts','long-skirt')
    or coalesce(p_avatar->>'shoeStyle','') not in ('sneakers','flats','sandals','heels','boots') then raise exception 'Invalid avatar style'; end if;
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

commit;
