-- 013: Friendlier Campus Bet payouts. Apply once AFTER 012.
-- 3/5 now pays 1.3x (a real win instead of stake back), so a typical player wins roughly one
-- ticket in five rather than one in twenty. 4/5 and 5/5 come down so that no strategy,
-- including always backing the hidden favourite, returns more than it stakes
-- (scripts/test-campus-bet.ts). Mirrors CAMPUS_BET_MULTIPLIERS in src/config/campusBet.ts.
-- Settled tickets are not touched; only matchdays settled after this migration use the new table.
begin;
create or replace function public.campus_bet_payout(p_stake integer,p_correct integer) returns integer language sql immutable as $$
 select floor(p_stake*(array[0,0,0.5,1.3,2.5,4]::numeric[])[p_correct+1])::integer
$$;
commit;
