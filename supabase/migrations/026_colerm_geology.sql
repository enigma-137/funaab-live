-- 026: Geology joins COLERM. Apply once AFTER 025 (safe to re-run).
-- Game catalogue only (not admissions guidance). Mirrors src/config/academics.ts.
begin;

insert into public.game_courses (id, name, college, game_cutoff) values
  ('GLY', 'Geology', 'COLERM', 52)
on conflict (id) do update set name = excluded.name, college = excluded.college, game_cutoff = excluded.game_cutoff;

commit;
