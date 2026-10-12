-- 010: Campus Bet — fictional football predictions paid in virtual game Naira only.
-- Apply once AFTER 009. Additive: no existing wallet, ledger, job or hostel rows are rewritten.
-- No real money, deposits, cash-out or payment integration exist anywhere in this system.
--
-- Trust model: the Worker (service role) generates fixtures + hidden probabilities and calls
-- campus_bet_sync_trusted / campus_bet_place_trusted. The database validates every input,
-- stores each matchday once, draws results with pg strong randomness exactly once at settlement,
-- and pays tickets through the existing wallets + wallet_transactions ledger.
begin;

create table public.campus_bet_teams(
 id text primary key, name text not null unique, short_name text not null unique
);
-- Hidden strengths are not stored here; they live only in the Worker's model.
insert into public.campus_bet_teams values
 ('falcons','Falcons FC','Falcons'),('green-lions','Green Lions','Lions'),
 ('campus-united','Campus United','United'),('abeokuta-city','Abeokuta City','City'),
 ('royal-stars','Royal Stars','Stars'),('titans','Titans FC','Titans'),
 ('warriors','Warriors FC','Warriors'),('rovers-athletic','Rovers Athletic','Rovers'),
 ('scholars','Scholars FC','Scholars'),('unity','Unity FC','Unity');

create table public.campus_bet_rounds(
 id uuid primary key default gen_random_uuid(),
 round_number integer not null unique check(round_number>0),
 slot_start timestamptz not null unique,
 status text not null default 'OPEN' check(status in('OPEN','LOCKED','SETTLED')),
 opens_at timestamptz not null, closes_at timestamptz not null, settled_at timestamptz,
 created_at timestamptz not null default now(),
 check(closes_at>opens_at), check((status='SETTLED')=(settled_at is not null))
);

create table public.campus_bet_fixtures(
 id uuid primary key default gen_random_uuid(),
 round_id uuid not null references public.campus_bet_rounds(id) on delete cascade,
 slot smallint not null check(slot between 1 and 5),
 home_team_id text not null references public.campus_bet_teams(id),
 away_team_id text not null references public.campus_bet_teams(id),
 home_probability numeric(6,4) not null check(home_probability between 0.15 and 0.62),
 draw_probability numeric(6,4) not null check(draw_probability between 0.15 and 0.40),
 away_probability numeric(6,4) not null check(away_probability between 0.15 and 0.62),
 result text check(result in('HOME','DRAW','AWAY')),
 home_score smallint check(home_score between 0 and 9), away_score smallint check(away_score between 0 and 9),
 created_at timestamptz not null default now(),
 unique(round_id,slot), unique(round_id,home_team_id), unique(round_id,away_team_id),
 check(home_team_id<>away_team_id),
 check(home_probability+draw_probability+away_probability=1),
 check((result is null)=(home_score is null) and (result is null)=(away_score is null)),
 check(result is null or (result='HOME' and home_score>away_score) or (result='DRAW' and home_score=away_score)
  or (result='AWAY' and home_score<away_score))
);

create table public.campus_bet_tickets(
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references public.profiles(id) on delete cascade,
 round_id uuid not null references public.campus_bet_rounds(id),
 stake integer not null check(stake between 50 and 500 and stake%10=0),
 picks jsonb not null check(jsonb_typeof(picks)='array' and jsonb_array_length(picks)=5),
 correct_count smallint check(correct_count between 0 and 5),
 payout integer check(payout between 0 and stake*5),
 settled_at timestamptz,
 created_at timestamptz not null default now(),
 unique(user_id,round_id), -- one ticket per student per matchday: no brute-forcing every combination
 check((settled_at is null)=(correct_count is null) and (settled_at is null)=(payout is null))
);
create index campus_bet_unsettled_tickets on public.campus_bet_tickets(round_id) where settled_at is null;
create index campus_bet_ticket_history on public.campus_bet_tickets(user_id,created_at desc);
create index campus_bet_due_rounds on public.campus_bet_rounds(closes_at) where status<>'SETTLED';

-- Uniform [0,1) from gen_random_uuid(), which uses pg_strong_random. The first 12 hex
-- digits of a v4 UUID are fully random (the version nibble comes after them).
create function public.campus_bet_random() returns double precision language sql volatile set search_path=public as $$
 select ('x'||substr(replace(gen_random_uuid()::text,'-',''),1,12))::bit(48)::bigint::double precision/281474976710656.0
$$;

-- Mirrors CAMPUS_BET_MULTIPLIERS in src/config/campusBet.ts: 0,0,½,1,3,5 × stake.
create function public.campus_bet_payout(p_stake integer,p_correct integer) returns integer language sql immutable as $$
 select floor(p_stake*(array[0,0,0.5,1,3,5]::numeric[])[p_correct+1])::integer
