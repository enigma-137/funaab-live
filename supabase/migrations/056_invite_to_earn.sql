-- 056: Invite to earn. Apply once AFTER 055.
-- Every student gets a personal invite link (?invite=CODE). A new student who signs up through it is
-- linked to the inviter, and the inviter is paid ₦10,000 once that student reaches Level 2, so a
-- throwaway account that never plays pays nothing. At most 20 paid invites per student.
-- Mirrors src/config/invites.ts (scripts/test-invites-db.ts checks drift).
begin;

create table public.invite_codes(
 user_id uuid primary key references public.profiles(id) on delete cascade,
 code text not null unique check(code ~ '^[A-Z2-9]{6}$'),
 created_at timestamptz not null default now()
);
create table public.invites(
 invitee uuid primary key references public.profiles(id) on delete cascade,
 inviter uuid not null references public.profiles(id) on delete cascade check(inviter<>invitee),
 created_at timestamptz not null default now(),
 paid_at timestamptz, paid integer check(paid>0)
);
create index invites_inviter on public.invites(inviter);
alter table public.invite_codes enable row level security;
alter table public.invites enable row level security;
revoke all on public.invite_codes,public.invites from anon,authenticated;

-- Your code (made the first time you ask) and how your invites are doing.
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
 return jsonb_build_object('code',c,'reward',10000,'level',2,'max_paid',20,
  'earned',coalesce((select sum(paid) from invites where inviter=u),0),
  'friends',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'username',p.username,'college',p.college,
     'level',xp_level(coalesce(x.xp,0)),'paid',i.paid_at is not null) order by i.created_at desc)
   from invites i join profiles p on p.id=i.invitee left join player_xp x on x.user_id=i.invitee
   where i.inviter=u),'[]'::jsonb));
end $$;

-- Who a code belongs to, so the sign-up page can say who invited you. Usernames are public already.
create or replace function public.invite_owner(p_code text) returns text
language sql stable security definer set search_path=public as $$
 select p.username from invite_codes c join profiles p on p.id=c.user_id where c.code=upper(trim(p_code)) $$;

-- Pays the inviter once the student they brought reaches Level 2. Called by the XP trigger.
create or replace function public.pay_invite(p_invitee uuid) returns integer
language plpgsql security definer set search_path=public as $$
declare v invites; b numeric; who text;
begin
 select * into v from invites where invitee=p_invitee and paid_at is null for update;
 if not found then return 0; end if;
 if xp_level(coalesce((select xp from player_xp where user_id=p_invitee),0)) < 2 then return 0; end if;
 perform 1 from profiles where id=v.inviter for update; -- serializes the cap per inviter
 if (select count(*) from invites where inviter=v.inviter and paid_at is not null) >= 20 then return 0; end if;
 update wallets set balance=balance+10000,updated_at=now() where user_id=v.inviter returning balance into b;
 if not found then return 0; end if;
 select username into who from profiles where id=p_invitee;
 insert into wallet_transactions(user_id,type,amount,balance_after,description,metadata)
  values(v.inviter,'invite_reward',10000,b,'Invite reward: @'||who||' reached Level 2',jsonb_build_object('invitee',p_invitee));
 update invites set paid_at=now(),paid=10000 where invitee=p_invitee;
 return 10000;
end $$;

create or replace function public.invite_xp_trigger() returns trigger
language plpgsql security definer set search_path=public as $$
begin
 if new.xp>=100 and old.xp<100 then -- crossing into Level 2 (xp_level: 25(L-1)(L+2))
  begin perform pay_invite(new.user_id);
  exception when others then null; end; -- never block the XP that triggered it
 end if;
 return new;
end $$;
create trigger invite_xp after update of xp on public.player_xp for each row execute function public.invite_xp_trigger();

-- A new student links themselves to whoever invited them: once, within 7 days of joining, and only
-- while still Level 1 (the reward is for bringing someone new, not for swapping codes later).
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
 return jsonb_build_object('id',o.id,'username',o.username,'college',o.college);
end $$;

revoke all on function public.my_invite(),public.invite_owner(text),public.pay_invite(uuid),
 public.invite_xp_trigger(),public.redeem_invite(text) from public,anon,authenticated;
grant execute on function public.my_invite(),public.redeem_invite(text) to authenticated;
grant execute on function public.invite_owner(text) to anon,authenticated;

commit;

notify pgrst, 'reload schema';
