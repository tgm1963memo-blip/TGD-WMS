-- Migration 098: Make Opening Balance data visible in Inventory Balance page
--
-- Two problems fixed:
--
-- 1. tgd_import_opening_balance: even when location_code is absent, always
--    insert a tgd_stock_movements row and a tgd_stock_balances row (location_id
--    NULL). NULL location_id cannot use ON CONFLICT, so we do a manual
--    UPDATE-then-INSERT.
--
-- 2. tgd_get_all_customer_stock_balances: extend to UNION opening-balance rows
--    from tgd_stock_balances so they appear in the Inventory Balance page.

-- ────────────────────────────────────────────────────────────────────────────
-- Part 1: fix import RPC to always write stock_movements + stock_balances
-- ────────────────────────────────────────────────────────────────────────────
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
      WHERE location_code = v_location_code LIMIT 1;

      IF v_location_id IS NULL THEN
        v_errors := v_errors || jsonb_build_object('row', v_idx, 'reason', 'ไม่พบ location_code: ' || v_location_code);
        CONTINUE;
      END IF;
    END IF;

    -- Find or create product
    SELECT id INTO v_product_id FROM public.tgd_products WHERE sku = v_product_code LIMIT 1;
    IF v_product_id IS NULL THEN
      INSERT INTO public.tgd_products (sku, name, created_at, updated_at)
      VALUES (v_product_code, v_product_name, now(), now())
      RETURNING id INTO v_product_id;
    ELSE
      UPDATE public.tgd_products
      SET name = v_product_name, updated_at = now()
      WHERE id = v_product_id AND (name = sku OR name IS NULL);
    END IF;

    -- Ensure customer_products mapping
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
      WHERE customer_id = p_customer_id AND product_id = v_product_id AND lot_number = v_lot_no LIMIT 1;

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
      DECLARE v_auto_lot text := 'OB-' || to_char(v_occurred_at, 'YYYYMMDD') || '-' || v_product_code;
      BEGIN
        SELECT id INTO v_lot_id
        FROM public.tgd_lots
        WHERE customer_id = p_customer_id AND product_id = v_product_id AND lot_number = v_auto_lot LIMIT 1;
        IF v_lot_id IS NULL THEN
          INSERT INTO public.tgd_lots (customer_id, product_id, lot_number, note, created_at, updated_at)
          VALUES (p_customer_id, v_product_id, v_auto_lot, v_note, now(), now())
          RETURNING id INTO v_lot_id;
        END IF;
      END;
    END IF;

    -- Always create stock_movement
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

    -- Always create/update stock_balance
    -- location_id may be NULL: ON CONFLICT cannot match NULLs so we do manual upsert
    IF v_location_id IS NOT NULL THEN
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
    ELSE
      -- Manual upsert for NULL location_id
      UPDATE public.tgd_stock_balances
      SET quantity    = quantity    + v_qty,
          qty_on_hand = qty_on_hand + v_qty,
          weight      = weight      + v_weight,
          updated_at  = now()
      WHERE customer_id = p_customer_id
        AND product_id  = v_product_id
        AND lot_id      = v_lot_id
        AND location_id IS NULL;

      IF NOT FOUND THEN
        INSERT INTO public.tgd_stock_balances (
          customer_id, product_id, lot_id, location_id,
          quantity, qty_on_hand, qty_allocated, weight, uom, updated_at
        ) VALUES (
          p_customer_id, v_product_id, v_lot_id, null,
          v_qty, v_qty, 0, v_weight, 'กล่อง', now()
        );
      END IF;
    END IF;

    v_processed := v_processed + 1;
  END LOOP;

  RETURN jsonb_build_object('processed', v_processed, 'errors', v_errors);
END;
$func$;

GRANT EXECUTE ON FUNCTION public.tgd_import_opening_balance(uuid, jsonb, uuid) TO authenticated;


