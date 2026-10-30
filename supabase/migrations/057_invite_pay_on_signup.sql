-- 057: Invite rewards are paid in two parts. Apply once AFTER 056.
-- ₦10,000 to the inviter as soon as the invited student signs up with the link, and ₦5,000 more when
-- that student reaches Level 2. Still at most 20 paid invites per student (the Level 2 bonus only
-- follows a paid signup). Inviters are told when they are paid: invite_news() hands each payout to
-- the client once.
-- Invites from before this migration are brought up to the new rules: one already paid ₦10,000 at
-- Level 2 counts as its signup reward and gets the ₦5,000 bonus now; one not yet paid gets ₦10,000 now.
-- Mirrors src/config/invites.ts (scripts/test-invites-db.ts checks drift).
begin;

alter table public.invites rename column paid_at to level_paid_at;
alter table public.invites add column join_paid_at timestamptz;
update public.invites set join_paid_at=level_paid_at, level_paid_at=null where level_paid_at is not null;
-- paid stays the running total paid for this invite.
-- Whether the inviter has been shown each payment.
alter table public.invites add column join_seen boolean not null default false, add column level_seen boolean not null default false;

create or replace function public.invite_pay(p_inviter uuid,p_invitee uuid,p_amount integer,p_why text) returns boolean
language plpgsql security definer set search_path=public as $$
declare b numeric; who text;
begin
 update wallets set balance=balance+p_amount,updated_at=now() where user_id=p_inviter returning balance into b;
 if not found then return false; end if;
 select username into who from profiles where id=p_invitee;
 insert into wallet_transactions(user_id,type,amount,balance_after,description,metadata)
  values(p_inviter,'invite_reward',p_amount,b,'Invite reward: @'||who||' '||p_why,jsonb_build_object('invitee',p_invitee,'username',who));
 update invites set paid=coalesce(paid,0)+p_amount where invitee=p_invitee;
 return true;
end $$;

-- ₦10,000 when the invited student signs up.
create or replace function public.pay_invite_join(p_invitee uuid) returns integer
language plpgsql security definer set search_path=public as $$
declare v invites;
begin
 select * into v from invites where invitee=p_invitee and join_paid_at is null for update;
 if not found then return 0; end if;
 perform 1 from profiles where id=v.inviter for update; -- serializes the cap per inviter
 if (select count(*) from invites where inviter=v.inviter and join_paid_at is not null) >= 20 then return 0; end if;
 if not invite_pay(v.inviter,p_invitee,10000,'joined with your link') then return 0; end if;
 update invites set join_paid_at=now() where invitee=p_invitee;
 return 10000;
end $$;

-- ₦5,000 more when they reach Level 2. Called by the XP trigger from 056.
create or replace function public.pay_invite(p_invitee uuid) returns integer
language plpgsql security definer set search_path=public as $$
declare v invites;
begin
 select * into v from invites where invitee=p_invitee and join_paid_at is not null and level_paid_at is null for update;
 if not found then return 0; end if;
 if xp_level(coalesce((select xp from player_xp where user_id=p_invitee),0)) < 2 then return 0; end if;
 if not invite_pay(v.inviter,p_invitee,5000,'reached Level 2') then return 0; end if;
 update invites set level_paid_at=now() where invitee=p_invitee;
 return 5000;
end $$;

create or replace function public.redeem_invite(p_code text) returns jsonb
language plpgsql security definer set search_path=public as $$
declare u uuid := auth.uid(); me profiles; o profiles;
begin
 if u is null then raise exception 'Authentication required'; end if;
 select * into me from profiles where id=u for update;
 if not found then raise exception 'Profile missing'; end if;
 select p.* into o from invite_codes c join profiles p on p.id=c.user_id where c.code=upper(trim(p_code));
 if not found then raise exception 'That invite link is not valid.'; end if;
 if o.id=u then raise exception 'You cannot use your own invite link.'; end if;
 if exists(select 1 from invites where invitee=u) then raise exception 'You have already joined with an invite.'; end if;
 if me.created_at < now()-interval '7 days' then raise exception 'Invite links are for new students.'; end if;
 if xp_level(coalesce((select xp from player_xp where user_id=u),0)) >= 2 then raise exception 'Invite links are for new students.'; end if;
 if exists(select 1 from invites where invitee=o.id and inviter=u) then raise exception 'You invited this student yourself.'; end if;
 insert into invites(invitee,inviter) values(u,o.id);
 perform pay_invite_join(u);
 return jsonb_build_object('id',o.id,'username',o.username,'college',o.college);
