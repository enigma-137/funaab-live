-- 034: SUG elections. Apply once AFTER 033.
-- Every Lagos week: nominations Mon–Wed (Level 3+, ₦1,000, short manifesto), voting Thu–Sat
-- (Level 2+, one vote, changeable until polls close), results on Sunday. The winner (most votes;
-- a tie goes to whoever declared first) is SUG President from that Sunday until the next one, with
-- a 👑 badge and one campus-wide announcement a day. Mirrors src/config/sug.ts.
begin;

create table public.sug_candidates(
 cycle integer not null, user_id uuid not null references public.profiles(id) on delete cascade,
 manifesto text not null, created_at timestamptz not null default now(),
 primary key(cycle,user_id)
);
create table public.sug_votes(
 cycle integer not null, voter_id uuid not null references public.profiles(id) on delete cascade,
 candidate_id uuid not null, updated_at timestamptz not null default now(),
 primary key(cycle,voter_id),
 foreign key(cycle,candidate_id) references public.sug_candidates(cycle,user_id) on delete cascade
);
create index sug_votes_candidate on public.sug_votes(cycle,candidate_id);
create table public.sug_announcements(
 id bigserial primary key, user_id uuid not null references public.profiles(id) on delete cascade,
 cycle integer not null, body text not null, created_at timestamptz not null default now()
);
alter table public.sug_candidates enable row level security;
alter table public.sug_votes enable row level security;
alter table public.sug_announcements enable row level security;
revoke all on public.sug_candidates,public.sug_votes,public.sug_announcements from anon,authenticated;

create or replace function public.sug_cycle(p_day date) returns integer language sql immutable as $$
 select floor((p_day - date '2026-01-05')::numeric / 7)::integer $$;
create or replace function public.sug_phase(p_day date) returns text language sql immutable as $$
 select case when extract(isodow from p_day)=7 then 'results' when extract(isodow from p_day)<=3 then 'nominations' else 'voting' end $$;

-- Same rules as the client: length, no links, no insults.
create or replace function public.sug_clean(p_text text,p_max integer) returns text
language plpgsql immutable as $$
declare t text := btrim(coalesce(p_text,'')); w text;
begin
 if length(t)<3 then raise exception 'Write a little more.'; end if;
 if length(t)>p_max then raise exception 'Keep it under % characters.',p_max; end if;
 if t ~* '(https?://|www\.)' then raise exception 'No links, please.'; end if;
 foreach w in array array['fuck','shit','bitch','nigger','mumu','olodo','ashawo','idiot'] loop
  if position(w in lower(t))>0 then raise exception 'Keep it clean — no insults or swearing.'; end if;
 end loop;
 return t;
end $$;

create or replace function public.sug_user_level(p_user uuid) returns integer
language sql stable security definer set search_path=public as $$
 select xp_level(coalesce((select xp from player_xp where user_id=p_user),0)) $$;

-- Most votes wins; a tie goes to the earliest candidate. Nobody wins with no votes.
create or replace function public.sug_winner(p_cycle integer) returns uuid
language sql stable security definer set search_path=public as $$
 select c.user_id from sug_candidates c join sug_votes v on v.cycle=c.cycle and v.candidate_id=c.user_id
  where c.cycle=p_cycle group by c.user_id,c.created_at order by count(*) desc, c.created_at asc limit 1 $$;

-- Polls close Saturday night, so from Sunday the President is this week's winner; Mon–Sat it is last week's.
create or replace function public.sug_president_cycle() returns integer
language sql stable as $$
 select sug_cycle(lagos_today()) - case when sug_phase(lagos_today())='results' then 0 else 1 end $$;

create or replace function public.sug_results(p_cycle integer) returns jsonb
language sql stable security definer set search_path=public as $$
 select coalesce(jsonb_agg(jsonb_build_object('user_id',c.user_id,'username',p.username,'college',p.college,
   'level',sug_user_level(c.user_id),'manifesto',c.manifesto,
   'votes',(select count(*) from sug_votes v where v.cycle=c.cycle and v.candidate_id=c.user_id)) order by c.created_at),'[]'::jsonb)
 from sug_candidates c join profiles p on p.id=c.user_id where c.cycle=p_cycle $$;

create or replace function public.sug_state() returns jsonb
language plpgsql stable security definer set search_path=public as $$
declare me uuid := auth.uid(); cyc integer := sug_cycle(lagos_today()); ph text := sug_phase(lagos_today());
 pc integer := sug_president_cycle(); pres uuid := sug_winner(pc); ann record;
