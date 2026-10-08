-- ==============================================================================
-- FUNAAB Life - Migration 002: Public Beta Hardening & Server-Authoritative RPCs
-- ==============================================================================

-- 1. Ensure WALLETS has last_daily_reward_at timestamp
alter table if exists public.wallets 
add column if not exists last_daily_reward_at timestamptz default null;

-- 2. JOB COMPLETIONS TABLE
create table if not exists public.job_completions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  job_id text not null,
  job_title text not null,
  reward numeric(12, 2) not null check (reward > 0),
  created_at timestamptz default now() not null
);

create index if not exists idx_job_completions_user on public.job_completions(user_id, created_at desc);

-- 3. LECTURE ATTENDANCE TABLE
create table if not exists public.lecture_attendance (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  lecture_id text not null,
  duration_seconds integer not null default 0 check (duration_seconds >= 0),
  reward_claimed numeric(12, 2) not null default 0.00 check (reward_claimed >= 0),
  created_at timestamptz default now() not null
);

create index if not exists idx_lecture_attendance_user on public.lecture_attendance(user_id, lecture_id, created_at desc);

-- 4. HARDEN ROW LEVEL SECURITY (RLS)
alter table public.job_completions enable row level security;
alter table public.lecture_attendance enable row level security;

-- Drop any potentially permissive wallet update policies if they exist
drop policy if exists "Users can update own wallet" on public.wallets;
drop policy if exists "Users can insert own transactions" on public.wallet_transactions;

-- Strict Select-Only for Wallets and Transactions for clients (mutations happen through SECURITY DEFINER RPCs)
drop policy if exists "Users can view own wallet" on public.wallets;
create policy "Users can view own wallet" on public.wallets for select using (auth.uid() = user_id);

drop policy if exists "Users can view own transactions" on public.wallet_transactions;
create policy "Users can view own transactions" on public.wallet_transactions for select using (auth.uid() = user_id);

-- Job completions & Lecture attendance RLS
drop policy if exists "Users can view own job completions" on public.job_completions;
create policy "Users can view own job completions" on public.job_completions for select using (auth.uid() = user_id);

drop policy if exists "Users can view own lecture attendance" on public.lecture_attendance;
create policy "Users can view own lecture attendance" on public.lecture_attendance for select using (auth.uid() = user_id);

-- Reports RLS hardening
drop policy if exists "Users can view own reports" on public.reports;
create policy "Users can view own reports" on public.reports for select using (auth.uid() = reporter_id);


-- ==============================================================================
-- 5. ATOMIC SECURITY DEFINER RPC FUNCTIONS
-- ==============================================================================

-- A. ATOMIC DAILY REWARD CLAIM
create or replace function public.claim_daily_reward(
  p_user_id uuid default null
) returns jsonb language plpgsql security definer as $$
declare
  v_user_id uuid;
  v_last_reward timestamptz;
  v_current_balance numeric;
  v_reward_amount numeric := 1000.00;
  v_new_balance numeric;
begin
  -- Authoritative identity from auth.uid(), with fallback if passed by service role
  v_user_id := coalesce(auth.uid(), p_user_id);
  if v_user_id is null then
    return jsonb_build_object('success', false, 'error', 'Unauthorized: User not authenticated');
  end if;

  -- Lock wallet record
  select balance, last_daily_reward_at 
  into v_current_balance, v_last_reward 
  from public.wallets 
  where user_id = v_user_id 
  for update;

  if not found then
    -- Auto-initialize wallet if profile exists
    insert into public.wallets (user_id, balance, last_daily_reward_at)
    values (v_user_id, 5000.00 + v_reward_amount, now())
    returning balance into v_new_balance;

    insert into public.wallet_transactions (user_id, type, amount, balance_after, description)
    values (v_user_id, 'daily_reward', v_reward_amount, v_new_balance, 'Daily Campus Student Stipend (Day 1)');

    return jsonb_build_object('success', true, 'reward', v_reward_amount, 'balance', v_new_balance);
  end if;

  -- Check cooldown (20 hours minimum between daily claims)
  if v_last_reward is not null and (now() - v_last_reward) < interval '20 hours' then
    return jsonb_build_object('success', false, 'error', 'Daily reward already claimed today. Please check back tomorrow!');
  end if;

  v_new_balance := v_current_balance + v_reward_amount;

  update public.wallets 
  set balance = v_new_balance, 
      last_daily_reward_at = now(),
      updated_at = now() 
  where user_id = v_user_id;

  insert into public.wallet_transactions (user_id, type, amount, balance_after, description)
  values (v_user_id, 'daily_reward', v_reward_amount, v_new_balance, 'Daily Campus Student Stipend');

  return jsonb_build_object('success', true, 'reward', v_reward_amount, 'balance', v_new_balance);
