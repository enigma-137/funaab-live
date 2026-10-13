-- 019 Off-campus lodge: rent a self-contain outside the main gate.
-- Additive only. Values mirror src/config/lodge.ts (scripts/test-lodge-db.ts checks drift).
-- The lodge is your existing room restyled (hostel_rooms.style = 'lodge'), so furniture, privacy
-- and invites carry over unchanged. Rent is ₦2,000 a week, payable up to 2 weeks ahead. Past the
-- paid week plus a 2-day grace period you move back to the free hostel room (furniture kept).

create table public.lodge_tenancies(
 user_id uuid primary key references public.profiles(id) on delete cascade,
 started_at timestamptz not null default now(),
 paid_until timestamptz not null
);
alter table public.lodge_tenancies enable row level security;
revoke all on public.lodge_tenancies from anon,authenticated;

-- Ends an overdue tenancy. Returns true if the student was moved back to the hostel.
create or replace function public.lodge_settle(p_user uuid) returns boolean
language plpgsql security definer set search_path=public as $$
declare t lodge_tenancies;
begin
 select * into t from lodge_tenancies where user_id=p_user for update;
 if not found or now() <= t.paid_until+interval '2 days' then return false; end if;
 delete from lodge_tenancies where user_id=p_user;
 update hostel_rooms set style='resumption' where owner_id=p_user;
 return true;
end $$;

create or replace function public.lodge_state_for(p_user uuid,p_evicted boolean default false) returns jsonb
language plpgsql stable security definer set search_path=public as $$
declare t lodge_tenancies;
begin
 select * into t from lodge_tenancies where user_id=p_user;
 return jsonb_build_object('renting',found,'rent',2000,'grace_days',2,'capacity',case when found then 8 else 5 end,
  'paid_until',t.paid_until,'grace_until',t.paid_until+interval '2 days','overdue',found and now()>t.paid_until,
  'can_prepay',found and t.paid_until-now() <= interval '7 days','just_evicted',p_evicted);
end $$;
create or replace function public.lodge_state() returns jsonb language plpgsql security definer set search_path=public as $$
declare u uuid := auth.uid(); v_evicted boolean;
begin
 if u is null then raise exception 'Authentication required'; end if;
 v_evicted := lodge_settle(u);
 return lodge_state_for(u,v_evicted);
end $$;

create or replace function public.lodge_charge(p_user uuid,p_note text) returns numeric
language plpgsql security definer set search_path=public as $$
declare b numeric;
begin
 perform ensure_player_wallet(p_user);
 select balance into b from wallets where user_id=p_user for update;
 if b<2000 then raise exception 'Rent is ₦2,000. Top up your wallet first.'; end if;
 update wallets set balance=balance-2000,updated_at=now() where user_id=p_user returning balance into b;
 insert into wallet_transactions(user_id,type,amount,balance_after,description) values(p_user,'lodge_rent',-2000,b,p_note);
 return b;
end $$;

create or replace function public.rent_lodge() returns jsonb
language plpgsql security definer set search_path=public as $$
declare u uuid := auth.uid(); b numeric;
begin
 if u is null then raise exception 'Authentication required'; end if;
 perform 1 from profiles where id=u for update;
 perform lodge_settle(u);
 if exists(select 1 from lodge_tenancies where user_id=u) then raise exception 'You already rent a lodge'; end if;
 if not exists(select 1 from hostel_rooms where owner_id=u) then raise exception 'Room not found'; end if;
 b := lodge_charge(u,'Lodge rent: first week');
 insert into lodge_tenancies(user_id,paid_until) values(u,now()+interval '7 days');
 update hostel_rooms set style='lodge' where owner_id=u;
 return lodge_state_for(u)||jsonb_build_object('balance',b);
end $$;

create or replace function public.pay_lodge_rent() returns jsonb
language plpgsql security definer set search_path=public as $$
declare u uuid := auth.uid(); t lodge_tenancies; b numeric;
begin
 if u is null then raise exception 'Authentication required'; end if;
 perform 1 from profiles where id=u for update;
 if lodge_settle(u) then raise exception 'Your tenancy ended. Rent the lodge again to move back.'; end if;
 select * into t from lodge_tenancies where user_id=u for update;
 if not found then raise exception 'You don''t rent a lodge'; end if;
 -- At most two weeks ahead: pay only while no more than one week is still prepaid.
 if t.paid_until-now() > interval '7 days' then raise exception 'Rent is already paid two weeks ahead'; end if;
 b := lodge_charge(u,'Lodge rent: one week');
 update lodge_tenancies set paid_until=greatest(paid_until,now())+interval '7 days' where user_id=u;
 return lodge_state_for(u)||jsonb_build_object('balance',b);
end $$;

create or replace function public.leave_lodge() returns jsonb
language plpgsql security definer set search_path=public as $$
declare u uuid := auth.uid();
begin
 if u is null then raise exception 'Authentication required'; end if;
 delete from lodge_tenancies where user_id=u;
 update hostel_rooms set style='resumption' where owner_id=u;
 return lodge_state_for(u);
end $$;

-- Worker: how many people may be inside this student's room right now.
create or replace function public.room_capacity_trusted(p_owner uuid) returns integer
language plpgsql security definer set search_path=public as $$
begin
 perform lodge_settle(p_owner);
 return case when exists(select 1 from lodge_tenancies where user_id=p_owner) then 8 else 5 end;
end $$;

-- Public: whether someone lives off campus (no dates, no money).
create or replace function public.lodge_public(p_user uuid) returns boolean
language sql stable security definer set search_path=public as $$
 select exists(select 1 from lodge_tenancies where user_id=p_user and now()<=paid_until+interval '2 days') $$;

revoke all on function public.lodge_settle(uuid),public.lodge_state_for(uuid,boolean),public.lodge_charge(uuid,text),public.room_capacity_trusted(uuid) from public,anon,authenticated;
grant execute on function public.room_capacity_trusted(uuid) to service_role;
revoke all on function public.lodge_state(),public.rent_lodge(),public.pay_lodge_rent(),public.leave_lodge(),public.lodge_public(uuid) from public,anon;
grant execute on function public.lodge_state(),public.rent_lodge(),public.pay_lodge_rent(),public.leave_lodge(),public.lodge_public(uuid) to authenticated;
