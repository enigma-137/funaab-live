-- 019 Hustles: room shop, POS kiosk shifts, Library tutoring, photo shoots, player errands.
-- Additive only. Values mirror src/config/hustles.ts (scripts/test-hustles-db.ts checks drift).
-- Shop, POS, tutoring and photos pay 'hustle_pay' (earns the 018 hustle bonus) under one daily cap.
-- POS, tutoring and photos are paid only by the Worker (service role) after it proves presence
-- or time. Errands move escrowed money between students as 'errand_pay', which never earns a
-- bonus (so two accounts cannot mint money by passing errands back and forth).

-- ---------- Shared payout: daily cap, per-hustle cooldown, idempotent reference ----------
create table public.hustle_payments(
 user_id uuid not null references public.profiles(id) on delete cascade, hustle text not null,
 ref text not null, amount integer not null check(amount>0), created_at timestamptz not null default now(),
 primary key(user_id,hustle,ref)
);
create index hustle_payments_day on public.hustle_payments(user_id,created_at);
alter table public.hustle_payments enable row level security;
revoke all on public.hustle_payments from anon,authenticated;

create or replace function public.hustle_paid_today(p_user uuid) returns integer
language sql stable security definer set search_path=public as $$
 select coalesce(sum(amount),0)::integer from hustle_payments where user_id=p_user
  and created_at>=(lagos_today()::timestamp at time zone 'Africa/Lagos') $$;

-- Pays min(amount, what's left of today's cap). Returns what was actually paid (0 if capped).
create or replace function public.pay_hustle(p_user uuid,p_hustle text,p_ref text,p_amount integer,p_title text,p_cooldown interval default null)
returns integer language plpgsql security definer set search_path=public as $$
declare v_pay integer; b numeric;
begin
 perform 1 from profiles where id=p_user for update;
 if exists(select 1 from hustle_payments where user_id=p_user and hustle=p_hustle and ref=p_ref) then return 0; end if;
 if p_cooldown is not null and exists(select 1 from hustle_payments where user_id=p_user and hustle=p_hustle and created_at>now()-p_cooldown) then
  raise exception 'Take a short break before the next one';
 end if;
 v_pay := least(p_amount, greatest(0, 2500-hustle_paid_today(p_user)));
 if v_pay<=0 then raise exception 'You have hit today''s hustle limit (₦2,500). Come back tomorrow.'; end if;
 insert into hustle_payments(user_id,hustle,ref,amount) values(p_user,p_hustle,p_ref,v_pay);
 update wallets set balance=balance+v_pay,updated_at=now() where user_id=p_user returning balance into b;
 if b is null then raise exception 'Open your wallet first'; end if;
 insert into wallet_transactions(user_id,type,amount,balance_after,description,metadata)
  values(p_user,'hustle_pay',v_pay,b,p_title,jsonb_build_object('hustle',p_hustle,'ref',p_ref));
 return v_pay;
end $$;

-- ---------- 1. Room shop ----------
create table public.shop_stock_catalog(id text primary key, title text not null, cost integer not null, units integer not null, unit_price integer not null);
insert into public.shop_stock_catalog values ('snacks','Snack carton',600,10,90),('data','Data bundle cards',1000,10,130);
alter table public.shop_stock_catalog enable row level security;
grant select on public.shop_stock_catalog to authenticated;
create policy shop_stock_read on public.shop_stock_catalog for select using(true);

create table public.room_shops(
 user_id uuid not null references public.profiles(id) on delete cascade, item text not null references public.shop_stock_catalog(id),
 units integer not null default 0 check(units between 0 and 30), selling_since timestamptz not null default now(),
 sold_day date, sold_today integer not null default 0,
 primary key(user_id,item)
);
alter table public.room_shops enable row level security;
revoke all on public.room_shops from anon,authenticated;

-- Units sold since the last collection: one per 20 minutes per item, at most 15 sales a day.
create or replace function public.shop_sold_today(p_user uuid) returns integer
language sql stable security definer set search_path=public as $$
 select coalesce(sum(sold_today),0)::integer from room_shops where user_id=p_user and sold_day=lagos_today() $$;
