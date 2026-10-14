-- 037: COLAMRUD department name matches FUNAAB's: Agricultural Economics and Farm Management.
-- Apply once AFTER 036 (safe to re-run). Mirrors src/config/academics.ts.
begin;

update public.game_courses set name = 'Agricultural Economics and Farm Management' where id = 'AEC';

commit;
