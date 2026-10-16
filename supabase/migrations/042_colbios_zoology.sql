-- 042: Zoology joins COLBIOS (a student asked). Apply once AFTER 041 (safe to re-run).
-- Mirrors src/config/academics.ts. Students already admitted can switch from their profile
-- (tap your name, top left → Change department; once a day).
begin;

insert into public.game_courses (id, name, college, game_cutoff) values
  ('ZOO', 'Zoology', 'COLBIOS', 55)
on conflict (id) do update set name = excluded.name, college = excluded.college, game_cutoff = excluded.game_cutoff;

commit;