create or replace function public.shop_state_for(p_user uuid) returns jsonb
language plpgsql stable security definer set search_path=public as $$
declare v_sold_today integer := coalesce((select sum(amount) from hustle_payments where user_id=p_user and hustle='shop'
  and created_at>=(lagos_today()::timestamp at time zone 'Africa/Lagos')),0);
begin
 return jsonb_build_object('items',coalesce((select jsonb_agg(jsonb_build_object('item',c.id,'title',c.title,'cost',c.cost,'units_per_restock',c.units,
   'unit_price',c.unit_price,'units',coalesce(s.units,0),
   'ready',least(coalesce(s.units,0),floor(extract(epoch from now()-coalesce(s.selling_since,now()))/1200)::integer))
   order by c.cost) from shop_stock_catalog c left join room_shops s on s.user_id=p_user and s.item=c.id),'[]'),
  'earned_today',v_sold_today,'sales_today',shop_sold_today(p_user),'max_sales_per_day',15,
  'hustle_today',hustle_paid_today(p_user),'daily_cap',2500);
end $$;
create or replace function public.shop_state() returns jsonb language plpgsql stable security definer set search_path=public as $$
begin if auth.uid() is null then raise exception 'Authentication required'; end if; return shop_state_for(auth.uid()); end $$;

create or replace function public.restock_shop(p_item text) returns jsonb
language plpgsql security definer set search_path=public as $$
declare u uuid := auth.uid(); c shop_stock_catalog; s room_shops; b numeric;
begin
 if u is null then raise exception 'Authentication required'; end if;
 perform 1 from profiles where id=u for update;
 select * into c from shop_stock_catalog where id=p_item;
 if not found then raise exception 'Iya Ibeji doesn''t sell that'; end if;
 select * into s from room_shops where user_id=u and item=p_item for update;
 if coalesce(s.units,0)+c.units>30 then raise exception 'Your shelf is full. Sell some first.'; end if;
 perform ensure_player_wallet(u);
 select balance into b from wallets where user_id=u for update;
 if b<c.cost then raise exception 'Not enough money for a % (₦%)',lower(c.title),c.cost; end if;
 update wallets set balance=balance-c.cost,updated_at=now() where user_id=u returning balance into b;
 insert into wallet_transactions(user_id,type,amount,balance_after,description,metadata)
  values(u,'hustle_stock',-c.cost,b,'Shop stock: '||c.title,jsonb_build_object('item',p_item));
 insert into room_shops(user_id,item,units,selling_since) values(u,p_item,c.units,now())
  on conflict(user_id,item) do update set units=room_shops.units+c.units,
   selling_since=case when room_shops.units=0 then now() else room_shops.selling_since end;
 return shop_state_for(u)||jsonb_build_object('balance',b);
end $$;

create or replace function public.collect_shop() returns jsonb
language plpgsql security definer set search_path=public as $$
declare u uuid := auth.uid(); s room_shops; c shop_stock_catalog; v_ready integer; v_total integer := 0; v_paid integer;
begin
 if u is null then raise exception 'Authentication required'; end if;
 perform 1 from profiles where id=u for update;
 for s in select * from room_shops where user_id=u and units>0 order by item for update loop
  select * into c from shop_stock_catalog where id=s.item;
  -- Sold so far (one per 20 min), limited by today's 15-sale limit and what the cash cap can still pay,
  -- so stock is never used up without being paid for.
  v_ready := least(s.units, floor(extract(epoch from now()-s.selling_since)/1200)::integer,
   greatest(0,15-shop_sold_today(u)), floor(greatest(0,2500-hustle_paid_today(u))/c.unit_price::numeric)::integer);
  continue when v_ready<=0;
  v_paid := pay_hustle(u,'shop',s.item||':'||extract(epoch from clock_timestamp())::text,v_ready*c.unit_price,'Room shop sales: '||c.title);
  update room_shops set units=units-v_ready,selling_since=selling_since+(v_ready*interval '20 minutes'),
   sold_today=case when sold_day=lagos_today() then sold_today else 0 end+v_ready,sold_day=lagos_today()
   where user_id=u and item=s.item;
  v_total := v_total+v_paid;
 end loop;
 return shop_state_for(u)||jsonb_build_object('paid',v_total,'balance',(select balance from wallets where user_id=u));
