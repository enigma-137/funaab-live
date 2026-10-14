-- 036: Agricultural Administration joins COLAMRUD (a student asked). Apply once AFTER 035
-- (safe to re-run). Mirrors src/config/academics.ts.
begin;

insert into public.game_courses (id, name, college, game_cutoff) values
  ('AAD', 'Agricultural Administration', 'COLAMRUD', 48)
on conflict (id) do update set name = excluded.name, college = excluded.college, game_cutoff = excluded.game_cutoff;

commit;
