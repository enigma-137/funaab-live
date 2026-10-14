-- 023: Students can change their username from their profile. Apply once AFTER 022.
-- Same rules as signup (3–20 letters, numbers or underscores; unique ignoring case), once
-- every 7 days so names can't churn to dodge reports or impersonate. Direct column updates
-- are revoked so the rules can't be skipped. Past records (transfers, chat) keep the old name.
begin;

alter table public.profiles add column if not exists username_changed_at timestamptz;

create or replace function public.change_username(p_username text) returns public.profiles
language plpgsql security definer set search_path = public as $$
declare result public.profiles; clean text := btrim(coalesce(p_username, ''));
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if clean !~ '^[A-Za-z0-9_]{3,20}$' then
    raise exception 'Username must be 3–20 letters, numbers or underscores.';
  end if;
  select * into result from public.profiles where id = auth.uid() for update;
  if not found then raise exception 'Profile missing'; end if;
  if result.username = clean then return result; end if;
  if result.username_changed_at is not null and result.username_changed_at > now() - interval '7 days' then
    raise exception 'You can change your username once a week. Try again on %.',
      to_char(result.username_changed_at + interval '7 days', 'Dy DD Mon');
  end if;
  -- Serialise claims on the same name (any case) so two students can't take it at once.
  perform pg_advisory_xact_lock(hashtext('username:' || lower(clean)));
  if exists (select 1 from public.profiles where lower(username) = lower(clean) and id <> auth.uid()) then
    raise exception 'The username @% is already taken. Please choose another.', clean;
  end if;
  update public.profiles set username = clean, username_changed_at = now(), updated_at = now()
    where id = auth.uid() returning * into result;
  return result;
end $$;
revoke all on function public.change_username(text) from public, anon;
grant execute on function public.change_username(text) to authenticated;

-- Usernames change only through change_username (signup still inserts one).
revoke update(username) on public.profiles from authenticated, anon;

commit;