end $$;

-- ---------- 2–4. Worker-proven hustles: POS shift, tutoring, photo shoot ----------
create or replace function public.hustle_pay_trusted(p_user uuid,p_hustle text,p_ref text,p_amount integer) returns integer
language plpgsql security definer set search_path=public as $$
begin
 case p_hustle
  when 'pos' then
   if p_amount<>250 then raise exception 'Invalid POS pay'; end if;
   return pay_hustle(p_user,'pos',p_ref,250,'POS kiosk shift',interval '5 minutes');
  when 'photo' then
   if p_amount not in(100,200,300,400) then raise exception 'Invalid photo pay'; end if;
   return pay_hustle(p_user,'photo',p_ref,p_amount,'Campus photo shoot',interval '3 minutes');
  else raise exception 'Unknown hustle';
 end case;
end $$;

create table public.tutoring_sessions(
 id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id) on delete cascade,
 questions text[] not null, started_at timestamptz not null default now(), submitted_at timestamptz, score integer
);
alter table public.tutoring_sessions enable row level security;
revoke all on public.tutoring_sessions from anon,authenticated;

create or replace function public.tutoring_start_trusted(p_user uuid) returns jsonb
language plpgsql security definer set search_path=public as $$
declare t tutoring_sessions;
begin
 perform 1 from profiles where id=p_user for update;
 select * into t from tutoring_sessions where user_id=p_user and submitted_at is null and started_at>now()-interval '5 minutes' order by started_at desc limit 1;
 if not found then
  if exists(select 1 from tutoring_sessions where user_id=p_user and submitted_at>now()-interval '10 minutes') then raise exception 'Your next student comes in a few minutes'; end if;
  insert into tutoring_sessions(user_id,questions) values(p_user,(select array_agg(id) from (select id from lecture_questions order by random() limit 3) q)) returning * into t;
 end if;
 return jsonb_build_object('session',t.id,'ends_at',t.started_at+interval '5 minutes','questions',
  (select jsonb_agg(jsonb_build_object('id',q.id,'question',q.question,'options',to_jsonb(q.options)) order by array_position(t.questions,q.id)) from lecture_questions q where q.id=any(t.questions)));
end $$;
create or replace function public.tutoring_submit_trusted(p_user uuid,p_session uuid,p_answers jsonb) returns jsonb
language plpgsql security definer set search_path=public as $$
declare t tutoring_sessions; q lecture_questions; v_score integer := 0; v_paid integer := 0;
begin
 select * into t from tutoring_sessions where id=p_session and user_id=p_user for update;
 if not found then raise exception 'No tutoring session'; end if;
 if t.submitted_at is not null then raise exception 'Already submitted'; end if;
 if now()>t.started_at+interval '5 minutes 30 seconds' then p_answers := '{}'::jsonb; end if;
 for q in select * from lecture_questions where id=any(t.questions) loop
  if jsonb_typeof(p_answers->q.id)='number' and (p_answers->>q.id)::integer=q.answer then v_score := v_score+1; end if;
 end loop;
 update tutoring_sessions set submitted_at=now(),score=v_score where id=t.id;
 if v_score>0 then v_paid := pay_hustle(p_user,'tutor',t.id::text,v_score*80,'Library tutoring'); end if;
 return jsonb_build_object('score',v_score,'total',cardinality(t.questions),'paid',v_paid,
  'answers',(select jsonb_object_agg(id,answer) from lecture_questions where id=any(t.questions)));
end $$;

