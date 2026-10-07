-- ==============================================================================
-- FUNAAB Life - Database Schema Migration
-- ==============================================================================

-- 1. PROFILES TABLE
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  college text not null default 'COLENG',
  avatar_config jsonb not null default '{"shirtColor": "#15803d", "skinColor": "#8d5524", "hairStyle": "short", "gender": "neutral"}'::jsonb,
  last_world text not null default 'funaab',
  is_online boolean default false,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- 2. WALLETS TABLE (Server Authoritative)
create table if not exists public.wallets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique not null references public.profiles(id) on delete cascade,
  balance numeric(12, 2) not null default 5000.00 check (balance >= 0),
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- 3. WALLET TRANSACTIONS LEDGER
create table if not exists public.wallet_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null, -- 'starter', 'keke_fare', 'food_purchase', 'p2p_transfer_out', 'p2p_transfer_in', 'ps_reward'
  amount numeric(12, 2) not null,
  balance_after numeric(12, 2) not null,
  description text not null,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now() not null
);

-- 4. INVENTORY TABLE
create table if not exists public.inventory (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  item_id text not null,
  item_name text not null,
  item_type text not null default 'food', -- 'food', 'drink', 'badge', 'wearable'
  quantity integer not null default 1 check (quantity > 0),
  created_at timestamptz default now() not null,
  unique (user_id, item_id)
);

-- 5. FRIENDS TABLE
create table if not exists public.friends (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  friend_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'accepted' check (status in ('pending', 'accepted', 'rejected')),
  created_at timestamptz default now() not null,
  unique (user_id, friend_id)
);

-- 6. BLOCKS TABLE
create table if not exists public.blocks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  blocked_user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz default now() not null,
  unique (user_id, blocked_user_id)
);

-- 7. REPORTS TABLE
create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  reported_user_id uuid not null references public.profiles(id) on delete cascade,
  reason text not null,
  details text default '',
  created_at timestamptz default now() not null
);

-- Indexes for performance
create index if not exists idx_profiles_username on public.profiles(username);
create index if not exists idx_transactions_user on public.wallet_transactions(user_id, created_at desc);
create index if not exists idx_friends_user on public.friends(user_id);
create index if not exists idx_blocks_user on public.blocks(user_id);

-- RLS (Row Level Security) Policies
alter table public.profiles enable row level security;
alter table public.wallets enable row level security;
alter table public.wallet_transactions enable row level security;
alter table public.inventory enable row level security;
alter table public.friends enable row level security;
alter table public.blocks enable row level security;
alter table public.reports enable row level security;

-- Public profiles viewable by all authenticated users
create policy "Public profiles are viewable by everyone" on public.profiles for select using (true);
create policy "Users can update own profile" on public.profiles for update using (auth.uid() = id);
create policy "Users can insert own profile" on public.profiles for insert with check (auth.uid() = id);

-- Wallets viewable only by owner
create policy "Users can view own wallet" on public.wallets for select using (auth.uid() = user_id);

-- Transactions viewable only by owner
create policy "Users can view own transactions" on public.wallet_transactions for select using (auth.uid() = user_id);

-- Inventory
create policy "Users can view own inventory" on public.inventory for select using (auth.uid() = user_id);
create policy "Users can manage own inventory" on public.inventory for all using (auth.uid() = user_id);

-- Friends
create policy "Users can view friendships" on public.friends for select using (auth.uid() = user_id or auth.uid() = friend_id);
create policy "Users can insert friendships" on public.friends for insert with check (auth.uid() = user_id);
create policy "Users can delete own friendships" on public.friends for delete using (auth.uid() = user_id or auth.uid() = friend_id);

-- Blocks
create policy "Users can view own blocks" on public.blocks for select using (auth.uid() = user_id);
create policy "Users can insert blocks" on public.blocks for insert with check (auth.uid() = user_id);
create policy "Users can delete blocks" on public.blocks for delete using (auth.uid() = user_id);

-- Reports
create policy "Users can create reports" on public.reports for insert with check (auth.uid() = reporter_id);

-- Stored procedure for server-authoritative purchases
create or replace function process_wallet_purchase(
  p_user_id uuid,
  p_type text,
  p_amount numeric,
  p_description text,
  p_item_id text default null,
  p_item_name text default null
) returns jsonb language plpgsql security definer as $$
declare
  v_current_balance numeric;
  v_new_balance numeric;
begin
  select balance into v_current_balance from public.wallets where user_id = p_user_id for update;
  if not found then
    return jsonb_build_object('success', false, 'error', 'Wallet not found');
  end if;

  if v_current_balance < p_amount then
    return jsonb_build_object('success', false, 'error', 'Insufficient funds');
  end if;

  v_new_balance := v_current_balance - p_amount;
  update public.wallets set balance = v_new_balance, updated_at = now() where user_id = p_user_id;

  insert into public.wallet_transactions (user_id, type, amount, balance_after, description)
  values (p_user_id, p_type, -p_amount, v_new_balance, p_description);

  if p_item_id is not null and p_item_name is not null then
    insert into public.inventory (user_id, item_id, item_name, quantity)
    values (p_user_id, p_item_id, p_item_name, 1)
    on conflict (user_id, item_id) do update
    set quantity = inventory.quantity + 1;
  end if;

  return jsonb_build_object('success', true, 'balance', v_new_balance);
end;
$$;
