-- 044: Royal Gardens Estate. Apply once AFTER 043 (safe to re-run).
-- Rent an estate room for ₦10,000 a week (up to 2 weeks ahead). Your room moves there
-- (hostel_rooms.style = 'estate'): it is large-size while you rent and hosts up to 11 guests.
-- When the paid time runs out you move back to the hostel straight away; furniture that only fits
-- the big room goes back into your bag. You can't rent the lodge and the estate at the same time.
-- Mirrors src/config/estate.ts (scripts/test-estate-db.ts checks drift).
begin;

create table if not exists public.estate_tenancies(
 user_id uuid primary key references public.profiles(id) on delete cascade,
 started_at timestamptz not null default now(),
 paid_until timestamptz not null
);
alter table public.estate_tenancies enable row level security;
revoke all on public.estate_tenancies from anon,authenticated;

-- Ends an expired tenancy. Returns true if the student was moved back to the hostel.
create or replace function public.estate_settle(p_user uuid) returns boolean
language plpgsql security definer set search_path=public as $$
declare t estate_tenancies; v_size text;
begin
 select * into t from estate_tenancies where user_id=p_user for update;
 if not found or now() <= t.paid_until then return false; end if;
 delete from estate_tenancies where user_id=p_user;
 update hostel_rooms set style='resumption' where owner_id=p_user returning room_size into v_size;
 -- Back in a standard room: anything placed beyond its walls returns to the inventory.
 if coalesce(v_size,'standard')<>'large' then
  delete from room_placements p where p.owner_id=p_user and abs(p.x)+(hostel_extent(p.item_id,p.rotation))[1]>3.8;
 end if;
 return true;
end $$;

create or replace function public.estate_state_for(p_user uuid,p_evicted boolean default false) returns jsonb
language plpgsql stable security definer set search_path=public as $$
declare t estate_tenancies;
begin
 select * into t from estate_tenancies where user_id=p_user;
 return jsonb_build_object('renting',found,'rent',10000,'capacity',case when found then 12 else 5 end,
  'paid_until',t.paid_until,'can_prepay',found and t.paid_until-now() <= interval '7 days',
  'lodge',exists(select 1 from lodge_tenancies where user_id=p_user),'just_evicted',p_evicted);
end $$;

create or replace function public.estate_state() returns jsonb language plpgsql security definer set search_path=public as $$
declare u uuid := auth.uid(); v_evicted boolean;
begin
 if u is null then raise exception 'Authentication required'; end if;
 v_evicted := estate_settle(u);
 return estate_state_for(u,v_evicted);
end $$;

create or replace function public.estate_charge(p_user uuid,p_note text) returns numeric
language plpgsql security definer set search_path=public as $$
declare b numeric;
begin
 perform ensure_player_wallet(p_user);
 select balance into b from wallets where user_id=p_user for update;
 if b<10000 then raise exception 'Estate rent is ₦10,000 a week. Top up your wallet first.'; end if;
 update wallets set balance=balance-10000,updated_at=now() where user_id=p_user returning balance into b;
 insert into wallet_transactions(user_id,type,amount,balance_after,description) values(p_user,'estate_rent',-10000,b,p_note);
 return b;
end $$;

create or replace function public.rent_estate() returns jsonb
language plpgsql security definer set search_path=public as $$
declare u uuid := auth.uid(); b numeric;
begin
 if u is null then raise exception 'Authentication required'; end if;
 perform 1 from profiles where id=u for update;
 perform estate_settle(u);
 perform lodge_settle(u);
 if exists(select 1 from estate_tenancies where user_id=u) then raise exception 'You already rent an estate room'; end if;
 if exists(select 1 from lodge_tenancies where user_id=u) then raise exception 'Move out of the lodge first (Phone → Lodge)'; end if;
 if not exists(select 1 from hostel_rooms where owner_id=u) then raise exception 'Room not found'; end if;
 b := estate_charge(u,'Royal Gardens Estate: first week');
 insert into estate_tenancies(user_id,paid_until) values(u,now()+interval '7 days');
 update hostel_rooms set style='estate' where owner_id=u;
 return estate_state_for(u)||jsonb_build_object('balance',b);