-- ---------- 5. Player errands (escrow) ----------
create table public.errands(
 id uuid primary key default gen_random_uuid(), poster uuid not null references public.profiles(id) on delete cascade,
 kind text not null check(kind in('buy_food','bring_notes','carry_load','queue_for_me','deliver_message')),
 reward integer not null check(reward between 50 and 1000),
 status text not null default 'open' check(status in('open','accepted','done','cancelled','expired')),
 runner uuid references public.profiles(id) on delete set null,
 created_at timestamptz not null default now(), accepted_at timestamptz, finished_at timestamptz
);
create index errands_open on public.errands(status,created_at);
alter table public.errands enable row level security;
revoke all on public.errands from anon,authenticated;

-- Refund anything open/accepted past 2 hours. Called lazily by every errand RPC.
create or replace function public.errands_expire() returns void
language plpgsql security definer set search_path=public as $$
declare e errands; b numeric;
begin
 for e in select * from errands where status in('open','accepted') and created_at<now()-interval '120 minutes' for update skip locked loop
  update errands set status='expired',finished_at=now() where id=e.id;
  update wallets set balance=balance+e.reward,updated_at=now() where user_id=e.poster returning balance into b;
  insert into wallet_transactions(user_id,type,amount,balance_after,description,metadata) values(e.poster,'errand_refund',e.reward,b,'Errand expired: refund',jsonb_build_object('errand',e.id));
 end loop;
end $$;

create or replace function public.errand_board() returns jsonb
language plpgsql security definer set search_path=public as $$
declare u uuid := auth.uid();
begin
 if u is null then raise exception 'Authentication required'; end if;
 perform errands_expire();
 return jsonb_build_object(
  'open',coalesce((select jsonb_agg(jsonb_build_object('id',e.id,'kind',e.kind,'reward',e.reward,'poster',p.username,'mine',e.poster=u,'created_at',e.created_at) order by e.created_at desc)
    from errands e join profiles p on p.id=e.poster where e.status='open'
     and not exists(select 1 from blocks bl where (bl.user_id=u and bl.blocked_user_id=e.poster) or (bl.user_id=e.poster and bl.blocked_user_id=u))),'[]'),
  'mine',coalesce((select jsonb_agg(jsonb_build_object('id',e.id,'kind',e.kind,'reward',e.reward,'status',e.status,'role',case when e.poster=u then 'poster' else 'runner' end,
     'other',(select username from profiles where id=case when e.poster=u then e.runner else e.poster end),
     'other_id',case when e.poster=u then e.runner else e.poster end) order by e.created_at desc)
    from errands e where (e.poster=u or e.runner=u) and e.status in('open','accepted')),'[]'));
end $$;

create or replace function public.post_errand(p_kind text,p_reward integer) returns jsonb
language plpgsql security definer set search_path=public as $$
declare u uuid := auth.uid(); b numeric; v_id uuid;
begin
 if u is null then raise exception 'Authentication required'; end if;
 perform 1 from profiles where id=u for update;
 if p_reward is null or p_reward<50 or p_reward>1000 then raise exception 'Reward must be ₦50–₦1,000'; end if;
 if p_kind not in('buy_food','bring_notes','carry_load','queue_for_me','deliver_message') then raise exception 'Pick an errand'; end if;
 if (select count(*) from errands where poster=u and status in('open','accepted'))>=2 then raise exception 'You already have 2 errands running'; end if;
 perform ensure_player_wallet(u);
 select balance into b from wallets where user_id=u for update;
 if b<p_reward then raise exception 'Not enough money to post this errand'; end if;
 update wallets set balance=balance-p_reward,updated_at=now() where user_id=u returning balance into b;
 insert into errands(poster,kind,reward) values(u,p_kind,p_reward) returning id into v_id;
 insert into wallet_transactions(user_id,type,amount,balance_after,description,metadata) values(u,'errand_escrow',-p_reward,b,'Errand posted (held)',jsonb_build_object('errand',v_id));
 return errand_board()||jsonb_build_object('balance',b);
end $$;

