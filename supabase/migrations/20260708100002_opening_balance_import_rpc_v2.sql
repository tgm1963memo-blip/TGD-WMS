-- Migration 096: Opening Balance Import RPC v2
--
-- Changes from 095:
--   - location_code is now optional (was required)
--   - added note field stored on tgd_lots
--   - if location_code is absent: creates product + customer_product + lot only
--   - if location_code is present: also creates stock_movement + stock_balance

-- Ensure tgd_lots has a note column (add if missing)
ALTER TABLE public.tgd_lots
  ADD COLUMN IF NOT EXISTS note text;

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
  v_lot_id         uuid;
  v_location_id    uuid;
  v_occurred_at    timestamptz := now();

  v_processed      int := 0;
  v_errors         jsonb := '[]'::jsonb;
BEGIN
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
      FROM public.tgd_locations
      WHERE location_code = v_location_code
      LIMIT 1;

      IF v_location_id IS NULL THEN
        v_errors := v_errors || jsonb_build_object('row', v_idx, 'reason', 'ไม่พบ location_code: ' || v_location_code);
        CONTINUE;
      END IF;
    END IF;

    -- Find or create tgd_products
    SELECT id INTO v_product_id FROM public.tgd_products WHERE sku = v_product_code LIMIT 1;
    IF v_product_id IS NULL THEN
      INSERT INTO public.tgd_products (sku, name, created_at, updated_at)
      VALUES (v_product_code, v_product_name, now(), now())
      RETURNING id INTO v_product_id;
    ELSE
      -- Update name if it was just the code before
      UPDATE public.tgd_products
      SET name = v_product_name, updated_at = now()
      WHERE id = v_product_id AND (name = sku OR name IS NULL);
    END IF;

    -- Ensure tgd_customer_products mapping
    INSERT INTO public.tgd_customer_products (
      customer_id, customer_product_code, product_name, internal_product_id, created_at, updated_at
    ) VALUES (
      p_customer_id, v_product_code, v_product_name, v_product_id, now(), now()
    )
    ON CONFLICT (customer_id, customer_product_code)
    DO UPDATE SET internal_product_id = v_product_id, product_name = v_product_name, updated_at = now();

    -- Find or create lot
    IF v_lot_no IS NOT NULL THEN
      SELECT id INTO v_lot_id
      FROM public.tgd_lots
      WHERE customer_id = p_customer_id AND product_id = v_product_id AND lot_number = v_lot_no
      LIMIT 1;

      IF v_lot_id IS NULL THEN
        INSERT INTO public.tgd_lots (customer_id, product_id, lot_number, mfg_date, expiry_date, note, created_at, updated_at)
        VALUES (p_customer_id, v_product_id, v_lot_no, v_mfg_date, v_expiry_date, v_note, now(), now())
        RETURNING id INTO v_lot_id;
      ELSE
        UPDATE public.tgd_lots
        SET mfg_date = coalesce(v_mfg_date, mfg_date),
            expiry_date = coalesce(v_expiry_date, expiry_date),
            note = coalesce(v_note, note),
            updated_at = now()
        WHERE id = v_lot_id;
      END IF;
    ELSE
      -- Auto lot per product (no lot_no provided)
      DECLARE v_auto_lot text := 'OB-' || to_char(v_occurred_at, 'YYYYMMDD') || '-' || v_product_code;
      BEGIN
        SELECT id INTO v_lot_id
        FROM public.tgd_lots
        WHERE customer_id = p_customer_id AND product_id = v_product_id AND lot_number = v_auto_lot
        LIMIT 1;

        IF v_lot_id IS NULL THEN
          INSERT INTO public.tgd_lots (customer_id, product_id, lot_number, note, created_at, updated_at)
          VALUES (p_customer_id, v_product_id, v_auto_lot, v_note, now(), now())
          RETURNING id INTO v_lot_id;
        END IF;
      END;
    END IF;

    -- If location provided: create stock movement + balance
    IF v_location_id IS NOT NULL THEN
      INSERT INTO public.tgd_stock_movements (
        customer_id, product_id, lot_id,
        from_location_id, to_location_id, source_location_id, target_location_id,
        quantity, weight, movement_type, movement_date,
        source_module, created_by, occurred_at, source_reference
      ) VALUES (
        p_customer_id, v_product_id, v_lot_id,
        null, v_location_id, null, v_location_id,
        v_qty, v_weight, 'OPENING_BALANCE', v_occurred_at::date,
        'OPENING_BALANCE_IMPORT', p_actor_id, v_occurred_at, 'OB-IMPORT'
      );

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
    END IF;

    v_processed := v_processed + 1;
  END LOOP;

  RETURN jsonb_build_object('processed', v_processed, 'errors', v_errors);
END;
$func$;

GRANT EXECUTE ON FUNCTION public.tgd_import_opening_balance(uuid, jsonb, uuid) TO authenticated;
