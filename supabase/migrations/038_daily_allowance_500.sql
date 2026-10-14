-- 038: Daily allowance is ₦500, once per 20 hours. Apply once AFTER 037 (safe to re-run).
-- Mirrors ECONOMY_CONFIG.DAILY_RESUMPTION_ALLOWANCE in src/config/economy.ts. Existing balances
-- and ledger rows are not touched.
begin;

create or replace function public.claim_daily_reward(p_user_id uuid default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare u uuid := auth.uid(); v_reward constant numeric := 500.00; v_last timestamptz; b numeric;
begin
 if u is null then return jsonb_build_object('success',false,'error','Unauthorized: User not authenticated'); end if;
 perform ensure_player_wallet();
 -- Row lock serializes concurrent claims: the second one sees the new timestamp.
 select balance,last_daily_reward_at into b,v_last from wallets where user_id=u for update;
 if v_last is not null and now()-v_last < interval '20 hours' then
  return jsonb_build_object('success',false,'error','Daily reward already claimed today. Please check back tomorrow!');
 end if;
 update wallets set balance=balance+v_reward,last_daily_reward_at=now(),updated_at=now()
  where user_id=u returning balance into b;
 insert into wallet_transactions(user_id,type,amount,balance_after,description)
  values(u,'daily_reward',v_reward,b,'Daily Campus Student Stipend');
 return jsonb_build_object('success',true,'reward',v_reward,'balance',b);
end $$;

revoke all on function public.claim_daily_reward(uuid) from public, anon;
grant execute on function public.claim_daily_reward(uuid) to authenticated, service_role;

commit;

notify pgrst, 'reload schema';
