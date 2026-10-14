-- 030: COLLEND (College of Entrepreneurial and Development Studies) and its three departments,
-- so it can be chosen at admission and in "Change department". Apply once AFTER 029 (safe to
-- re-run). Game catalogue only (not admissions guidance). Mirrors src/config/academics.ts.
begin;

insert into public.game_courses (id, name, college, game_cutoff) values
  ('ACC', 'Accounting', 'COLLEND', 58),
  ('ETS', 'Entrepreneurial Studies', 'COLLEND', 50),
  ('LIS', 'Library and Information Studies', 'COLLEND', 48)
on conflict (id) do update set name = excluded.name, college = excluded.college, game_cutoff = excluded.game_cutoff;

commit;
