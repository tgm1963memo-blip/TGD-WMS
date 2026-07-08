-- Migration 099: Rewrite Opening Balance Import — creates a real deposit request
--
-- Previous approach (096–098) wrote directly to stock_balances/stock_movements
-- and required modifying tgd_get_all_customer_stock_balances. This was fragile.
--
-- New approach: treat import as an auto-confirmed deposit request.
--   1. Create tgd_customer_deposit_requests (status = RECEIVED_CONFIRMED)
--   2. Create tgd_customer_deposit_request_lines with actual_boxes set
--   3. Ensure tgd_customer_products mapping exists
--   4. Call tgd_create_stock_movements_from_deposit (stock_movements + stock_balances)
--
-- The existing tgd_get_all_customer_stock_balances RPC already reads
-- RECEIVED_CONFIRMED deposit lines — NO changes needed there.
--
-- Fix for migration 098 error: 098 tried to change the return type of
-- tgd_get_all_customer_stock_balances and failed. Run this DROP first so
-- the old definition is clean, then restore it to original below.

-- tgd_get_all_customer_stock_balances is NOT changed here.
-- Migration 098 Part 2 failed with "cannot change return type", so the original
-- function is still intact. With the new approach (deposit requests), the original
-- function already reads RECEIVED_CONFIRMED lines — no change needed.

-- ─── New tgd_import_opening_balance ─────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.tgd_import_opening_balance(
  p_customer_id uuid,
  p_rows        jsonb,
  p_actor_id    uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_row            jsonb;
  v_idx            int := 0;
  v_product_code   text;
  v_product_name   text;
  v_lot_no         text;
  v_mfg_date       date;
  v_expiry_date    date;
  v_location_code  text;
  v_qty            numeric;
  v_weight         numeric;
  v_note           text;

  v_product_id     uuid;
  v_location_id    uuid;

  v_request_id     uuid;
  v_request_no     text;
  v_processed      int := 0;
  v_errors         jsonb := '[]'::jsonb;
BEGIN
  -- Generate unique request_no: OB-YYYYMMDD-HH24MISS
  v_request_no := 'OB-' || to_char(now(), 'YYYYMMDD-HH24MISS');

  -- Ensure uniqueness (in case of concurrent imports in the same second)
  WHILE EXISTS (SELECT 1 FROM public.tgd_customer_deposit_requests WHERE request_no = v_request_no) LOOP
    v_request_no := 'OB-' || to_char(now(), 'YYYYMMDD-HH24MISS') || '-' || (floor(random()*900)+100)::text;
  END LOOP;

  -- Create the deposit request (already confirmed — no workflow needed)
  -- Use only required columns to avoid FK issues on optional audit columns
  INSERT INTO public.tgd_customer_deposit_requests (
    request_no,
    customer_id,
    status,
    expected_arrival_date,
    last_action_at,
    created_at,
    updated_at
  ) VALUES (
    v_request_no,
    p_customer_id,
    'RECEIVED_CONFIRMED',
    now()::date,
    now(),
    now(),
    now()
  )
  RETURNING id INTO v_request_id;

  -- Process each row
  FOR v_row IN SELECT * FROM jsonb_array_elements(p_rows)
  LOOP
    v_idx := v_idx + 1;

    v_product_code  := trim(v_row->>'customer_product_code');
    v_product_name  := trim(coalesce(nullif(v_row->>'product_name',''), v_product_code));
    v_lot_no        := nullif(trim(v_row->>'lot_no'), '');
    v_location_code := nullif(trim(v_row->>'location_code'), '');
    v_note          := nullif(trim(v_row->>'note'), '');
    v_qty           := (v_row->>'qty_boxes')::numeric;
    v_weight        := coalesce(nullif(trim(v_row->>'weight_kg'), ''), '0')::numeric;

    BEGIN v_mfg_date    := nullif(trim(v_row->>'mfg_date'), '')::date;
    EXCEPTION WHEN OTHERS THEN v_mfg_date := null; END;
    BEGIN v_expiry_date := nullif(trim(v_row->>'expiry_date'), '')::date;
    EXCEPTION WHEN OTHERS THEN v_expiry_date := null; END;

    -- Validate
    IF v_product_code IS NULL OR v_product_code = '' THEN
      v_errors := v_errors || jsonb_build_object('row', v_idx, 'reason', 'customer_product_code ไม่ระบุ');
      CONTINUE;
    END IF;
    IF v_qty IS NULL OR v_qty <= 0 THEN
      v_errors := v_errors || jsonb_build_object('row', v_idx, 'reason', 'qty_boxes ต้องมากกว่า 0');
      CONTINUE;
    END IF;

    -- Resolve location (optional)
    v_location_id := null;
    IF v_location_code IS NOT NULL THEN
      SELECT id INTO v_location_id
      FROM public.tgd_locations WHERE location_code = v_location_code LIMIT 1;
      IF v_location_id IS NULL THEN
        v_errors := v_errors || jsonb_build_object('row', v_idx, 'reason', 'ไม่พบ location_code: ' || v_location_code);
        CONTINUE;
      END IF;
    END IF;

    -- Find or create internal product (for tgd_create_stock_movements_from_deposit)
    SELECT id INTO v_product_id FROM public.tgd_products WHERE sku = v_product_code LIMIT 1;
    IF v_product_id IS NULL THEN
      INSERT INTO public.tgd_products (sku, name, created_at, updated_at)
      VALUES (v_product_code, v_product_name, now(), now())
      RETURNING id INTO v_product_id;
    END IF;

    -- Ensure customer_products mapping (so tgd_create_stock_movements_from_deposit can find it)
    INSERT INTO public.tgd_customer_products (
      customer_id, customer_product_code, product_name, internal_product_id, created_at, updated_at
    ) VALUES (
      p_customer_id, v_product_code, v_product_name, v_product_id, now(), now()
    )
    ON CONFLICT (customer_id, customer_product_code)
    DO UPDATE SET internal_product_id = v_product_id, product_name = v_product_name, updated_at = now();

    -- Create deposit line with actual receipt recorded
    INSERT INTO public.tgd_customer_deposit_request_lines (
      deposit_request_id,
      line_no,
      customer_product_code,
      product_name,
      lot_no,
      mfg_date,
      exp_date,
      expected_boxes,
      expected_weight,
      actual_boxes,
      actual_weight,
      actual_note,
      location_id,
      uom,
      created_at
    ) VALUES (
      v_request_id,
      v_idx,
      v_product_code,
      v_product_name,
      v_lot_no,
      v_mfg_date,
      v_expiry_date,
      v_qty,
      v_weight,
      v_qty,      -- actual = same as expected for opening balance
      v_weight,
      v_note,
      v_location_id,
      'กล่อง',
      now()
    );

    v_processed := v_processed + 1;
  END LOOP;

  -- Create stock movements + balances via the existing confirmed function
  -- (only lines with location_id AND a resolvable product will create stock_balances)
  IF v_processed > 0 THEN
    PERFORM public.tgd_create_stock_movements_from_deposit(v_request_id, p_actor_id);
  END IF;

  RETURN jsonb_build_object(
    'processed',   v_processed,
    'request_id',  v_request_id,
    'request_no',  v_request_no,
    'errors',      v_errors
  );
END;
$func$;

GRANT EXECUTE ON FUNCTION public.tgd_import_opening_balance(uuid, jsonb, uuid) TO authenticated;
