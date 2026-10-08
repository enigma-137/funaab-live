-- ==============================================================================
-- FUNAAB LIFE PUBLIC BETA MIGRATION 003: WALLET SELF-HEALING & IDEMPOTENT REPAIR
-- ==============================================================================

-- 1. Ensure starter_balance_granted_at column exists
alter table if exists public.wallets 
add column if not exists starter_balance_granted_at timestamptz default now();

-- 2. IDEMPOTENT WALLET BOOTSTRAP / REPAIR FUNCTION
create or replace function public.ensure_player_wallet(
  p_user_id uuid default null
) returns jsonb language plpgsql security definer as $$
declare
  v_user_id uuid;
  v_wallet record;
begin
  v_user_id := coalesce(auth.uid(), p_user_id);
  if v_user_id is null then
    return jsonb_build_object('success', false, 'error', 'Unauthorized: User not authenticated');
  end if;

  select * into v_wallet
  from public.wallets
  where user_id = v_user_id;

  if not found then
    -- Bootstrap missing wallet with ₦5,000 starter balance
    insert into public.wallets (user_id, balance, starter_balance_granted_at)
    values (v_user_id, 5000.00, now())
    returning * into v_wallet;

    -- Record starter transaction ledger entry
    insert into public.wallet_transactions (user_id, type, amount, balance_after, description)
    values (v_user_id, 'starter_bonus', 5000.00, 5000.00, 'FUNAAB Resumption Starter Allowance');
  end if;

  return jsonb_build_object(
    'success', true,
    'user_id', v_wallet.user_id,
    'balance', v_wallet.balance,
    'starter_granted', v_wallet.starter_balance_granted_at is not null
  );
end;
$$;

-- 3. SELF-HEALING ATOMIC P2P TRANSFER RPC
create or replace function public.transfer_money_p2p(
  p_recipient_username text,
  p_amount numeric,
  p_note text default '',
  p_sender_id uuid default null
) returns jsonb language plpgsql security definer as $$
declare
  v_sender_id uuid;
  v_recipient_id uuid;
  v_recipient_name text;
  v_sender_balance numeric;
  v_recipient_balance numeric;
  v_sender_new_balance numeric;
  v_recipient_new_balance numeric;
  v_clean_username text;
begin
  v_sender_id := coalesce(auth.uid(), p_sender_id);
  if v_sender_id is null then
    return jsonb_build_object('success', false, 'error', 'Unauthorized: User not authenticated');
  end if;

  -- Validate amount
  if p_amount is null or p_amount <= 0 then
    return jsonb_build_object('success', false, 'error', 'Transfer amount must be greater than ₦0.00');
  end if;

  if p_amount > 50000 then
    return jsonb_build_object('success', false, 'error', 'Transfer limit exceeded (Max ₦50,000 per transfer)');
  end if;

  v_clean_username := lower(trim(p_recipient_username));
  if v_clean_username = '' then
    return jsonb_build_object('success', false, 'error', 'Please specify a recipient username');
  end if;

  -- Find recipient in profiles
  select id, username into v_recipient_id, v_recipient_name
  from public.profiles
  where lower(username) = v_clean_username;

  if not found then
    return jsonb_build_object('success', false, 'error', 'Student "' || p_recipient_username || '" was not found on campus');
  end if;

  if v_sender_id = v_recipient_id then
    return jsonb_build_object('success', false, 'error', 'You cannot send money to yourself');
  end if;

  -- Lock sender wallet (and self-heal if missing)
  select balance into v_sender_balance
  from public.wallets
  where user_id = v_sender_id
  for update;

  if not found then
    insert into public.wallets (user_id, balance, starter_balance_granted_at)
    values (v_sender_id, 5000.00, now())
    returning balance into v_sender_balance;

    insert into public.wallet_transactions (user_id, type, amount, balance_after, description)
    values (v_sender_id, 'starter_bonus', 5000.00, 5000.00, 'FUNAAB Resumption Starter Allowance');
  end if;

  if v_sender_balance < p_amount then
    return jsonb_build_object('success', false, 'error', 'Insufficient funds for this transfer');
  end if;

  -- Lock recipient wallet (and self-heal if missing)
  select balance into v_recipient_balance
  from public.wallets
  where user_id = v_recipient_id
  for update;

  if not found then
    insert into public.wallets (user_id, balance, starter_balance_granted_at)
    values (v_recipient_id, 5000.00, now())
    returning balance into v_recipient_balance;

    insert into public.wallet_transactions (user_id, type, amount, balance_after, description)
    values (v_recipient_id, 'starter_bonus', 5000.00, 5000.00, 'FUNAAB Resumption Starter Allowance');
  end if;

  -- Perform atomic balance updates
  v_sender_new_balance := v_sender_balance - p_amount;
  v_recipient_new_balance := v_recipient_balance + p_amount;

  update public.wallets set balance = v_sender_new_balance, updated_at = now() where user_id = v_sender_id;
  update public.wallets set balance = v_recipient_new_balance, updated_at = now() where user_id = v_recipient_id;

  -- Ledger transactions
  insert into public.wallet_transactions (user_id, type, amount, balance_after, description, metadata)
  values (
    v_sender_id,
    'p2p_transfer_out',
    -p_amount,
    v_sender_new_balance,
    'Transfer to @' || v_recipient_name || case when length(p_note) > 0 then ' (' || p_note || ')' else '' end,
    jsonb_build_object('recipient_id', v_recipient_id, 'recipient_username', v_recipient_name, 'note', p_note)
  );

  insert into public.wallet_transactions (user_id, type, amount, balance_after, description, metadata)
  values (
    v_recipient_id,
    'p2p_transfer_in',
    p_amount,
    v_recipient_new_balance,
    'Received from @' || coalesce((select username from public.profiles where id = v_sender_id), 'Student') || case when length(p_note) > 0 then ' (' || p_note || ')' else '' end,
    jsonb_build_object('sender_id', v_sender_id, 'note', p_note)
  );

  return jsonb_build_object(
    'success', true,
    'balance', v_sender_new_balance,
    'recipient_username', v_recipient_name,
    'amount', p_amount
  );
end;
$$;