end;
$$;


-- B. ATOMIC SECURE P2P TRANSFER
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

  -- Find recipient
  select id, username into v_recipient_id, v_recipient_name
  from public.profiles
  where lower(username) = v_clean_username;

  if not found then
    return jsonb_build_object('success', false, 'error', 'Student "' || p_recipient_username || '" was not found on campus');
  end if;

  if v_sender_id = v_recipient_id then
    return jsonb_build_object('success', false, 'error', 'You cannot send money to yourself');
  end if;

  -- Lock sender wallet
  select balance into v_sender_balance
  from public.wallets
  where user_id = v_sender_id
  for update;

  if not found then
    return jsonb_build_object('success', false, 'error', 'Sender wallet not found');
  end if;

  if v_sender_balance < p_amount then
    return jsonb_build_object('success', false, 'error', 'Insufficient funds for this transfer');
  end if;

  -- Lock recipient wallet
  select balance into v_recipient_balance
  from public.wallets
  where user_id = v_recipient_id
  for update;

  if not found then
    -- Create recipient wallet if missing
    insert into public.wallets (user_id, balance) values (v_recipient_id, 5000.00)
    returning balance into v_recipient_balance;
  end if;

  -- Perform atomic balances update
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
    'Transfer to ' || v_recipient_name || (case when p_note <> '' then ' (' || p_note || ')' else '' end),
    jsonb_build_object('recipient_id', v_recipient_id, 'recipient_username', v_recipient_name, 'note', p_note)
  );

  insert into public.wallet_transactions (user_id, type, amount, balance_after, description, metadata)
  values (
    v_recipient_id,
    'p2p_transfer_in',
    p_amount,
    v_recipient_new_balance,
    'Transfer received from student' || (case when p_note <> '' then ' (' || p_note || ')' else '' end),
    jsonb_build_object('sender_id', v_sender_id, 'note', p_note)
  );

  return jsonb_build_object(
    'success', true,
    'balance', v_sender_new_balance,
    'recipient', v_recipient_name,
    'amount', p_amount
  );
end;
$$;


-- C. ATOMIC PURCHASE / DEDUCTION (Food, Keke, Lawn Fine)
create or replace function public.process_wallet_purchase(
  p_type text,
  p_amount numeric,
  p_description text,
  p_item_id text default null,
  p_item_name text default null,
  p_user_id uuid default null
) returns jsonb language plpgsql security definer as $$
declare
  v_user_id uuid;
  v_current_balance numeric;
  v_new_balance numeric;
begin
  v_user_id := coalesce(auth.uid(), p_user_id);
  if v_user_id is null then
    return jsonb_build_object('success', false, 'error', 'Unauthorized: User not authenticated');
  end if;

  if p_amount is null or p_amount <= 0 then
    return jsonb_build_object('success', false, 'error', 'Invalid transaction amount');
  end if;

  select balance into v_current_balance 
  from public.wallets 
  where user_id = v_user_id 
  for update;

  if not found then
    return jsonb_build_object('success', false, 'error', 'Wallet record not found');
  end if;

  if v_current_balance < p_amount then
    return jsonb_build_object('success', false, 'error', 'Insufficient funds');
  end if;

  v_new_balance := v_current_balance - p_amount;
  update public.wallets set balance = v_new_balance, updated_at = now() where user_id = v_user_id;

  insert into public.wallet_transactions (user_id, type, amount, balance_after, description, metadata)
  values (
    v_user_id, 
    p_type, 
    -p_amount, 
    v_new_balance, 
    p_description,
    jsonb_build_object('itemId', p_item_id, 'itemName', p_item_name)
  );

  if p_item_id is not null and p_item_name is not null then
    insert into public.inventory (user_id, item_id, item_name, quantity)
    values (v_user_id, p_item_id, p_item_name, 1)
    on conflict (user_id, item_id) do update
    set quantity = public.inventory.quantity + 1;
  end if;

  return jsonb_build_object('success', true, 'balance', v_new_balance);
end;
$$;


-- D. ATOMIC CAMPUS JOB REWARD CLAIM
create or replace function public.claim_job_reward(
  p_job_id text,
  p_job_title text,
  p_reward numeric,
  p_user_id uuid default null
) returns jsonb language plpgsql security definer as $$
declare
  v_user_id uuid;
  v_current_balance numeric;
  v_new_balance numeric;
  v_last_job_completion timestamptz;