end $$;

create or replace function public.my_invite() returns jsonb
language plpgsql security definer set search_path=public as $$
declare u uuid := auth.uid(); c text; a text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; i integer;
begin
 if u is null then raise exception 'Authentication required'; end if;
 select code into c from invite_codes where user_id=u;
 while c is null loop
  c := '';
  for i in 1..6 loop c := c||substr(a,1+floor(random()*length(a))::integer,1); end loop;
  begin insert into invite_codes(user_id,code) values(u,c);
  exception when unique_violation then
   select code into c from invite_codes where user_id=u; -- a second tab beat us, or the code was taken
  end;
 end loop;
 return jsonb_build_object('code',c,'join_reward',10000,'level_reward',5000,'level',2,'max_paid',20,
  'earned',coalesce((select sum(paid) from invites where inviter=u),0),
  'friends',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'username',p.username,'college',p.college,
     'level',xp_level(coalesce(x.xp,0)),'join_paid',i.join_paid_at is not null,'level_paid',i.level_paid_at is not null)
     order by i.created_at desc)
   from invites i join profiles p on p.id=i.invitee left join player_xp x on x.user_id=i.invitee
   where i.inviter=u),'[]'::jsonb));
end $$;

-- Invite payments you haven't been shown yet. Each is returned once.
create or replace function public.invite_news() returns jsonb
language plpgsql security definer set search_path=public as $$
declare u uuid := auth.uid(); r jsonb;
begin
 if u is null then raise exception 'Authentication required'; end if;
 with due as (
  select i.invitee, i.join_paid_at is not null and not i.join_seen j, i.level_paid_at is not null and not i.level_seen l
  from invites i where i.inviter=u and ((i.join_paid_at is not null and not i.join_seen) or (i.level_paid_at is not null and not i.level_seen))
  for update
 ), marked as (
  update invites i set join_seen=join_seen or d.j, level_seen=level_seen or d.l from due d where i.invitee=d.invitee
  returning i.invitee, d.j, d.l, i.join_paid_at, i.level_paid_at
 )
 select coalesce(jsonb_agg(n order by n->>'at'),'[]'::jsonb) into r from (
  select jsonb_build_object('kind','join','amount',10000,'username',p.username,'at',m.join_paid_at) n from marked m join profiles p on p.id=m.invitee where m.j
  union all
  select jsonb_build_object('kind','level','amount',5000,'username',p.username,'at',m.level_paid_at) from marked m join profiles p on p.id=m.invitee where m.l
 ) x;
 return r;
end $$;

-- Bring existing invites up to the new rules, oldest first so the cap keeps the earliest.
do $$ declare r record; begin
 for r in select invitee from invites where join_paid_at is null order by created_at loop
  perform pay_invite_join(r.invitee);
 end loop;
 for r in select invitee from invites where join_paid_at is not null and level_paid_at is null order by created_at loop
  perform pay_invite(r.invitee);
 end loop;
end $$;

revoke all on function public.my_invite(),public.invite_news(),public.invite_pay(uuid,uuid,integer,text),
 public.pay_invite_join(uuid),public.pay_invite(uuid),public.redeem_invite(text)
 from public,anon,authenticated;
grant execute on function public.my_invite(),public.invite_news(),public.redeem_invite(text) to authenticated;

commit;

notify pgrst, 'reload schema';