begin
 if me is null then raise exception 'Authentication required'; end if;
 select a.body,a.created_at,p.username into ann from sug_announcements a join profiles p on p.id=a.user_id
  where a.user_id=pres and a.cycle=pc and a.created_at>now()-interval '24 hours' order by a.created_at desc limit 1;
 return jsonb_build_object(
  'cycle',cyc,'phase',ph,'my_level',sug_user_level(me),
  'am_candidate',exists(select 1 from sug_candidates where cycle=cyc and user_id=me),
  'my_vote',(select candidate_id from sug_votes where cycle=cyc and voter_id=me),
  -- Running tallies stay secret until results day.
  'candidates',case when ph='results' then sug_results(cyc) else (
    select coalesce(jsonb_agg(jsonb_build_object('user_id',c.user_id,'username',p.username,'college',p.college,
      'level',sug_user_level(c.user_id),'manifesto',c.manifesto) order by c.created_at),'[]'::jsonb)
    from sug_candidates c join profiles p on p.id=c.user_id where c.cycle=cyc) end,
  'last_results',case when ph='results' then null else sug_results(cyc-1) end,
  'president',case when pres is null then null else (select jsonb_build_object('user_id',p.id,'username',p.username,'college',p.college,'cycle',pc)
    from profiles p where p.id=pres) end,
  'announcement',case when ann.body is null then null else jsonb_build_object('body',ann.body,'created_at',ann.created_at,'username',ann.username) end,
  'can_announce',coalesce(pres=me,false) and not exists(select 1 from sug_announcements where user_id=me and created_at>=(lagos_today()::timestamp at time zone 'Africa/Lagos'))
 );
end $$;

create or replace function public.sug_nominate(p_manifesto text) returns jsonb
language plpgsql security definer set search_path=public as $$
declare me uuid := auth.uid(); cyc integer := sug_cycle(lagos_today()); t text; b numeric;
begin
 if me is null then raise exception 'Authentication required'; end if;
 if sug_phase(lagos_today())<>'nominations' then raise exception 'Nominations are open Monday to Wednesday.'; end if;
 t := sug_clean(p_manifesto,200);
 perform 1 from profiles where id=me for update;
 if sug_user_level(me)<3 then raise exception 'You need to be Level 3 to run for SUG President.'; end if;
 if exists(select 1 from sug_candidates where cycle=cyc and user_id=me) then raise exception 'You are already running this week.'; end if;
 perform pg_advisory_xact_lock(hashtext('sug:'||cyc));
 if (select count(*) from sug_candidates where cycle=cyc)>=12 then raise exception 'The ballot is full this week (12 candidates).'; end if;
 update wallets set balance=balance-1000,updated_at=now() where user_id=me and balance>=1000 returning balance into b;
 if b is null then raise exception 'The nomination fee is ₦1,000.'; end if;
 insert into wallet_transactions(user_id,type,amount,balance_after,description,metadata)
  values(me,'sug_nomination',-1000,b,'SUG nomination fee',jsonb_build_object('cycle',cyc));
 insert into sug_candidates(cycle,user_id,manifesto) values(cyc,me,t);
 return jsonb_build_object('balance',b);
end $$;

create or replace function public.sug_withdraw() returns void
language plpgsql security definer set search_path=public as $$
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 if sug_phase(lagos_today())<>'nominations' then raise exception 'You can only withdraw before voting starts.'; end if;
 delete from sug_candidates where cycle=sug_cycle(lagos_today()) and user_id=auth.uid();
end $$;

create or replace function public.sug_vote(p_candidate uuid) returns void
language plpgsql security definer set search_path=public as $$
declare me uuid := auth.uid(); cyc integer := sug_cycle(lagos_today());
begin
 if me is null then raise exception 'Authentication required'; end if;
 if sug_phase(lagos_today())<>'voting' then raise exception 'Voting is open Thursday to Saturday.'; end if;
 if sug_user_level(me)<2 then raise exception 'Reach Level 2 to vote — play a little on campus first.'; end if;
 if not exists(select 1 from sug_candidates where cycle=cyc and user_id=p_candidate) then raise exception 'That student is not on the ballot.'; end if;
 insert into sug_votes(cycle,voter_id,candidate_id) values(cyc,me,p_candidate)
  on conflict(cycle,voter_id) do update set candidate_id=excluded.candidate_id, updated_at=now();
end $$;

create or replace function public.sug_announce(p_body text) returns void
language plpgsql security definer set search_path=public as $$
declare me uuid := auth.uid(); pc integer := sug_president_cycle(); t text;
begin
 if me is null then raise exception 'Authentication required'; end if;
 if sug_winner(pc) is distinct from me then raise exception 'Only the SUG President can make announcements.'; end if;
 t := sug_clean(p_body,160);
 perform 1 from profiles where id=me for update;
 if exists(select 1 from sug_announcements where user_id=me and created_at>=(lagos_today()::timestamp at time zone 'Africa/Lagos')) then
  raise exception 'One announcement a day. Try again tomorrow.';
 end if;
 insert into sug_announcements(user_id,cycle,body) values(me,pc,t);
end $$;

revoke all on function public.sug_cycle(date),public.sug_phase(date),public.sug_clean(text,integer),public.sug_user_level(uuid),
 public.sug_winner(integer),public.sug_president_cycle(),public.sug_results(integer) from public,anon,authenticated;
revoke all on function public.sug_state(),public.sug_nominate(text),public.sug_withdraw(),public.sug_vote(uuid),public.sug_announce(text) from public,anon;
grant execute on function public.sug_state(),public.sug_nominate(text),public.sug_withdraw(),public.sug_vote(uuid),public.sug_announce(text) to authenticated;

commit;
