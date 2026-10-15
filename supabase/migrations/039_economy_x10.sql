-- 039: Economy ×10 (phase 1). Apply once AFTER 038. NOT safe to re-run: it multiplies balances.
--
-- Every price, fee, pay and reward is multiplied by 10, and so is every wallet, so nobody's buying
-- power changes. Exceptions, chosen on purpose:
--   * new players start with ₦15,000 (not 75,000)
--   * the daily allowance is ₦3,000 (not 5,000)
--   * off-campus lodge rent is ₦5,000 a week (the planned big estate will cost ₦10,000)
-- Mirrors src/config/economy.ts and the other configs; the db tests replay this and check for drift.
-- Hardcoded amounts inside functions are patched in place with pg_temp.patch, which refuses to run
-- (and rolls everything back) if a function does not contain exactly the text expected.
begin;

-- Guard against a second run.
do $$ begin
 if exists(select 1 from wallet_transactions where type='economy_rescale') then
  raise exception '039 has already been applied (economy_rescale rows exist)';
 end if;
end $$;

create function pg_temp.patch(p_fn text, p_old text, p_new text, p_count integer default 1) returns void
language plpgsql as $$
declare d text; n integer;
begin
 d := pg_get_functiondef(p_fn::regprocedure);
 n := (length(d) - length(replace(d, p_old, ''))) / length(p_old);
 if n <> p_count then raise exception '039: % has % × "%" (expected %)', p_fn, n, p_old, p_count; end if;
 execute replace(d, p_old, p_new);
end $$;

-- 1. Wallets ×10, with one ledger row each so history still adds up.
insert into wallet_transactions(user_id,type,amount,balance_after,description)
 select user_id,'economy_rescale',balance*9,balance*10,'Campus economy upgrade: every balance ×10' from wallets where balance>0;
update wallets set balance=balance*10,updated_at=now() where balance>0;
-- Money already held for something scales with it: open errand escrow, unpaid hostel credit, open bets.
alter table errands drop constraint if exists errands_reward_check;
update errands set reward=reward*10 where status in('open','accepted');
alter table errands add constraint errands_reward_check check(reward between 500 and 10000) not valid;
update game_debts set amount=amount*10 where paid_at is null;
alter table campus_bet_tickets drop constraint if exists campus_bet_tickets_stake_check;
update campus_bet_tickets set stake=stake*10 where settled_at is null;
alter table campus_bet_tickets add constraint campus_bet_tickets_stake_check check(stake between 500 and 5000 and stake%100=0) not valid;

-- 2. Price and pay tables.
update campus_food_menu set price=price*10;
update food_vendor_items set price=price*10;
update hostel_catalog set price=price*10;
update hostel_finishes set price=price*10;
update shop_stock_catalog set cost=cost*10, unit_price=unit_price*10;
alter table job_catalog drop constraint if exists job_catalog_reward_check;
update job_catalog set reward=reward*10;
alter table job_catalog add constraint job_catalog_reward_check check(reward between 1000 and 10000);
alter table home_backgrounds drop constraint if exists home_backgrounds_welcome_check;
alter table home_backgrounds drop constraint if exists home_backgrounds_weekly_check;
update home_backgrounds set welcome=welcome*10, weekly=weekly*10;
alter table home_backgrounds add constraint home_backgrounds_welcome_check check(welcome between 0 and 50000);
alter table home_backgrounds add constraint home_backgrounds_weekly_check check(weekly between 0 and 50000);
alter table daily_goal_catalog drop constraint if exists daily_goal_catalog_reward_check;
update daily_goal_catalog set reward=reward*10;
alter table daily_goal_catalog add constraint daily_goal_catalog_reward_check check(reward between 0 and 3000);
alter table keke_tickets drop constraint if exists keke_tickets_fare_check;
alter table keke_tickets add constraint keke_tickets_fare_check check(fare between 30 and 1200) not valid;

