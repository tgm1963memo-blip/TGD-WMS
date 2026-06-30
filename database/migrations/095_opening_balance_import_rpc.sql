-- Migration 095: Opening Balance Import RPC
--
-- Allows importing initial stock (product + lot + location + qty) for a customer.
-- Called from the admin Opening Balance Import page via Excel upload.
--
-- Input:  p_customer_id, p_rows (jsonb array), p_actor_id
-- Output: jsonb { processed: N, skipped: [{row, reason}], errors: [{row, reason}] }

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
  v_row_no         int;
  v_product_code   text;
  v_product_name   text;
  v_lot_no         text;
  v_mfg_date       date;
  v_expiry_date    date;
  v_location_code  text;
  v_qty            numeric;
  v_weight         numeric;

  v_product_id     uuid;
  v_lot_id         uuid;
  v_location_id    uuid;
  v_occurred_at    timestamptz := now();

  v_processed      int := 0;
  v_skipped        jsonb := '[]'::jsonb;
  v_errors         jsonb := '[]'::jsonb;
BEGIN
  FOR v_row IN SELECT * FROM jsonb_array_elements(p_rows)
  LOOP
    v_idx    := v_idx + 1;
    v_row_no := v_idx;

    -- Extract fields
    v_product_code  := trim(v_row->>'customer_product_code');
    v_product_name  := trim(coalesce(v_row->>'product_name', v_product_code));
    v_lot_no        := nullif(trim(v_row->>'lot_no'), '');
    v_location_code := trim(v_row->>'location_code');
    v_qty           := (v_row->>'qty_boxes')::numeric;
    v_weight        := coalesce(nullif(trim(v_row->>'weight_kg'), ''), '0')::numeric;

    BEGIN
      v_mfg_date    := nullif(trim(v_row->>'mfg_date'), '')::date;
    EXCEPTION WHEN OTHERS THEN v_mfg_date := null; END;

    BEGIN
      v_expiry_date := nullif(trim(v_row->>'expiry_date'), '')::date;
    EXCEPTION WHEN OTHERS THEN v_expiry_date := null; END;

    -- Validate required fields
    IF v_product_code IS NULL OR v_product_code = '' THEN
      v_errors := v_errors || jsonb_build_object('row', v_row_no, 'reason', 'customer_product_code ไม่ระบุ');
      CONTINUE;
    END IF;
    IF v_location_code IS NULL OR v_location_code = '' THEN
      v_errors := v_errors || jsonb_build_object('row', v_row_no, 'reason', 'location_code ไม่ระบุ');
      CONTINUE;
    END IF;
    IF v_qty IS NULL OR v_qty <= 0 THEN
      v_errors := v_errors || jsonb_build_object('row', v_row_no, 'reason', 'qty_boxes ต้องมากกว่า 0');
      CONTINUE;
    END IF;

    -- Resolve location
    SELECT id INTO v_location_id
    FROM public.tgd_locations
    WHERE location_code = v_location_code
    LIMIT 1;

    IF v_location_id IS NULL THEN
      v_errors := v_errors || jsonb_build_object('row', v_row_no, 'reason', 'ไม่พบ location_code: ' || v_location_code);
      CONTINUE;
    END IF;

    -- Find or create tgd_products by SKU
    SELECT id INTO v_product_id
    FROM public.tgd_products
    WHERE sku = v_product_code
    LIMIT 1;

    IF v_product_id IS NULL THEN
      INSERT INTO public.tgd_products (sku, name, description, created_at, updated_at)
      VALUES (v_product_code, v_product_name, null, now(), now())
      RETURNING id INTO v_product_id;
    END IF;

    -- Ensure tgd_customer_products mapping exists
    INSERT INTO public.tgd_customer_products (
      customer_id, customer_product_code, product_name, internal_product_id, created_at, updated_at
    ) VALUES (
      p_customer_id, v_product_code, v_product_name, v_product_id, now(), now()
    )
    ON CONFLICT (customer_id, customer_product_code)
    DO UPDATE SET
      internal_product_id = v_product_id,
      updated_at          = now();

    -- Find or create lot
    IF v_lot_no IS NOT NULL THEN
      SELECT id INTO v_lot_id
      FROM public.tgd_lots
      WHERE customer_id = p_customer_id
        AND product_id  = v_product_id
        AND lot_number  = v_lot_no
      LIMIT 1;

      IF v_lot_id IS NULL THEN
        INSERT INTO public.tgd_lots (
          customer_id, product_id, lot_number, mfg_date, expiry_date, created_at, updated_at
        ) VALUES (
          p_customer_id, v_product_id, v_lot_no, v_mfg_date, v_expiry_date, now(), now()
        )
        RETURNING id INTO v_lot_id;
      END IF;
    ELSE
      -- No lot_no: use AUTO lot keyed to the import batch date
      DECLARE v_auto_lot text := 'OB-' || to_char(v_occurred_at, 'YYYYMMDD') || '-' || v_product_code;
      BEGIN
        SELECT id INTO v_lot_id
        FROM public.tgd_lots
        WHERE customer_id = p_customer_id
          AND product_id  = v_product_id
          AND lot_number  = v_auto_lot
        LIMIT 1;

        IF v_lot_id IS NULL THEN
          INSERT INTO public.tgd_lots (
            customer_id, product_id, lot_number, mfg_date, expiry_date, created_at, updated_at
          ) VALUES (
            p_customer_id, v_product_id, v_auto_lot, v_mfg_date, v_expiry_date, now(), now()
          )
          RETURNING id INTO v_lot_id;
        END IF;
      END;
    END IF;

    -- Insert stock movement (OPENING_BALANCE)
    INSERT INTO public.tgd_stock_movements (
      customer_id,
      product_id,
      lot_id,
      from_location_id,
      to_location_id,
      source_location_id,
      target_location_id,
      quantity,
      weight,
      movement_type,
      movement_date,
      source_module,
      created_by,
      occurred_at,
      source_reference
    ) VALUES (
      p_customer_id,
      v_product_id,
      v_lot_id,
      null,
      v_location_id,
      null,
      v_location_id,
      v_qty,
      v_weight,
      'OPENING_BALANCE',
      v_occurred_at::date,
      'OPENING_BALANCE_IMPORT',
      p_actor_id,
      v_occurred_at,
      'OB-IMPORT'
    );

    -- Upsert stock balance
    INSERT INTO public.tgd_stock_balances (
      customer_id, product_id, lot_id, location_id,
      quantity, qty_on_hand, qty_allocated, weight, uom, updated_at
    ) VALUES (
      p_customer_id, v_product_id, v_lot_id, v_location_id,
      v_qty, v_qty, 0, v_weight, 'กล่อง', now()
    )
    ON CONFLICT (customer_id, product_id, lot_id, location_id)
    DO UPDATE SET
      quantity    = public.tgd_stock_balances.quantity    + excluded.quantity,
      qty_on_hand = public.tgd_stock_balances.qty_on_hand + excluded.qty_on_hand,
      weight      = public.tgd_stock_balances.weight      + excluded.weight,
      updated_at  = now();

    v_processed := v_processed + 1;

  END LOOP;

  RETURN jsonb_build_object(
    'processed', v_processed,
    'skipped',   v_skipped,
    'errors',    v_errors
  );
END;
$func$;

GRANT EXECUTE ON FUNCTION public.tgd_import_opening_balance(uuid, jsonb, uuid) TO authenticated;
