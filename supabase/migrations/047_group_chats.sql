-- 047: Group chats with friends. Apply once (safe to re-run).
-- A student makes a group (up to 5 each), adds friends (20 people at most), and the group keeps
-- its last 200 messages so people who were offline catch up. No links in names or messages,
-- and at most 20 messages a minute (one a second) per student. Rules match src/config/groupChat.ts.
begin;

create table if not exists public.chat_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 40),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);
create table if not exists public.chat_group_members (
  group_id uuid not null references public.chat_groups(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  last_read bigint not null default 0,
  primary key (group_id, user_id)
);
create index if not exists chat_group_members_user on public.chat_group_members(user_id);
create table if not exists public.chat_group_messages (
  id bigserial primary key,
  group_id uuid not null references public.chat_groups(id) on delete cascade,
  sender_id uuid references public.profiles(id) on delete set null,
  kind text not null default 'text' check (kind in ('text','system')),
  body text not null check (char_length(body) between 1 and 500),
  created_at timestamptz not null default now()
);
create index if not exists chat_group_messages_group on public.chat_group_messages(group_id, id);
create index if not exists chat_group_messages_sender on public.chat_group_messages(sender_id, created_at);

-- Only through the functions below.
alter table public.chat_groups enable row level security;
alter table public.chat_group_members enable row level security;
alter table public.chat_group_messages enable row level security;
revoke all on public.chat_groups, public.chat_group_members, public.chat_group_messages from anon, authenticated;

create or replace function public.chat_has_link(p text) returns boolean
language sql immutable set search_path=public as $$
 select coalesce(p,'') ~* '(https?://|www\.|\m(wa|t)\s*\.\s*me\M|\m[a-z0-9-]+\s*(\.|\(dot\)|\[dot\])\s*(com|net|org|ng|io|co|ly|gg|xyz|app|link|info|biz|tk|ml|ga|cf|gq|site|online|live|tv|uk|ru|top|club|shop|store|dev|page|cc|gl|gd)\M)' $$;

create or replace function public.chat_are_friends(a uuid, b uuid) returns boolean
language sql stable security definer set search_path=public as $$
 select exists(select 1 from friends where status='accepted' and ((user_id=a and friend_id=b) or (user_id=b and friend_id=a))) $$;

create or replace function public.chat_clean_name(p text) returns text
language plpgsql immutable set search_path=public as $$
declare n text := btrim(regexp_replace(coalesce(p,''), '\s+', ' ', 'g'));
begin
 if n = '' then raise exception 'Give the group a name'; end if;
 if char_length(n) > 40 then raise exception 'Group names are 40 characters at most'; end if;
 if chat_has_link(n) then raise exception 'Links are not allowed in groups'; end if;
 return n;
end $$;

create or replace function public.chat_name(p uuid) returns text
language sql stable security definer set search_path=public as $$ select coalesce((select username from profiles where id=p),'Someone') $$;

create or replace function public.chat_system(p_group uuid, p_text text) returns void
language sql security definer set search_path=public as $$
 insert into chat_group_messages(group_id,sender_id,kind,body) values(p_group,null,'system',left(p_text,500)) $$;

create or replace function public.chat_member_ids(p_group uuid) returns uuid[]
language sql stable security definer set search_path=public as $$
 select coalesce(array_agg(user_id order by joined_at),'{}') from chat_group_members where group_id=p_group $$;

-- Make a group with some friends.
create or replace function public.group_create(p_name text, p_members uuid[] default '{}') returns jsonb
language plpgsql security definer set search_path=public as $$
declare u uuid := auth.uid(); n text; g uuid; m uuid; added int := 0;
begin
 if u is null then raise exception 'Authentication required'; end if;
 n := chat_clean_name(p_name);
 if (select count(*) from chat_groups where owner_id=u) >= 5 then raise exception 'You can make 5 groups at most. Leave or delete one first.'; end if;
 if coalesce(array_length(p_members,1),0) > 19 then raise exception 'A group holds 20 people at most'; end if;
 insert into chat_groups(name,owner_id) values(n,u) returning id into g;
 insert into chat_group_members(group_id,user_id) values(g,u);
 perform chat_system(g, chat_name(u)||' created the group');
 foreach m in array coalesce(p_members,'{}') loop
  continue when m = u or m is null or exists(select 1 from chat_group_members where group_id=g and user_id=m);
  if not chat_are_friends(u,m) then raise exception 'You can only add friends'; end if;
  insert into chat_group_members(group_id,user_id) values(g,m);
  added := added + 1;
 end loop;
 if added > 0 then perform chat_system(g, chat_name(u)||' added '||(select string_agg(username, ', ') from profiles where id = any(p_members) and id<>u)); end if;
 return jsonb_build_object('id',g,'name',n,'members',chat_member_ids(g));
end $$;

-- Admin only: add a friend.
create or replace function public.group_add(p_group uuid, p_user uuid) returns jsonb
language plpgsql security definer set search_path=public as $$
declare u uuid := auth.uid();
begin
 if u is null then raise exception 'Authentication required'; end if;
 if not exists(select 1 from chat_groups where id=p_group and owner_id=u) then raise exception 'Only the group admin can add people'; end if;
 if exists(select 1 from chat_group_members where group_id=p_group and user_id=p_user) then raise exception 'Already in the group'; end if;
 if not chat_are_friends(u,p_user) then raise exception 'You can only add friends'; end if;
 if (select count(*) from chat_group_members where group_id=p_group) >= 20 then raise exception 'A group holds 20 people at most'; end if;
 insert into chat_group_members(group_id,user_id) values(p_group,p_user);
 perform chat_system(p_group, chat_name(u)||' added '||chat_name(p_user));
 return jsonb_build_object('members',chat_member_ids(p_group));
end $$;

-- Admin only: remove someone.
create or replace function public.group_remove(p_group uuid, p_user uuid) returns jsonb
language plpgsql security definer set search_path=public as $$
declare u uuid := auth.uid();
begin
 if u is null then raise exception 'Authentication required'; end if;
 if not exists(select 1 from chat_groups where id=p_group and owner_id=u) then raise exception 'Only the group admin can remove people'; end if;
 if p_user = u then raise exception 'Use Leave group to leave'; end if;
 delete from chat_group_members where group_id=p_group and user_id=p_user;
 if not found then raise exception 'Not in the group'; end if;
 perform chat_system(p_group, chat_name(u)||' removed '||chat_name(p_user));
 return jsonb_build_object('members',chat_member_ids(p_group));
end $$;

-- Admin only: rename.
create or replace function public.group_rename(p_group uuid, p_name text) returns jsonb
language plpgsql security definer set search_path=public as $$
declare u uuid := auth.uid(); n text;
begin
 if u is null then raise exception 'Authentication required'; end if;
 if not exists(select 1 from chat_groups where id=p_group and owner_id=u) then raise exception 'Only the group admin can rename the group'; end if;
 n := chat_clean_name(p_name);
 update chat_groups set name=n where id=p_group;
 perform chat_system(p_group, chat_name(u)||' renamed the group to '||n);
 return jsonb_build_object('name',n,'members',chat_member_ids(p_group));
end $$;

-- Leave. If the admin leaves, the longest-standing member becomes admin; an empty group is deleted.
create or replace function public.group_leave(p_group uuid) returns jsonb
language plpgsql security definer set search_path=public as $$
declare u uuid := auth.uid(); nxt uuid;
begin
 if u is null then raise exception 'Authentication required'; end if;
 delete from chat_group_members where group_id=p_group and user_id=u;
 if not found then raise exception 'Not in the group'; end if;
 select user_id into nxt from chat_group_members where group_id=p_group order by joined_at, user_id limit 1;
 if nxt is null then delete from chat_groups where id=p_group; return jsonb_build_object('deleted',true,'members','[]'::jsonb); end if;
 perform chat_system(p_group, chat_name(u)||' left');
 if exists(select 1 from chat_groups where id=p_group and owner_id=u) then
  update chat_groups set owner_id=nxt where id=p_group;
  perform chat_system(p_group, chat_name(nxt)||' is now the admin');
 end if;
 return jsonb_build_object('deleted',false,'members',chat_member_ids(p_group));
end $$;

-- Send a message: members only, no links, not too fast.
create or replace function public.group_send(p_group uuid, p_body text) returns jsonb
language plpgsql security definer set search_path=public as $$
declare u uuid := auth.uid(); b text := btrim(coalesce(p_body,'')); mid bigint;
begin
 if u is null then raise exception 'Authentication required'; end if;
 if not exists(select 1 from chat_group_members where group_id=p_group and user_id=u) then raise exception 'You are not in this group'; end if;
 if b = '' then raise exception 'Type a message'; end if;
 if char_length(b) > 500 then raise exception 'Messages are 500 characters at most'; end if;
 if chat_has_link(b) then raise exception 'Links are not allowed in groups'; end if;
 if exists(select 1 from chat_group_messages where sender_id=u and created_at > now() - interval '1 second')
    or (select count(*) from chat_group_messages where sender_id=u and created_at > now() - interval '1 minute') >= 20
 then raise exception 'Slow down a little before sending again'; end if;
 insert into chat_group_messages(group_id,sender_id,body) values(p_group,u,b) returning id into mid;
 update chat_group_members set last_read=mid where group_id=p_group and user_id=u;
 -- Keep the last 200.
 delete from chat_group_messages where group_id=p_group and id <= mid - 200
   and id not in (select id from chat_group_messages where group_id=p_group order by id desc limit 200);
 return jsonb_build_object('id',mid,'members',chat_member_ids(p_group));
end $$;

-- My groups: name, admin, people, the last message and how many are unread.
create or replace function public.group_list() returns jsonb
language plpgsql stable security definer set search_path=public as $$
declare u uuid := auth.uid();
begin
 if u is null then raise exception 'Authentication required'; end if;
 return coalesce((select jsonb_agg(x order by x->>'at' desc) from (
  select jsonb_build_object(
   'id',g.id,'name',g.name,'owner',g.owner_id,
   'count',(select count(*) from chat_group_members where group_id=g.id),
   'unread',(select count(*) from chat_group_messages m where m.group_id=g.id and m.id>me.last_read and m.sender_id is distinct from u),
   'last',(select jsonb_build_object('id',m.id,'kind',m.kind,'body',m.body,'sender',p.username,'at',m.created_at)
            from chat_group_messages m left join profiles p on p.id=m.sender_id where m.group_id=g.id order by m.id desc limit 1),
   'at',coalesce((select max(created_at) from chat_group_messages where group_id=g.id), g.created_at)
  ) x
  from chat_group_members me join chat_groups g on g.id=me.group_id where me.user_id=u) s), '[]'::jsonb);
end $$;

-- One group: its people and messages (newer than p_after), and mark them read.
create or replace function public.group_messages(p_group uuid, p_after bigint default 0) returns jsonb
language plpgsql security definer set search_path=public as $$
declare u uuid := auth.uid(); top bigint;
begin
 if u is null then raise exception 'Authentication required'; end if;
 if not exists(select 1 from chat_group_members where group_id=p_group and user_id=u) then raise exception 'You are not in this group'; end if;
 select max(id) into top from chat_group_messages where group_id=p_group;
 update chat_group_members set last_read=greatest(last_read,coalesce(top,0)) where group_id=p_group and user_id=u;
 return jsonb_build_object(
  'id',p_group,
  'name',(select name from chat_groups where id=p_group),
  'owner',(select owner_id from chat_groups where id=p_group),
  'members',(select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'username',p.username,'college',p.college) order by m.joined_at),'[]') from chat_group_members m join profiles p on p.id=m.user_id where m.group_id=p_group),
  'messages',(select coalesce(jsonb_agg(jsonb_build_object('id',x.id,'kind',x.kind,'body',x.body,'sender_id',x.sender_id,'sender',x.username,'college',x.college,'at',x.created_at) order by x.id),'[]')
    from (select m.*, p.username, p.college from chat_group_messages m left join profiles p on p.id=m.sender_id
          where m.group_id=p_group and m.id>coalesce(p_after,0) order by m.id desc limit 100) x));
end $$;

revoke all on function public.chat_are_friends(uuid,uuid), public.chat_name(uuid), public.chat_system(uuid,text), public.chat_member_ids(uuid) from public, anon, authenticated;
revoke all on function public.group_create(text,uuid[]), public.group_add(uuid,uuid), public.group_remove(uuid,uuid), public.group_rename(uuid,text),
  public.group_leave(uuid), public.group_send(uuid,text), public.group_list(), public.group_messages(uuid,bigint) from public, anon;
grant execute on function public.group_create(text,uuid[]), public.group_add(uuid,uuid), public.group_remove(uuid,uuid), public.group_rename(uuid,text),
  public.group_leave(uuid), public.group_send(uuid,text), public.group_list(), public.group_messages(uuid,bigint) to authenticated;
commit;