end $$;

create or replace function public.pay_estate_rent() returns jsonb
language plpgsql security definer set search_path=public as $$
declare u uuid := auth.uid(); t estate_tenancies; b numeric;
begin
 if u is null then raise exception 'Authentication required'; end if;
 perform 1 from profiles where id=u for update;
 if estate_settle(u) then raise exception 'Your week ended and you moved back to the hostel. Rent again to return.'; end if;
 select * into t from estate_tenancies where user_id=u for update;
 if not found then raise exception 'You don''t rent an estate room'; end if;
 if t.paid_until-now() > interval '7 days' then raise exception 'Rent is already paid two weeks ahead'; end if;
 b := estate_charge(u,'Royal Gardens Estate: one week');
 update estate_tenancies set paid_until=paid_until+interval '7 days' where user_id=u;
 return estate_state_for(u)||jsonb_build_object('balance',b);
end $$;

create or replace function public.leave_estate() returns jsonb
language plpgsql security definer set search_path=public as $$
declare u uuid := auth.uid();
begin
 if u is null then raise exception 'Authentication required'; end if;
 -- Moving out ends the tenancy now; settle does the move (and the furniture check).
 update estate_tenancies set paid_until=now()-interval '1 second' where user_id=u;
 perform estate_settle(u);
 return estate_state_for(u);
end $$;

-- Worker: how many people may be inside this student's room right now (lodge 8, estate 12).
create or replace function public.room_capacity_trusted(p_owner uuid) returns integer
language plpgsql security definer set search_path=public as $$
begin
 perform lodge_settle(p_owner);
 perform estate_settle(p_owner);
 return case when exists(select 1 from estate_tenancies where user_id=p_owner) then 12
  when exists(select 1 from lodge_tenancies where user_id=p_owner) then 8 else 5 end;
end $$;

-- Function edits, applied only if not already there (so the file can be re-run).
create or replace function pg_temp.patch044(p_fn text, p_old text, p_new text) returns void language plpgsql as $$
declare d text := pg_get_functiondef(p_fn::regprocedure);
begin
 if position(p_new in d)>0 then return; end if;
 if (length(d)-length(replace(d,p_old,'')))/length(p_old)<>1 then raise exception '044: % does not contain "%" exactly once',p_fn,p_old; end if;
 execute replace(d,p_old,p_new);
end $$;
-- An estate room is big while you rent it.
select pg_temp.patch044('public.hostel_command(text,jsonb,uuid)',
 'lim:=case when room.room_size=''large'' then 5.3 else 3.8 end;',
 'lim:=case when room.room_size=''large'' or (room.style=''estate'' and exists(select 1 from estate_tenancies et where et.user_id=u and et.paid_until>=now())) then 5.3 else 3.8 end;');
-- One home at a time: no lodge while you rent at the estate.
select pg_temp.patch044('public.rent_lodge()',
 'then raise exception ''You already rent a lodge''; end if;',
 'then raise exception ''You already rent a lodge''; end if;
 perform estate_settle(u);
 if exists(select 1 from estate_tenancies where user_id=u) then raise exception ''You rent at Royal Gardens Estate. Move out there first.''; end if;');
-- Renting at the estate earns XP like the lodge does.
select pg_temp.patch044('public.xp_amount(text)', 'when ''lodge_rent'' then 10', 'when ''lodge_rent'' then 10 when ''estate_rent'' then 15');

revoke all on function public.estate_settle(uuid),public.estate_state_for(uuid,boolean),public.estate_charge(uuid,text),public.room_capacity_trusted(uuid) from public,anon,authenticated;
grant execute on function public.room_capacity_trusted(uuid) to service_role;
revoke all on function public.estate_state(),public.rent_estate(),public.pay_estate_rent(),public.leave_estate() from public,anon;
grant execute on function public.estate_state(),public.rent_estate(),public.pay_estate_rent(),public.leave_estate() to authenticated;
commit;
