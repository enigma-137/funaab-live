-- 035: Clothing and Textiles joins COLFHEC (a student asked, it was missing). Apply once AFTER 034
-- (safe to re-run). Mirrors src/config/academics.ts.
begin;

insert into public.game_courses (id, name, college, game_cutoff) values
  ('CTX', 'Clothing and Textiles', 'COLFHEC', 50)
on conflict (id) do update set name = excluded.name, college = excluded.college, game_cutoff = excluded.game_cutoff;

commit;