$$;

create function public.campus_bet_fixtures_json(p_round uuid) returns jsonb language sql stable set search_path=public as $$
 select coalesce(jsonb_agg(jsonb_build_object('slot',slot,'home',home_team_id,'away',away_team_id,'result',result,
  'home_score',home_score,'away_score',away_score) order by slot),'[]') from campus_bet_fixtures where round_id=p_round
$$;
create function public.campus_bet_round_json(r public.campus_bet_rounds) returns jsonb language sql stable set search_path=public as $$
 select case when r.id is null then null else jsonb_build_object('id',r.id,'round_number',r.round_number,
  -- An OPEN round past its close is effectively locked until settlement finishes.
  'status',case when r.status='OPEN' and now()>=r.closes_at then 'LOCKED' else r.status end,
  'opens_at',r.opens_at,'closes_at',r.closes_at,'settled_at',r.settled_at,'fixtures',campus_bet_fixtures_json(r.id)) end
$$;
create function public.campus_bet_ticket_json(t public.campus_bet_tickets,p_with_fixtures boolean default false) returns jsonb language sql stable set search_path=public as $$
 select case when t.id is null then null else jsonb_build_object('round_id',t.round_id,
  'round_number',(select round_number from campus_bet_rounds where id=t.round_id),
  'stake',t.stake,'picks',t.picks,'correct_count',t.correct_count,'payout',t.payout,'settled_at',t.settled_at,'created_at',t.created_at)
  || case when p_with_fixtures then jsonb_build_object('fixtures',campus_bet_fixtures_json(t.round_id)) else '{}'::jsonb end end
$$;

-- Settles every round past its close, exactly once. Caller must hold the sync advisory lock.
create function public.campus_bet_settle_due() returns integer language plpgsql security definer set search_path=public as $$
declare r campus_bet_rounds; f campus_bet_fixtures; t campus_bet_tickets; u double precision; res text; score text;
 k integer; pay integer; b numeric; n integer:=0;
 -- Cosmetic scorelines written as winner-loser; chosen AFTER the outcome, never changing it.
 win_scores text[]:=array['1-0','1-0','2-0','2-0','2-1','2-1','3-1','3-0','3-2','4-1'];
 draw_scores text[]:=array['0-0','0-0','1-1','1-1','1-1','2-2','2-2','3-3'];
begin
 for r in select * from campus_bet_rounds where status<>'SETTLED' and closes_at<=now() order by round_number for update loop
  update campus_bet_rounds set status='LOCKED' where id=r.id and status='OPEN';
  for f in select * from campus_bet_fixtures where round_id=r.id and result is null order by slot for update loop
   u:=campus_bet_random();
   res:=case when u<f.home_probability then 'HOME' when u<f.home_probability+f.draw_probability then 'DRAW' else 'AWAY' end;
   if res='DRAW' then score:=draw_scores[1+floor(campus_bet_random()*array_length(draw_scores,1))::integer];
   else score:=win_scores[1+floor(campus_bet_random()*array_length(win_scores,1))::integer]; end if;
   update campus_bet_fixtures set result=res,
    home_score=split_part(score,'-',case when res='AWAY' then 2 else 1 end)::smallint,
    away_score=split_part(score,'-',case when res='AWAY' then 1 else 2 end)::smallint
   where id=f.id;
  end loop;
  for t in select * from campus_bet_tickets where round_id=r.id and settled_at is null order by user_id for update loop
   select count(*) into k from campus_bet_fixtures fx where fx.round_id=r.id and fx.result=t.picks->>(fx.slot-1);
   pay:=campus_bet_payout(t.stake,k);
   if pay>0 then
    insert into wallets(user_id,balance) values(t.user_id,0) on conflict(user_id) do nothing;
    update wallets set balance=balance+pay,updated_at=now() where user_id=t.user_id returning balance into b;
    insert into wallet_transactions(user_id,type,amount,balance_after,description,metadata)
     values(t.user_id,'campus_bet_payout',pay,b,'Campus Bet Matchday '||r.round_number||' — '||k||'/5 correct',
      jsonb_build_object('ticket',t.id,'round',r.id,'correct',k));
   end if;
   update campus_bet_tickets set correct_count=k,payout=pay,settled_at=now() where id=t.id;
  end loop;
  update campus_bet_rounds set status='SETTLED',settled_at=now() where id=r.id;
  n:=n+1;
 end loop;
 return n;
end $$;