begin
  v_user_id := coalesce(auth.uid(), p_user_id);
  if v_user_id is null then
    return jsonb_build_object('success', false, 'error', 'Unauthorized: User not authenticated');
  end if;

  if p_reward is null or p_reward <= 0 or p_reward > 1000 then
    return jsonb_build_object('success', false, 'error', 'Invalid job reward parameter');
  end if;

  -- Rate limit: 15 seconds cooldown on job completion to prevent rapid automated spam
  select created_at into v_last_job_completion
  from public.job_completions
  where user_id = v_user_id
  order by created_at desc
  limit 1;

  if v_last_job_completion is not null and (now() - v_last_job_completion) < interval '15 seconds' then
    return jsonb_build_object('success', false, 'error', 'Please wait a moment before completing another errand');
  end if;

  -- Lock wallet and credit
  select balance into v_current_balance from public.wallets where user_id = v_user_id for update;
  if not found then
    insert into public.wallets (user_id, balance) values (v_user_id, 5000.00 + p_reward)
    returning balance into v_new_balance;
  else
    v_new_balance := v_current_balance + p_reward;
    update public.wallets set balance = v_new_balance, updated_at = now() where user_id = v_user_id;
  end if;

  -- Record completion
  insert into public.job_completions (user_id, job_id, job_title, reward)
  values (v_user_id, p_job_id, p_job_title, p_reward);

  -- Record ledger
  insert into public.wallet_transactions (user_id, type, amount, balance_after, description, metadata)
  values (
    v_user_id,
    'job_reward',
    p_reward,
    v_new_balance,
    'Job Reward: ' || p_job_title,
    jsonb_build_object('jobId', p_job_id)
  );

  return jsonb_build_object('success', true, 'reward', p_reward, 'balance', v_new_balance);
end;
$$;


-- E. ATOMIC LECTURE ATTENDANCE CLAIM
create or replace function public.claim_lecture_attendance(
  p_lecture_id text,
  p_duration_seconds integer,
  p_allowance numeric,
  p_user_id uuid default null
) returns jsonb language plpgsql security definer as $$
declare
  v_user_id uuid;
  v_current_balance numeric;
  v_new_balance numeric;
  v_recent_attendance timestamptz;
begin
  v_user_id := coalesce(auth.uid(), p_user_id);
  if v_user_id is null then
    return jsonb_build_object('success', false, 'error', 'Unauthorized: User not authenticated');
  end if;

  if p_duration_seconds < 30 then
    return jsonb_build_object('success', false, 'error', 'You must attend for at least 30 seconds to be eligible for attendance allowance');
  end if;

  if p_allowance is null or p_allowance <= 0 or p_allowance > 500 then
    return jsonb_build_object('success', false, 'error', 'Invalid lecture allowance amount');
  end if;

  -- Check duplicate claim for this lecture session in the past 1 hour
  select created_at into v_recent_attendance
  from public.lecture_attendance
  where user_id = v_user_id and lecture_id = p_lecture_id and (now() - created_at) < interval '1 hour'
  limit 1;

  if v_recent_attendance is not null then
    return jsonb_build_object('success', false, 'error', 'Lecture attendance allowance already claimed for this session');
  end if;

  -- Lock and credit wallet
  select balance into v_current_balance from public.wallets where user_id = v_user_id for update;
  if not found then
    insert into public.wallets (user_id, balance) values (v_user_id, 5000.00 + p_allowance)
    returning balance into v_new_balance;
  else
    v_new_balance := v_current_balance + p_allowance;
    update public.wallets set balance = v_new_balance, updated_at = now() where user_id = v_user_id;
  end if;

  -- Record attendance
  insert into public.lecture_attendance (user_id, lecture_id, duration_seconds, reward_claimed)
  values (v_user_id, p_lecture_id, p_duration_seconds, p_allowance);

  -- Record ledger
  insert into public.wallet_transactions (user_id, type, amount, balance_after, description, metadata)
  values (
    v_user_id,
    'lecture_attendance',
    p_allowance,
    v_new_balance,
    'Lecture Attendance Allowance: ' || p_lecture_id,
    jsonb_build_object('lectureId', p_lecture_id, 'durationSeconds', p_duration_seconds)
  );

  return jsonb_build_object('success', true, 'reward', p_allowance, 'balance', v_new_balance);
end;
$$;
