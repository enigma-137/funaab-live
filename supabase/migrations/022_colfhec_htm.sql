-- 022: Hospitality and Tourism Management (HTM) joins COLFHEC. Apply once AFTER 021.
-- Game catalogue only (not admissions guidance). Mirrors src/config/academics.ts.
begin;

insert into public.game_courses (id, name, college, game_cutoff) values
  ('HTM', 'Hospitality and Tourism Management', 'COLFHEC', 55)
on conflict (id) do update set name = excluded.name, college = excluded.college, game_cutoff = excluded.game_cutoff;

commit;
