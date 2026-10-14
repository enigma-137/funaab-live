-- 025: COLERM's four departments, so the college can be chosen at admission and in "Change
-- department". Apply once AFTER 024 (safe to re-run). Game catalogue only (not admissions
-- guidance). Mirrors src/config/academics.ts.
begin;

insert into public.game_courses (id, name, college, game_cutoff) values
  ('AQFM', 'Aquaculture and Fisheries Management', 'COLERM', 50),
  ('EMT', 'Environmental Management and Toxicology', 'COLERM', 55),
  ('FWM', 'Forestry and Wildlife Management', 'COLERM', 48),
  ('WMA', 'Water Resources Management and Agrometeorology', 'COLERM', 50)
on conflict (id) do update set name = excluded.name, college = excluded.college, game_cutoff = excluded.game_cutoff;

commit;
