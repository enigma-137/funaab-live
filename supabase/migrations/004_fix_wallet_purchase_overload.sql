-- ============================================================================
-- Migration 004: Fix process_wallet_purchase Function Overload Collision
-- ============================================================================
-- Drops all conflicting/overloaded signatures of process_wallet_purchase
-- and creates exactly ONE canonical, server-authoritative, atomic RPC.

-- 1. Explicitly drop all historical/overloaded signatures
DROP FUNCTION IF EXISTS public.process_wallet_purchase(text, numeric, text, text, text, uuid);
DROP FUNCTION IF EXISTS public.process_wallet_purchase(uuid, text, numeric, text, text, text);
DROP FUNCTION IF EXISTS public.process_wallet_purchase(text, numeric, text, uuid);
DROP FUNCTION IF EXISTS public.process_wallet_purchase(uuid, text, numeric, text);
DROP FUNCTION IF EXISTS public.process_wallet_purchase(text, numeric, text);
DROP FUNCTION IF EXISTS public.process_wallet_purchase(uuid, text, numeric);
DROP FUNCTION IF EXISTS public.process_wallet_purchase(text, numeric);

-- 2. Create the single canonical process_wallet_purchase function
CREATE OR REPLACE FUNCTION public.process_wallet_purchase(
  p_type text DEFAULT 'food_purchase',
  p_amount numeric DEFAULT NULL,
  p_description text DEFAULT NULL,
  p_item_id text DEFAULT NULL,
  p_item_name text DEFAULT NULL,
  p_user_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_current_balance numeric;
  v_new_balance numeric;
  v_price numeric;
  v_item_name text;
  v_type text;
  v_description text;
BEGIN
  -- Resolve authoritative user ID from auth.uid() or explicit p_user_id
  v_user_id := COALESCE(auth.uid(), p_user_id);
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Authentication required'
    );
  END IF;

  v_type := COALESCE(p_type, 'food_purchase');

  -- Server-Authoritative Item Catalog Resolution for Food
  IF p_item_id IS NOT NULL THEN
    CASE p_item_id
      WHEN 'fw_jollof_chicken' THEN
        v_item_name := 'Floral Jollof Rice & Chicken';
        v_price := 1200;
      WHEN 'fw_fried_chicken' THEN
        v_item_name := 'Floral Fried Rice & Chicken';
        v_price := 1300;
      WHEN 'fw_rice_beef' THEN
        v_item_name := 'White Rice & Beef Stew';
        v_price := 1100;
      WHEN 'fw_spaghetti' THEN
        v_item_name := 'Floral Jollof Spaghetti';
        v_price := 1000;
      WHEN 'fw_water' THEN
        v_item_name := 'Bottled Water (75cl)';
        v_price := 150;
      WHEN 'fw_malt' THEN
        v_item_name := 'Chilled Malt Drink';
        v_price := 350;
      ELSE
        v_item_name := COALESCE(p_item_name, 'Food Item');
        v_price := COALESCE(p_amount, 0);
    END CASE;
    v_description := COALESCE(p_description, 'Purchased ' || v_item_name);
  ELSE
    v_price := COALESCE(p_amount, 0);
    v_item_name := COALESCE(p_item_name, 'Campus Service');
    v_description := COALESCE(p_description, v_item_name);
  END IF;

  IF v_price < 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Invalid purchase amount'
    );
  END IF;

  -- Ensure player wallet exists idempotently (self-healing)
  INSERT INTO public.wallets (user_id, balance, created_at, updated_at)
  VALUES (v_user_id, 2500, NOW(), NOW())
  ON CONFLICT (user_id) DO NOTHING;

  -- Lock wallet row to prevent concurrent race conditions
  SELECT balance INTO v_current_balance
  FROM public.wallets
  WHERE user_id = v_user_id
  FOR UPDATE;

  IF v_current_balance IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Wallet record could not be loaded'
    );
  END IF;

  -- Check sufficient funds
  IF v_current_balance < v_price THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Insufficient funds in student wallet',
      'balance', v_current_balance,
      'required', v_price
    );
  END IF;

  -- Atomically deduct price
  UPDATE public.wallets
  SET balance = balance - v_price,
      updated_at = NOW()
  WHERE user_id = v_user_id
  RETURNING balance INTO v_new_balance;

  -- Record transaction ledger entry
  INSERT INTO public.wallet_transactions (
    user_id,
    type,
    amount,
    balance_after,
    description,
    created_at
  ) VALUES (
    v_user_id,
    v_type,
    -v_price,
    v_new_balance,
    v_description,
    NOW()
  );

  -- Atomically upsert inventory if item purchased
  IF p_item_id IS NOT NULL THEN
    INSERT INTO public.inventory (
      user_id,
      item_id,
      item_name,
      item_type,
      quantity,
      updated_at
    ) VALUES (
      v_user_id,
      p_item_id,
      v_item_name,
      'food',
      1,
      NOW()
    )
    ON CONFLICT (user_id, item_id) DO UPDATE
    SET quantity = public.inventory.quantity + 1,
        updated_at = NOW();
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'balance', v_new_balance,
    'item_id', p_item_id,
    'item_name', v_item_name,
    'amount_deducted', v_price
  );
END;
$$;

-- Grant execution permissions to authenticated users and service role
GRANT EXECUTE ON FUNCTION public.process_wallet_purchase(text, numeric, text, text, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.process_wallet_purchase(text, numeric, text, text, text, uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.process_wallet_purchase(text, numeric, text, text, text, uuid) TO service_role;
