-- 049: Cheaper campus transport. Apply once AFTER 048 (safe to re-run).
-- The route Keke is ₦200 a ride and the Korope bus ₦150 (src/config/kekeRoutes.ts). The fare check
-- in keke_reserve_trusted allowed ₦300–₦1,200 (039), so it now allows ₦100–₦1,200; private Keke
-- rides from the Car Park still cost ₦300–₦1,200 by distance.
begin;
do $$
declare d text := pg_get_functiondef('public.keke_reserve_trusted(uuid,uuid,text,integer)'::regprocedure);
begin
 if position('not between 100 and 1200' in d)>0 then return; end if;
 if position('not between 300 and 1200' in d)=0 then raise exception '049: keke_reserve_trusted fare check not found'; end if;
 execute replace(d,'not between 300 and 1200','not between 100 and 1200');
end $$;
commit;