create function public.campus_bet_state(p_user uuid) returns jsonb language plpgsql stable security definer set search_path=public as $$
declare v_slot timestamptz:=to_timestamp(floor(extract(epoch from now())/1200)*1200);
 cur campus_bet_rounds; v_last campus_bet_rounds; mine campus_bet_tickets; lt campus_bet_tickets;
begin
 select * into cur from campus_bet_rounds where slot_start=v_slot;
 select * into v_last from campus_bet_rounds where status='SETTLED' order by round_number desc limit 1;
 if p_user is not null then
  if cur.id is not null then select * into mine from campus_bet_tickets where user_id=p_user and round_id=cur.id; end if;
  if v_last.id is not null then select * into lt from campus_bet_tickets where user_id=p_user and round_id=v_last.id; end if;
 end if;
 return jsonb_build_object(
  'server_now',now(),'next_opens_at',v_slot+interval '20 minutes',
  'current',campus_bet_round_json(cur),'my_ticket',campus_bet_ticket_json(mine),
  'last_settled',campus_bet_round_json(v_last),'last_ticket',campus_bet_ticket_json(lt),
  'history',coalesce((select jsonb_agg(campus_bet_ticket_json(h,true) order by h.created_at desc) from
    (select * from campus_bet_tickets where user_id=p_user order by created_at desc limit 10) h),'[]'),
  -- Public club form: each club plays once per matchday, so five matchdays = last five results.
  'form',coalesce((select jsonb_object_agg(team,results) from (
    select team,jsonb_agg(res order by round_number) results from (
     select f.home_team_id team,ro.round_number,case f.result when 'HOME' then 'W' when 'DRAW' then 'D' else 'L' end res
      from campus_bet_fixtures f join campus_bet_rounds ro on ro.id=f.round_id
      where ro.id in(select id from campus_bet_rounds where status='SETTLED' order by round_number desc limit 5)
     union all
     select f.away_team_id,ro.round_number,case f.result when 'AWAY' then 'W' when 'DRAW' then 'D' else 'L' end
      from campus_bet_fixtures f join campus_bet_rounds ro on ro.id=f.round_id
      where ro.id in(select id from campus_bet_rounds where status='SETTLED' order by round_number desc limit 5)
    ) x group by team) y),'{}'));
end $$;

