-- 017 Home background: comfortable / average / struggling. Chosen once, private to the student.
-- Additive only. Values mirror src/config/backgrounds.ts (scripts/test-backgrounds-db.ts checks drift).
--  * Choosing pays a one-off welcome from home.
--  * Money from home arrives every Sunday (Lagos); collect it once any day that Sunday–Saturday week.
--  * Hustle bonus: a trigger adds +N% of every job/hustle payment as its own ledger line, so the
--    existing job payout function is untouched and future hustle types get it automatically.

create table public.home_backgrounds(
 id text primary key, title text not null, welcome integer not null check(welcome between 0 and 5000),
 weekly integer not null check(weekly between 0 and 5000), hustle_bonus_percent integer not null check(hustle_bonus_percent between 0 and 50)
);
insert into public.home_backgrounds values
 ('comfortable','Comfortable home',3000,2500,0),
 ('average','Average home',1000,1200,10),
 ('struggling','Struggling home',0,400,20);

create table public.student_backgrounds(
 user_id uuid primary key references public.profiles(id) on delete cascade,
 background text not null references public.home_backgrounds(id),
 chosen_at timestamptz not null default now(),
 last_allowance_week integer
);

alter table public.home_backgrounds enable row level security;
alter table public.student_backgrounds enable row level security;
revoke all on public.home_backgrounds,public.student_backgrounds from anon,authenticated;
grant select on public.home_backgrounds to anon,authenticated;
grant select on public.student_backgrounds to authenticated;
create policy home_backgrounds_read on public.home_backgrounds for select using(true);
-- Private: only you can see your own background.
create policy student_backgrounds_own on public.student_backgrounds for select using(user_id=auth.uid());

-- Week 0 starts Sunday 4 January 2026 (Lagos): money from home lands on Sundays.
create or replace function public.home_week(p_day date) returns integer language sql immutable as $$
 select floor((p_day - date '2026-01-04')::numeric / 7)::integer $$;

create or replace function public.background_state_for(p_user uuid) returns jsonb
language plpgsql stable security definer set search_path=public as $$
declare s student_backgrounds; h home_backgrounds; v_week integer := home_week(lagos_today());
begin
 select * into s from student_backgrounds where user_id=p_user;
 if not found then return jsonb_build_object('chosen',false); end if;
 select * into h from home_backgrounds where id=s.background;
 return jsonb_build_object('chosen',true,'background',s.background,'title',h.title,'weekly',h.weekly,
  'hustle_bonus_percent',h.hustle_bonus_percent,'allowance_ready',s.last_allowance_week is distinct from v_week and h.weekly>0,
  'next_allowance_at',((date '2026-01-04' + (v_week+1)*7)::timestamp at time zone 'Africa/Lagos'));
end $$;
create or replace function public.background_state() returns jsonb
language plpgsql stable security definer set search_path=public as $$
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 return background_state_for(auth.uid());
end $$;

create or replace function public.choose_background(p_background text) returns jsonb
language plpgsql security definer set search_path=public as $$
declare u uuid := auth.uid(); h home_backgrounds; b numeric;
begin
 if u is null then raise exception 'Authentication required'; end if;
 perform 1 from profiles where id=u for update;
 select * into h from home_backgrounds where id=p_background;
 if not found then raise exception 'Choose comfortable, average or struggling'; end if;
 if exists(select 1 from student_backgrounds where user_id=u) then raise exception 'Your background is already set'; end if;
 perform ensure_player_wallet(u);
 -- This week's money from home is included in the welcome, so it starts next Sunday.
 insert into student_backgrounds(user_id,background,last_allowance_week) values(u,p_background,home_week(lagos_today()));
 select balance into b from wallets where user_id=u for update;
 if h.welcome>0 then
  update wallets set balance=balance+h.welcome,updated_at=now() where user_id=u returning balance into b;
  insert into wallet_transactions(user_id,type,amount,balance_after,description,metadata)
   values(u,'home_welcome',h.welcome,b,'Resumption money from home',jsonb_build_object('background',p_background));
 end if;
 return background_state_for(u)||jsonb_build_object('balance',b,'paid',h.welcome);
end $$;

create or replace function public.claim_home_allowance() returns jsonb
language plpgsql security definer set search_path=public as $$
declare u uuid := auth.uid(); s student_backgrounds; h home_backgrounds; b numeric; v_week integer := home_week(lagos_today());
begin
 if u is null then raise exception 'Authentication required'; end if;
 select * into s from student_backgrounds where user_id=u for update;
 if not found then raise exception 'Tell us where you are from first'; end if;
 select * into h from home_backgrounds where id=s.background;
 if s.last_allowance_week=v_week or h.weekly<=0 then
  return background_state_for(u)||jsonb_build_object('paid',0,'balance',(select balance from wallets where user_id=u));
 end if;
 update student_backgrounds set last_allowance_week=v_week where user_id=u;
 update wallets set balance=balance+h.weekly,updated_at=now() where user_id=u returning balance into b;
 if b is null then raise exception 'Open your wallet first'; end if;
 insert into wallet_transactions(user_id,type,amount,balance_after,description,metadata)
  values(u,'home_allowance',h.weekly,b,'Money from home',jsonb_build_object('week',v_week,'background',s.background));
 return background_state_for(u)||jsonb_build_object('paid',h.weekly,'balance',b);
end $$;

-- Hustle bonus on job/hustle pay. Runs inside the payer's transaction; the bonus row has its own
-- type, so it never triggers itself.
create or replace function public.hustle_bonus_trigger() returns trigger
language plpgsql security definer set search_path=public as $$
declare v_pct integer; v_bonus integer; b numeric;
begin
 if new.type not in('campus_job','hustle_pay') or new.amount<=0 then return new; end if;
 select h.hustle_bonus_percent into v_pct from student_backgrounds s join home_backgrounds h on h.id=s.background where s.user_id=new.user_id;
 if coalesce(v_pct,0)<=0 then return new; end if;
 v_bonus := floor(new.amount*v_pct/100.0);
 if v_bonus<=0 then return new; end if;
 update wallets set balance=balance+v_bonus,updated_at=now() where user_id=new.user_id returning balance into b;
 insert into wallet_transactions(user_id,type,amount,balance_after,description,metadata)
  values(new.user_id,'hustle_bonus',v_bonus,b,'Hustle bonus (+'||v_pct||'%)',jsonb_build_object('for',new.id));
 return new;
end $$;
create trigger hustle_bonus after insert on public.wallet_transactions for each row execute function public.hustle_bonus_trigger();

revoke all on function public.home_week(date),public.background_state_for(uuid),public.hustle_bonus_trigger() from public,anon,authenticated;
revoke all on function public.background_state(),public.choose_background(text),public.claim_home_allowance() from public,anon;
grant execute on function public.background_state(),public.choose_background(text),public.claim_home_allowance() to authenticated;
