-- 028: COLCOMS (College of Computing Sciences) gets its four departments, so it can be chosen
-- at admission and in "Change department". Computer Science moves here from COLPHYS, and
-- existing Computer Science students move with it (the college follows the department, as in
-- 014; matric numbers are unchanged). Apply once AFTER 027 (safe to re-run).
-- Game catalogue only (not admissions guidance). Mirrors src/config/academics.ts.
begin;

insert into public.game_courses (id, name, college, game_cutoff) values
  ('CSC', 'Computer Science', 'COLCOMS', 65),
  ('ICT', 'Information Technology and Information Communication Technology', 'COLCOMS', 58),
  ('SEI', 'Software Engineering and Information Systems', 'COLCOMS', 63),
  ('CDS', 'Cyber Security and Data Science', 'COLCOMS', 62)
on conflict (id) do update set name = excluded.name, college = excluded.college, game_cutoff = excluded.game_cutoff;

update public.profiles set college = 'COLCOMS', updated_at = now()
  where course_id = 'CSC' and college is distinct from 'COLCOMS';

commit;
