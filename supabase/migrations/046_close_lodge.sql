-- 046: The off-campus lodge closes; Royal Gardens Estate (044) replaces it. Apply once AFTER 045
-- (safe to re-run). Anyone still renting moves back to their hostel room (furniture kept) and is
-- refunded for the days already paid but not used. Renting or paying for the lodge is refused.
begin;

-- Refund unused paid time, pro rata of ₦5,000 a week, rounded down to the naira.
with t as (
  select user_id, floor(5000 * extract(epoch from (paid_until - now())) / (7 * 86400))::numeric as refund
  from lodge_tenancies where paid_until > now()
), w as (
  update wallets set balance = balance + t.refund, updated_at = now()
  from t where wallets.user_id = t.user_id and t.refund > 0
  returning wallets.user_id, t.refund, wallets.balance
)
insert into wallet_transactions(user_id,type,amount,balance_after,description)
select user_id,'lodge_refund',refund,balance,'Lodge closed: refund for unused days' from w;

update hostel_rooms set style='resumption' where style='lodge';
delete from lodge_tenancies;

create or replace function public.rent_lodge() returns jsonb
language plpgsql security definer set search_path=public as $$
begin
 raise exception 'The lodge has closed. Rent a room at Royal Gardens Estate (Phone → Estate).';
end $$;
create or replace function public.pay_lodge_rent() returns jsonb
language plpgsql security definer set search_path=public as $$
begin
 raise exception 'The lodge has closed. Rent a room at Royal Gardens Estate (Phone → Estate).';
end $$;
-- "Lives off campus" on a student's profile now means the estate.
create or replace function public.lodge_public(p_user uuid) returns boolean
language sql stable security definer set search_path=public as $$
 select exists(select 1 from estate_tenancies where user_id=p_user and now()<=paid_until) $$;
commit;
