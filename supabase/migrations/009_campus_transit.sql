-- Apply after 008. No existing progression, inventory, or room rows are replaced.
begin;
update public.job_catalog set source_x=-26,source_z=-16,dest_x=80,dest_z=-57 where id='job-food-delivery';
update public.job_catalog set source_x=-78,source_z=-22,dest_x=0,dest_z=-96 where id='job-medical-errand';
update public.job_catalog set source_x=-80,source_z=5,dest_x=-100,dest_z=12 where id='job-sports-cones';
update public.job_catalog set source_x=82,source_z=10,dest_x=86,dest_z=10 where id='job-game-den';

create table public.keke_tickets(
 id uuid primary key, user_id uuid not null references public.profiles(id),
 destination text not null, fare integer not null check(fare between 30 and 120),
 status text not null default 'reserved' check(status in('reserved','completed','refunded')),
 created_at timestamptz not null default now()
);
create unique index one_reserved_keke_ticket on public.keke_tickets(user_id) where status='reserved';
alter table public.keke_tickets enable row level security;
create policy "Read own Keke receipts" on public.keke_tickets for select to authenticated using(auth.uid()=user_id);
grant select on public.keke_tickets to authenticated;

create function public.keke_reserve_trusted(p_ticket uuid,p_user uuid,p_destination text,p_fare integer)
returns jsonb language plpgsql security definer set search_path=public as $$
declare b numeric; receipt keke_tickets;
begin
 select balance into b from wallets where user_id=p_user for update;
 if not found then raise exception 'Wallet unavailable'; end if;
 select * into receipt from keke_tickets where id=p_ticket;
 if found then
   if receipt.user_id<>p_user or receipt.status<>'reserved' or receipt.fare<>p_fare or receipt.destination<>p_destination then raise exception 'Ride receipt already used'; end if;
   return jsonb_build_object('balance',b);
 end if;
 if p_fare is null or p_fare not between 30 and 120 then raise exception 'Invalid fare'; end if;
 if b<p_fare then raise exception 'Insufficient balance'; end if;
 insert into keke_tickets(id,user_id,destination,fare) values(p_ticket,p_user,p_destination,p_fare);
 b:=b-p_fare;
 update wallets set balance=b,updated_at=now() where user_id=p_user;
 insert into wallet_transactions(user_id,type,amount,balance_after,description,metadata) values(p_user,'keke_fare',-p_fare,b,'Campus Keke: '||p_destination,jsonb_build_object('ticket',p_ticket));
 return jsonb_build_object('balance',b);
end $$;
create function public.keke_settle_trusted(p_ticket uuid,p_action text)
returns void language plpgsql security definer set search_path=public as $$
declare receipt keke_tickets; b numeric;
begin
 if p_action not in('complete','refund') then raise exception 'Invalid settlement'; end if;
 select * into receipt from keke_tickets where id=p_ticket for update;
 if not found or receipt.status<>'reserved' then return; end if;
 if p_action='refund' then
   update wallets set balance=balance+receipt.fare,updated_at=now() where user_id=receipt.user_id returning balance into b;
   insert into wallet_transactions(user_id,type,amount,balance_after,description,metadata) values(receipt.user_id,'keke_refund',receipt.fare,b,'Interrupted Keke ride refunded',jsonb_build_object('ticket',p_ticket));
 end if;
 update keke_tickets set status=case when p_action='complete' then 'completed' else 'refunded' end where id=p_ticket;
end $$;
revoke all on function public.keke_reserve_trusted(uuid,uuid,text,integer) from public,anon,authenticated;
revoke all on function public.keke_settle_trusted(uuid,text) from public,anon,authenticated;
grant execute on function public.keke_reserve_trusted(uuid,uuid,text,integer) to service_role;
grant execute on function public.keke_settle_trusted(uuid,text) to service_role;
commit;
