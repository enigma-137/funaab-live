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

-- 4. SERVER-AUTHORITATIVE WALLET PURCHASE & ITEM DEDUCTION RPC
create or replace function public.process_wallet_purchase(
  p_type text default 'food_purchase',
  p_amount numeric default null,
  p_description text default null,
  p_item_id text default null,
  p_item_name text default null,
  p_user_id uuid default null
) returns jsonb language plpgsql security definer as $$
declare
  v_user_id uuid;
  v_item_id text;
  v_item_name text;
  v_item_type text := 'food';
  v_amount numeric;
  v_current_balance numeric;
  v_new_balance numeric;
  v_description text;
begin
  v_user_id := coalesce(auth.uid(), p_user_id);
  if v_user_id is null then
    return jsonb_build_object('success', false, 'error', 'Unauthorized: User not authenticated');
  end if;

  v_item_id := p_item_id;

  -- 1. Server-authoritative catalog resolution if item_id is provided
  if v_item_id = 'fw_jollof_chicken' then
    v_item_name := 'Jollof Rice + Chicken';
    v_amount := 1000.00;
    v_item_type := 'food';
  elsif v_item_id = 'fw_fried_chicken' then
    v_item_name := 'Fried Rice + Chicken';
    v_amount := 1000.00;
    v_item_type := 'food';
  elsif v_item_id = 'fw_rice_beef' then
    v_item_name := 'Rice + Beef';
    v_amount := 800.00;
    v_item_type := 'food';
  elsif v_item_id = 'fw_spaghetti' then
    v_item_name := 'Spaghetti Special';
    v_amount := 700.00;
    v_item_type := 'food';
  elsif v_item_id = 'fw_water' then
    v_item_name := 'Chilled Bottled Water';
    v_amount := 150.00;
    v_item_type := 'drink';
  elsif v_item_id = 'fw_malt' then
    v_item_name := 'Chilled Malt Drink';
    v_amount := 400.00;
    v_item_type := 'drink';
  else
    -- Fallback for non-menu purchases (e.g. keke fares, lawn fines)
    v_item_name := coalesce(p_item_name, 'Campus Item');
    v_amount := p_amount;
  end if;

  if v_amount is null or v_amount <= 0 then
    return jsonb_build_object('success', false, 'error', 'Invalid purchase amount');
  end if;

  v_description := coalesce(p_description, v_item_name);

  -- 2. Lock and ensure player wallet exists (self-healing)
  select balance into v_current_balance
  from public.wallets
  where user_id = v_user_id
  for update;

  if not found then
    insert into public.wallets (user_id, balance, starter_balance_granted_at)
    values (v_user_id, 5000.00, now())
    returning balance into v_current_balance;

    insert into public.wallet_transactions (user_id, type, amount, balance_after, description)
    values (v_user_id, 'starter_bonus', 5000.00, 5000.00, 'FUNAAB Resumption Starter Allowance');
  end if;

  -- 3. Check sufficient balance
  if v_current_balance < v_amount then
    return jsonb_build_object(
      'success', false, 
      'error', 'Insufficient funds! You need ₦' || v_amount::text || ' (Balance: ₦' || v_current_balance::text || ')'
    );
  end if;

  -- 4. Deduct balance atomically
  v_new_balance := v_current_balance - v_amount;
  update public.wallets set balance = v_new_balance, updated_at = now() where user_id = v_user_id;

  -- 5. Insert transaction ledger
  insert into public.wallet_transactions (user_id, type, amount, balance_after, description, metadata)
  values (
    v_user_id,
    coalesce(p_type, 'food_purchase'),
    -v_amount,
    v_new_balance,
    v_description,
    jsonb_build_object('itemId', v_item_id, 'itemName', v_item_name, 'itemType', v_item_type)
  );

  -- 6. Insert/update inventory if an item was purchased
  if v_item_id is not null then
    insert into public.inventory (user_id, item_id, item_name, item_type, quantity)
    values (v_user_id, v_item_id, v_item_name, v_item_type, 1)
    on conflict (user_id, item_id) do update
    set quantity = public.inventory.quantity + 1,
        item_name = excluded.item_name;
  end if;

  return jsonb_build_object(
    'success', true,
    'balance', v_new_balance,
    'item_id', v_item_id,
    'item_name', v_item_name,
    'amount', v_amount
  );
end;
$$;