-- ────────────────────────────────────────────────────────────────────────────
-- Part 2: extend tgd_get_all_customer_stock_balances to include opening-balance
-- rows from tgd_stock_balances
-- ────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.tgd_get_all_customer_stock_balances()
RETURNS TABLE (
  deposit_line_id        uuid,
  deposit_request_id     uuid,
  request_no             text,
  customer_id            uuid,
  received_at            timestamptz,
  customer_product_code  text,
  product_name           text,
  lot_no                 text,
  mfg_date               date,
  exp_date               date,
  actual_note            text,
  location_id            uuid,
  location_code          text,
  temperature_type       text,
  line_no                int,
  balance_boxes          numeric,
  balance_weight         numeric
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  -- ── Source 1: confirmed deposit request lines (existing behaviour) ──────
  SELECT
    l.id                                    AS deposit_line_id,
    dr.id                                   AS deposit_request_id,
    dr.request_no                           AS request_no,
    dr.customer_id                          AS customer_id,
    dr.last_action_at                       AS received_at,
    l.customer_product_code                 AS customer_product_code,
    l.product_name                          AS product_name,
    l.lot_no                                AS lot_no,
    l.mfg_date                              AS mfg_date,
    l.exp_date                              AS exp_date,
    l.actual_note                           AS actual_note,
    l.location_id                           AS location_id,
    loc.location_code                       AS location_code,
    cp.temperature_type                     AS temperature_type,
    l.line_no                               AS line_no,
    COALESCE(l.actual_boxes, 0)             AS balance_boxes,
    COALESCE(l.actual_weight, 0)            AS balance_weight
  FROM tgd_customer_deposit_request_lines l
  JOIN tgd_customer_deposit_requests dr
    ON dr.id = l.deposit_request_id
   AND dr.status IN ('RECEIVED_CONFIRMED', 'CUSTOMER_NOTIFIED', 'COMPLETED')
  LEFT JOIN tgd_locations loc ON loc.id = l.location_id
  LEFT JOIN tgd_customer_products cp
    ON  cp.customer_id           = dr.customer_id
    AND cp.customer_product_code = l.customer_product_code
  WHERE l.actual_boxes > 0

  UNION ALL

  -- ── Source 2: opening balance rows from tgd_stock_balances ──────────────
  SELECT
    sb.id                                   AS deposit_line_id,
    NULL::uuid                              AS deposit_request_id,
    'OPENING-BALANCE'                       AS request_no,
    sb.customer_id                          AS customer_id,
    sm.occurred_at                          AS received_at,
    cp.customer_product_code                AS customer_product_code,
    cp.product_name                         AS product_name,
    lt.lot_number                           AS lot_no,
    lt.mfg_date                             AS mfg_date,
    lt.expiry_date                          AS exp_date,
    lt.note                                 AS actual_note,
    sb.location_id                          AS location_id,
    loc.location_code                       AS location_code,
    cp.temperature_type                     AS temperature_type,
    0                                       AS line_no,
    sb.qty_on_hand                          AS balance_boxes,
    sb.weight                               AS balance_weight
  FROM tgd_stock_balances sb
  JOIN tgd_lots lt ON lt.id = sb.lot_id
  JOIN tgd_customer_products cp
    ON  cp.customer_id         = sb.customer_id
    AND cp.internal_product_id = sb.product_id
  LEFT JOIN tgd_locations loc ON loc.id = sb.location_id
  -- Link to the most-recent OPENING_BALANCE movement for the occurred_at timestamp
  LEFT JOIN LATERAL (
    SELECT occurred_at FROM tgd_stock_movements
    WHERE customer_id   = sb.customer_id
      AND product_id    = sb.product_id
      AND lot_id        = sb.lot_id
      AND movement_type = 'OPENING_BALANCE'
    ORDER BY occurred_at DESC
    LIMIT 1
  ) sm ON true
  WHERE sb.qty_on_hand > 0
    -- Exclude balances already covered by deposit lines above
    AND NOT EXISTS (
      SELECT 1
      FROM tgd_customer_deposit_request_lines dl
      JOIN tgd_customer_deposit_requests dr2 ON dr2.id = dl.deposit_request_id
      JOIN tgd_customer_products cp2
        ON  cp2.customer_id           = dr2.customer_id
        AND cp2.customer_product_code = dl.customer_product_code
      WHERE cp2.internal_product_id = sb.product_id
        AND dl.lot_no               = lt.lot_number
        AND dl.actual_boxes         > 0
        AND dr2.status IN ('RECEIVED_CONFIRMED', 'CUSTOMER_NOTIFIED', 'COMPLETED')
    );
$$;

GRANT EXECUTE ON FUNCTION public.tgd_get_all_customer_stock_balances() TO authenticated;
