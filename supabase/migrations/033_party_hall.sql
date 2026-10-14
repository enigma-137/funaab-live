-- 033: The Arena, the night party & arcade hall. Apply once AFTER 032.
-- A ₦500 ticket covers one night (19:00–05:00 Lagos). Only the Worker sells it, after checking
-- you are at the door while the hall is open; buying again the same night costs nothing.
-- The Arena bar sells drinks through the timed food vendors (011), open across midnight.
-- XP: a night out (ticket) and arcade games (tic-tac-toe, pool) join the activity levels (031).
-- Mirrors src/config/partyHall.ts, src/config/foodVendors.ts and src/config/levels.ts.
begin;

create table public.party_tickets(
 user_id uuid not null references public.profiles(id) on delete cascade,
 night date not null, paid integer not null check(paid>0), created_at timestamptz not null default now(),
 primary key(user_id,night)
);
alter table public.party_tickets enable row level security;
revoke all on public.party_tickets from anon,authenticated;

-- 19:00 tonight to 05:00 tomorrow is one night, dated by its evening.
create or replace function public.party_night(p_at timestamptz default now()) returns date
language sql stable as $$ select ((p_at at time zone 'Africa/Lagos') - interval '12 hours')::date $$;
create or replace function public.party_open(p_at timestamptz default now()) returns boolean
language sql stable as $$ select extract(hour from (p_at at time zone 'Africa/Lagos')) >= 19
 or extract(hour from (p_at at time zone 'Africa/Lagos')) < 5 $$;

create or replace function public.party_entry_trusted(p_user uuid) returns jsonb
language plpgsql security definer set search_path=public as $$
declare v_night date := party_night(); b numeric;
begin
 if not party_open() then raise exception 'The Arena opens at 7 PM.'; end if;
 perform 1 from profiles where id=p_user for update;
 if not found then raise exception 'Profile missing'; end if;
 if exists(select 1 from party_tickets where user_id=p_user and night=v_night) then
  return jsonb_build_object('night',v_night,'charged',false);
 end if;
 update wallets set balance=balance-500,updated_at=now() where user_id=p_user and balance>=500 returning balance into b;
 if b is null then raise exception 'The gate fee is ₦500. Top up your wallet first.'; end if;
 insert into party_tickets(user_id,night,paid) values(p_user,v_night,500);
 insert into wallet_transactions(user_id,type,amount,balance_after,description,metadata)
  values(p_user,'party_ticket',-500,b,'The Arena gate fee',jsonb_build_object('night',v_night));
 return jsonb_build_object('night',v_night,'charged',true,'balance',b);
end $$;

-- The Arena bar (inside the hall; open 19:00–24:00 and 00:00–05:00).
insert into public.food_vendors values ('party_bar','Arena Bar','The Arena bar opens at 7 PM.')
 on conflict(id) do update set name=excluded.name, closed_message=excluded.closed_message;
insert into public.food_vendor_hours values ('party_bar','00:00','05:00'),('party_bar','19:00','24:00')
 on conflict do nothing;
insert into public.food_vendor_items values
 ('vendor_party_zobo','party_bar','Chilled Zobo',300),
 ('vendor_party_soda','party_bar','Soft drink',250),
 ('vendor_party_malt','party_bar','Malt',400),
 ('vendor_party_chapman','party_bar','Chapman',500),
 ('vendor_party_energy','party_bar','Energy drink',450)
on conflict(id) do update set vendor_id=excluded.vendor_id, name=excluded.name, price=excluded.price;

-- XP for a night out and for arcade games.
create or replace function public.xp_amount(p_source text) returns integer language sql immutable as $$
 select case p_source
  when 'campus_job' then 20 when 'hustle_pay' then 15 when 'errand_pay' then 8
  when 'lecture_attendance' then 10 when 'daily_goal' then 10 when 'daily_plan_bonus' then 25
  when 'daily_reward' then 5 when 'home_allowance' then 10 when 'food_purchase' then 3
  when 'keke_fare' then 4 when 'hostel_purchase' then 5 when 'hostel_makeover' then 5
  when 'hostel_expand' then 30 when 'lodge_rent' then 10 when 'game_den' then 10
  when 'football_win' then 15 when 'court_match' then 5 when 'court_win' then 12
  when 'rally_match' then 5 when 'rally_win' then 15
  when 'party_ticket' then 10 when 'arcade_match' then 4 when 'arcade_win' then 8 else 0 end $$;

create or replace function public.xp_event_trusted(p_user uuid,p_source text,p_ref text) returns integer
language plpgsql security definer set search_path=public as $$
begin
 if p_source not in('court_match','court_win','rally_match','rally_win','arcade_match','arcade_win') then raise exception 'Unknown XP source'; end if;
 if p_ref is null or length(p_ref) not between 1 and 96 then raise exception 'Invalid reference'; end if;
 return award_xp(p_user,p_source,p_ref);
end $$;

revoke all on function public.party_entry_trusted(uuid),public.party_night(timestamptz),public.party_open(timestamptz) from public,anon,authenticated;
grant execute on function public.party_entry_trusted(uuid) to service_role;
revoke all on function public.xp_amount(text),public.xp_event_trusted(uuid,text,text) from public,anon,authenticated;
grant execute on function public.xp_event_trusted(uuid,text,text) to service_role;

commit;