-- Lazy lifecycle driver. Settles due rounds, then creates the current 20-minute slot's matchday
-- if missing (open for the first 15 minutes). Without p_candidate it reports that a matchday is
-- needed plus recent pairings, so the Worker can generate one that avoids repeats.
create function public.campus_bet_sync_trusted(p_user uuid default null,p_candidate jsonb default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_slot timestamptz:=to_timestamp(floor(extract(epoch from now())/1200)*1200);
 settled integer:=0; rid uuid; e jsonb; i integer:=0; ids text[];
begin
 if exists(select 1 from campus_bet_rounds where status<>'SETTLED' and closes_at<=now())
  or (now()<v_slot+interval '15 minutes' and not exists(select 1 from campus_bet_rounds where slot_start=v_slot)) then
  -- One global writer: concurrent Durable Objects cannot double-create or double-settle.
  perform pg_advisory_xact_lock(hashtext('campus_bet_sync'));
  settled:=campus_bet_settle_due();
  if now()<v_slot+interval '15 minutes' and not exists(select 1 from campus_bet_rounds where slot_start=v_slot) then
   if p_candidate is null then
    return campus_bet_state(p_user)||jsonb_build_object('needs_round',true,'settled',settled,'recent_pairs',coalesce((select jsonb_agg(jsonb_build_array(home_team_id,away_team_id))
     from campus_bet_fixtures where round_id in(select id from campus_bet_rounds order by round_number desc limit 3)),'[]'));
   end if;
   if jsonb_typeof(p_candidate)<>'array' then raise exception 'Matchday needs exactly 5 fixtures'; end if;
   if jsonb_array_length(p_candidate)<>5 then raise exception 'Matchday needs exactly 5 fixtures'; end if;
   select array_agg(x) into ids from (select c.value->>'home_team_id' x from jsonb_array_elements(p_candidate) c
    union all select c.value->>'away_team_id' from jsonb_array_elements(p_candidate) c) t;
   if (select count(distinct x) from unnest(ids) x where x in(select id from campus_bet_teams))<>10 then
    raise exception 'Every club must play exactly once'; end if;
   insert into campus_bet_rounds(round_number,slot_start,opens_at,closes_at)
    values(coalesce((select max(round_number) from campus_bet_rounds),0)+1,v_slot,v_slot,v_slot+interval '15 minutes') returning id into rid;
   for e in select value from jsonb_array_elements(p_candidate) loop
    i:=i+1;
    -- Table checks enforce the probability caps and that each split sums to exactly 1.
    insert into campus_bet_fixtures(round_id,slot,home_team_id,away_team_id,home_probability,draw_probability,away_probability)
     values(rid,i,e->>'home_team_id',e->>'away_team_id',(e->>'home_probability')::numeric,(e->>'draw_probability')::numeric,(e->>'away_probability')::numeric);
   end loop;
  end if;
 end if;
 return campus_bet_state(p_user)||jsonb_build_object('settled',settled);
end $$;

create function public.campus_bet_place_trusted(p_user uuid,p_round uuid,p_stake integer,p_picks jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare r campus_bet_rounds; b numeric; t campus_bet_tickets;
begin
 -- Lock order: profile, round (shared), wallet. Settlement takes the round exclusively, so a
 -- ticket can never be written into a round whose results are being drawn.
 perform 1 from profiles where id=p_user for update;
 if not found then raise exception 'Profile missing'; end if;
 select * into r from campus_bet_rounds where id=p_round for share;
 if not found then raise exception 'Matchday not found'; end if;
 if r.status<>'OPEN' or now()>=r.closes_at or now()<r.opens_at then raise exception 'Betting is closed for Matchday %',r.round_number; end if;
 if p_stake is null or p_stake<50 or p_stake>500 or p_stake%10<>0 then raise exception 'Stake must be ₦50–₦500 in ₦10 steps'; end if;
 if p_picks is null or jsonb_typeof(p_picks)<>'array' then raise exception 'Pick a result for all 5 matches'; end if;
 if jsonb_array_length(p_picks)<>5 or exists(select 1 from jsonb_array_elements(p_picks) e
  where jsonb_typeof(e.value)<>'string' or e.value#>>'{}' not in('HOME','DRAW','AWAY')) then raise exception 'Pick a result for all 5 matches'; end if;
 if exists(select 1 from campus_bet_tickets where user_id=p_user and round_id=p_round) then
  raise exception 'You already have a ticket for Matchday %',r.round_number; end if;
 select balance into b from wallets where user_id=p_user for update;
 if not found then raise exception 'Open your wallet first'; end if;
 if b<p_stake then raise exception 'Insufficient balance'; end if;
 b:=b-p_stake;
 update wallets set balance=b,updated_at=now() where user_id=p_user;
 insert into campus_bet_tickets(user_id,round_id,stake,picks) values(p_user,p_round,p_stake,p_picks) returning * into t;
 insert into wallet_transactions(user_id,type,amount,balance_after,description,metadata)
  values(p_user,'campus_bet_stake',-p_stake,b,'Campus Bet ticket — Matchday '||r.round_number,jsonb_build_object('ticket',t.id,'round',r.id));
 return jsonb_build_object('balance',b,'ticket',campus_bet_ticket_json(t));
end $$;

alter table public.campus_bet_teams enable row level security;
alter table public.campus_bet_rounds enable row level security;
alter table public.campus_bet_fixtures enable row level security;
alter table public.campus_bet_tickets enable row level security;
revoke all on public.campus_bet_teams,public.campus_bet_rounds,public.campus_bet_fixtures,public.campus_bet_tickets from anon,authenticated;
grant select on public.campus_bet_teams,public.campus_bet_rounds,public.campus_bet_tickets to authenticated;
-- Column grant: hidden probabilities are never readable by players.
grant select(id,round_id,slot,home_team_id,away_team_id,result,home_score,away_score,created_at) on public.campus_bet_fixtures to authenticated;
create policy campus_bet_teams_read on public.campus_bet_teams for select to authenticated using(true);
create policy campus_bet_rounds_read on public.campus_bet_rounds for select to authenticated using(true);
create policy campus_bet_fixtures_read on public.campus_bet_fixtures for select to authenticated using(true);
create policy campus_bet_tickets_owner on public.campus_bet_tickets for select to authenticated using(user_id=auth.uid());

revoke all on function public.campus_bet_random(),public.campus_bet_payout(integer,integer),public.campus_bet_fixtures_json(uuid),
 public.campus_bet_round_json(public.campus_bet_rounds),public.campus_bet_ticket_json(public.campus_bet_tickets,boolean),
 public.campus_bet_settle_due(),public.campus_bet_state(uuid),public.campus_bet_sync_trusted(uuid,jsonb),
 public.campus_bet_place_trusted(uuid,uuid,integer,jsonb) from public,anon,authenticated;
grant execute on function public.campus_bet_sync_trusted(uuid,jsonb),public.campus_bet_place_trusted(uuid,uuid,integer,jsonb) to service_role;
commit;
