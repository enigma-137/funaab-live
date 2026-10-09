-- ==============================================================================
-- Migration 005: Fix inventory schema drift and canonical wallet purchase logic
-- ==============================================================================

-- 1) Repair the current inventory schema in production without breaking existing rows.
ALTER TABLE public.inventory
  ADD COLUMN IF NOT EXISTS created_at timestamptz;

ALTER TABLE public.inventory
  ADD COLUMN IF NOT EXISTS updated_at timestamptz;

UPDATE public.inventory
SET created_at = NOW()
WHERE created_at IS NULL;

UPDATE public.inventory
SET updated_at = COALESCE(updated_at, created_at, NOW())
WHERE updated_at IS NULL;

ALTER TABLE public.inventory
  ALTER COLUMN created_at SET DEFAULT now(),
  ALTER COLUMN updated_at SET DEFAULT now();

ALTER TABLE public.inventory
  ALTER COLUMN created_at SET NOT NULL,
  ALTER COLUMN updated_at SET NOT NULL;

-- 2) Ensure the required unique index/constraint exists for ON CONFLICT (user_id, item_id).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.inventory'::regclass
      AND conname = 'inventory_user_id_item_id_key'
  ) THEN
    CREATE UNIQUE INDEX IF NOT EXISTS inventory_user_id_item_id_key
      ON public.inventory (user_id, item_id);
  END IF;
END
$$;

-- 3) Canonical atomic wallet purchase RPC.
--    Guarantees wallet lock -> balance check -> wallet debit -> ledger entry -> inventory upsert.
--    If the inventory write fails, the wallet debit is rolled back by the single transaction.
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
  v_user_id := COALESCE(auth.uid(), p_user_id);
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Authentication required'
    );
  END IF;

  v_type := COALESCE(p_type, 'food_purchase');

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

  INSERT INTO public.wallets (user_id, balance, created_at, updated_at)
  VALUES (v_user_id, 2500, NOW(), NOW())
  ON CONFLICT (user_id) DO NOTHING;

  SELECT balance
  INTO v_current_balance
  FROM public.wallets
  WHERE user_id = v_user_id
  FOR UPDATE;

  IF v_current_balance IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Wallet record could not be loaded'
    );
  END IF;

  IF v_current_balance < v_price THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Insufficient funds in student wallet',
      'balance', v_current_balance,
      'required', v_price
    );
  END IF;

  UPDATE public.wallets
  SET balance = balance - v_price,
      updated_at = NOW()
  WHERE user_id = v_user_id
  RETURNING balance INTO v_new_balance;

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

  IF p_item_id IS NOT NULL THEN
    INSERT INTO public.inventory (
      user_id,
      item_id,
      item_name,
      item_type,
      quantity,
      created_at,
      updated_at
    ) VALUES (
      v_user_id,
      p_item_id,
      v_item_name,
      'food',
      1,
      NOW(),
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

GRANT EXECUTE ON FUNCTION public.process_wallet_purchase(text, numeric, text, text, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.process_wallet_purchase(text, numeric, text, text, text, uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.process_wallet_purchase(text, numeric, text, text, text, uuid) TO service_role;
