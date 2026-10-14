-- 032: FPY farm shifts and the jumpsuit. Apply once AFTER 031.
-- Farm shift (plant, water, harvest at the FPY farm) pays ₦300 as a hustle, under the shared
-- daily hustle cap with a 5-minute cooldown; only the Worker can pay it, after checking each step
-- was done at its plot and at a real pace. Mirrors src/config/fpyFarm.ts.
-- The jumpsuit (FPY coverall) joins the avatar style allowlist (mirrors src/config/avatar.ts).
begin;

create or replace function public.hustle_pay_trusted(p_user uuid,p_hustle text,p_ref text,p_amount integer) returns integer
language plpgsql security definer set search_path=public as $$
begin
 case p_hustle
  when 'pos' then
   if p_amount<>250 then raise exception 'Invalid POS pay'; end if;
   return pay_hustle(p_user,'pos',p_ref,250,'POS kiosk shift',interval '5 minutes');
  when 'photo' then
   if p_amount not in(100,200,300,400) then raise exception 'Invalid photo pay'; end if;
   return pay_hustle(p_user,'photo',p_ref,p_amount,'Campus photo shoot',interval '3 minutes');
  when 'farm' then
   if p_amount<>300 then raise exception 'Invalid farm pay'; end if;
   return pay_hustle(p_user,'farm',p_ref,300,'FPY farm shift',interval '5 minutes');
  else raise exception 'Unknown hustle';
 end case;
end $$;

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
    or coalesce(p_avatar->>'topStyle','') not in ('t-shirt','polo','shirt','hoodie','blouse','jacket','jersey','kaftan','tank-top','gown','jumpsuit')
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