create or replace function public.accept_errand(p_errand uuid) returns jsonb
language plpgsql security definer set search_path=public as $$
declare u uuid := auth.uid(); e errands;
begin
 if u is null then raise exception 'Authentication required'; end if;
 perform errands_expire();
 select * into e from errands where id=p_errand for update;
 if not found or e.status<>'open' then raise exception 'That errand is no longer available'; end if;
 if e.poster=u then raise exception 'You cannot run your own errand'; end if;
 if exists(select 1 from blocks where (user_id=u and blocked_user_id=e.poster) or (user_id=e.poster and blocked_user_id=u)) then raise exception 'That errand is no longer available'; end if;
 if exists(select 1 from errands where runner=u and status='accepted') then raise exception 'Finish your current errand first'; end if;
 update errands set status='accepted',runner=u,accepted_at=now() where id=e.id;
 return errand_board();
end $$;

create or replace function public.cancel_errand(p_errand uuid) returns jsonb
language plpgsql security definer set search_path=public as $$
declare u uuid := auth.uid(); e errands; b numeric;
begin
 if u is null then raise exception 'Authentication required'; end if;
 select * into e from errands where id=p_errand for update;
 if not found or e.status not in('open','accepted') then raise exception 'Nothing to cancel'; end if;
 if e.runner=u and e.status='accepted' then
  update errands set status='open',runner=null,accepted_at=null where id=e.id; -- runner drops it
 elsif e.poster=u then
  if e.status='accepted' then raise exception 'Someone is already running this errand'; end if;
  update errands set status='cancelled',finished_at=now() where id=e.id;
  update wallets set balance=balance+e.reward,updated_at=now() where user_id=u returning balance into b;
  insert into wallet_transactions(user_id,type,amount,balance_after,description,metadata) values(u,'errand_refund',e.reward,b,'Errand cancelled: refund',jsonb_build_object('errand',e.id));
 else raise exception 'Nothing to cancel'; end if;
 return errand_board();
end $$;

-- The Worker calls this only when runner and poster are both online and within 5 m of each other.
create or replace function public.errand_complete_trusted(p_errand uuid,p_runner uuid) returns jsonb
language plpgsql security definer set search_path=public as $$
declare e errands; b numeric;
begin
 select * into e from errands where id=p_errand for update;
 if not found or e.status<>'accepted' or e.runner is distinct from p_runner then raise exception 'This errand is not yours to hand over'; end if;
 update errands set status='done',finished_at=now() where id=e.id;
 update wallets set balance=balance+e.reward,updated_at=now() where user_id=p_runner returning balance into b;
 if b is null then raise exception 'Open your wallet first'; end if;
 insert into wallet_transactions(user_id,type,amount,balance_after,description,metadata) values(p_runner,'errand_pay',e.reward,b,'Errand done',jsonb_build_object('errand',e.id));
 return jsonb_build_object('paid',e.reward,'balance',b,'poster',e.poster);
end $$;
create or replace function public.errand_for_trusted(p_errand uuid) returns jsonb
language sql stable security definer set search_path=public as $$
 select jsonb_build_object('poster',poster,'runner',runner,'status',status) from errands where id=p_errand $$;

revoke all on function public.hustle_paid_today(uuid),public.shop_sold_today(uuid),public.pay_hustle(uuid,text,text,integer,text,interval),public.shop_state_for(uuid),
 public.hustle_pay_trusted(uuid,text,text,integer),public.tutoring_start_trusted(uuid),public.tutoring_submit_trusted(uuid,uuid,jsonb),
 public.errands_expire(),public.errand_complete_trusted(uuid,uuid),public.errand_for_trusted(uuid) from public,anon,authenticated;
grant execute on function public.hustle_pay_trusted(uuid,text,text,integer),public.tutoring_start_trusted(uuid),public.tutoring_submit_trusted(uuid,uuid,jsonb),
 public.errand_complete_trusted(uuid,uuid),public.errand_for_trusted(uuid) to service_role;
revoke all on function public.shop_state(),public.restock_shop(text),public.collect_shop(),public.errand_board(),public.post_errand(text,integer),
 public.accept_errand(uuid),public.cancel_errand(uuid) from public,anon;
grant execute on function public.shop_state(),public.restock_shop(text),public.collect_shop(),public.errand_board(),public.post_errand(text,integer),
 public.accept_errand(uuid),public.cancel_errand(uuid) to authenticated;