-- 3. Amounts written inside functions.
alter table wallets alter column balance set default 15000.00;
select pg_temp.patch('public.ensure_player_wallet(uuid)', '7500.00', '15000.00', 3);
select pg_temp.patch('public.claim_daily_reward(uuid)', ':= 500.00', ':= 3000.00');
select pg_temp.patch('public.claim_lecture_attendance(text,integer,numeric,uuid)', ':= 100.00', ':= 1000.00');
select pg_temp.patch('public.job_action_trusted(uuid,text,text,uuid,numeric,numeric)', 'v_bonus := 200;', 'v_bonus := 2000;');
select pg_temp.patch('public.ps_reward_trusted(text,uuid,uuid,uuid)', 'then 150 when ''win'' then 250 else 100', 'then 1500 when ''win'' then 2500 else 1000');
select pg_temp.patch('public.hostel_command_pre008(text,jsonb,uuid)', '>1500 then raise exception ''Game credit limit is ₦1,500''', '>15000 then raise exception ''Game credit limit is ₦15,000''');
select pg_temp.patch('public.hostel_command(text,jsonb,uuid)', 'cost:=5000;', 'cost:=50000;');
select pg_temp.patch('public.pay_hustle(uuid,text,text,integer,text,interval)', '2500-hustle_paid_today', '25000-hustle_paid_today');
select pg_temp.patch('public.pay_hustle(uuid,text,text,integer,text,interval)', '(₦2,500)', '(₦25,000)');
select pg_temp.patch('public.shop_state_for(uuid)', '''daily_cap'',2500', '''daily_cap'',25000');
select pg_temp.patch('public.collect_shop()', '2500-hustle_paid_today', '25000-hustle_paid_today');
select pg_temp.patch('public.tutoring_submit_trusted(uuid,uuid,jsonb)', 'v_score*80', 'v_score*800');
select pg_temp.patch('public.hustle_pay_trusted(uuid,text,text,integer)', 'p_amount<>250', 'p_amount<>2500');
select pg_temp.patch('public.hustle_pay_trusted(uuid,text,text,integer)', 'p_ref,250,', 'p_ref,2500,');
select pg_temp.patch('public.hustle_pay_trusted(uuid,text,text,integer)', 'not in(100,200,300,400)', 'not in(1000,2000,3000,4000)');
select pg_temp.patch('public.hustle_pay_trusted(uuid,text,text,integer)', 'p_amount<>300', 'p_amount<>3000');
select pg_temp.patch('public.hustle_pay_trusted(uuid,text,text,integer)', 'p_ref,300,', 'p_ref,3000,');
select pg_temp.patch('public.post_errand(text,integer)', 'p_reward<50 or p_reward>1000 then raise exception ''Reward must be ₦50–₦1,000''', 'p_reward<500 or p_reward>10000 then raise exception ''Reward must be ₦500–₦10,000''');
select pg_temp.patch('public.lodge_state_for(uuid,boolean)', '''rent'',2000', '''rent'',5000');
select pg_temp.patch('public.lodge_charge(uuid,text)', '2000', '5000', 3);
select pg_temp.patch('public.lodge_charge(uuid,text)', '₦2,000', '₦5,000');
select pg_temp.patch('public.party_entry_trusted(uuid)', '500', '5000', 5);
select pg_temp.patch('public.party_entry_trusted(uuid)', '₦5000', '₦5,000');
select pg_temp.patch('public.sug_nominate(text)', '1000', '10000', 3);
select pg_temp.patch('public.sug_nominate(text)', '₦1,000', '₦10,000');
select pg_temp.patch('public.keke_reserve_trusted(uuid,uuid,text,integer)', 'not between 30 and 120', 'not between 300 and 1200');
select pg_temp.patch('public.campus_bet_place_trusted(uuid,uuid,integer,jsonb)', 'p_stake<50 or p_stake>500 or p_stake%10<>0 then raise exception ''Stake must be ₦50–₦500 in ₦10 steps''', 'p_stake<500 or p_stake>5000 or p_stake%100<>0 then raise exception ''Stake must be ₦500–₦5,000 in ₦100 steps''');
select pg_temp.patch('public.daily_plan_for(uuid)', '''all_done_bonus'',150', '''all_done_bonus'',1500');
select pg_temp.patch('public.claim_daily_goal(text)', 'v_bonus := 150;', 'v_bonus := 1500;');
select pg_temp.patch('public.transfer_money_p2p(text,numeric,text,uuid)', 'p_amount > 50000', 'p_amount > 500000');
select pg_temp.patch('public.transfer_money_p2p(text,numeric,text,uuid)', 'Max ₦50,000', 'Max ₦500,000');

commit;
