-- One-off (not a migration): ₦20,000 launch gift for the Campus Grand Prix. Run once AFTER migration 050.
-- Safe to re-run: every wallet gets the gift once (a 'launch_bonus' ledger row with
-- event 'grand-prix-2026' marks it), so running it again pays nobody twice. Players who join
-- after it is run start with the normal starter balance.
begin;
with gifted as (
 update public.wallets w set balance=balance+20000,updated_at=now()
 where not exists(select 1 from public.wallet_transactions t
  where t.user_id=w.user_id and t.type='launch_bonus' and t.metadata->>'event'='grand-prix-2026')
 returning w.user_id,w.balance
)
insert into public.wallet_transactions(user_id,type,amount,balance_after,description,metadata)
select user_id,'launch_bonus',20000,balance,'Grand Prix launch gift',jsonb_build_object('event','grand-prix-2026') from gifted;
commit;
