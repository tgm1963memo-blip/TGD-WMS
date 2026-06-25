-- Migration 078: Comprehensive fix for warehouse map occupancy (tgd_stock_balances)
--
-- Root cause: When a Customer Deposit Request is CONFIRM_RECEIPT'd, the function
-- tgd_create_stock_movements_from_deposit must (a) write tgd_stock_movements and
-- (b) directly upsert tgd_stock_balances.qty_on_hand.  Migrations 072–075 define
-- these fixes but may not have been applied to production.
--
-- This migration is fully idempotent: safe to run even if 072–075 were applied.
--
-- Steps:
--   1. Create/replace tgd_trigger_update_stock_balance (writes qty_on_hand)
--   2. Create trigger on tgd_stock_movements if not exists
--   3. Create/replace tgd_create_stock_movements_from_deposit (final version)
--   4. Patch existing RECEIVE_CONFIRM movements that are missing to_location_id
--   5. Backfill tgd_stock_balances directly from confirmed deposit lines
--   6. Patch NULL lot_id rows that ON CONFLICT cannot match


-- ─────────────────────────────────────────────────────────────────────────────
-- Step 1: Trigger function — writes qty_on_hand (not the old `quantity` column)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.tgd_trigger_update_stock_balance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Deduct from source location (outbound)
  IF NEW.from_location_id IS NOT NULL THEN
    INSERT INTO public.tgd_stock_balances (
      customer_id, product_id, lot_id, location_id,
      quantity, qty_on_hand, qty_allocated, updated_at
    ) VALUES (
      NEW.customer_id, NEW.product_id, NEW.lot_id, NEW.from_location_id,
      -coalesce(NEW.quantity, 0), -coalesce(NEW.quantity, 0), 0, now()
    )
    ON CONFLICT (customer_id, product_id, lot_id, location_id)
    DO UPDATE SET
      quantity    = public.tgd_stock_balances.quantity    - coalesce(NEW.quantity, 0),
      qty_on_hand = public.tgd_stock_balances.qty_on_hand - coalesce(NEW.quantity, 0),
      updated_at  = now();
  END IF;

  -- Add to target location (inbound)
  IF NEW.to_location_id IS NOT NULL THEN
    INSERT INTO public.tgd_stock_balances (
      customer_id, product_id, lot_id, location_id,
      quantity, qty_on_hand, qty_allocated, updated_at
    ) VALUES (
      NEW.customer_id, NEW.product_id, NEW.lot_id, NEW.to_location_id,
      coalesce(NEW.quantity, 0), coalesce(NEW.quantity, 0), 0, now()
    )
    ON CONFLICT (customer_id, product_id, lot_id, location_id)
    DO UPDATE SET
      quantity    = public.tgd_stock_balances.quantity    + coalesce(NEW.quantity, 0),
      qty_on_hand = public.tgd_stock_balances.qty_on_hand + coalesce(NEW.quantity, 0),
      updated_at  = now();
  END IF;

  RETURN NEW;
END;
$$;


-- ─────────────────────────────────────────────────────────────────────────────
-- Step 2: Create trigger if not exists
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    WHERE c.relname = 'tgd_stock_movements'
      AND t.tgname  = 'tgd_after_insert_stock_movement'
  ) THEN
    CREATE TRIGGER tgd_after_insert_stock_movement
    AFTER INSERT ON public.tgd_stock_movements
    FOR EACH ROW
    EXECUTE FUNCTION public.tgd_trigger_update_stock_balance();
  END IF;
END;
$$;


-- ─────────────────────────────────────────────────────────────────────────────
-- Step 3: Replace tgd_create_stock_movements_from_deposit (final version)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.tgd_create_stock_movements_from_deposit(
  p_deposit_request_id uuid,
  p_actor_user_id       uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_req  record;
  v_line record;
  v_cp   record;
  v_internal_product_id uuid;
  v_lot_id uuid;
  v_occurred_at timestamptz := now();
  v_qty numeric;
  v_wt  numeric;
BEGIN
  SELECT id, customer_id
  INTO v_req
  FROM public.tgd_customer_deposit_requests
  WHERE id = p_deposit_request_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Deposit request % not found', p_deposit_request_id;
  END IF;

  FOR v_line IN
    SELECT l.id,
           l.product_id,
           l.customer_product_code,
           l.lot_no,
           l.actual_boxes,
           l.actual_weight,
           l.location_id
    FROM public.tgd_customer_deposit_request_lines l
    WHERE l.deposit_request_id = p_deposit_request_id
      AND l.actual_boxes IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM public.tgd_stock_movements sm
        WHERE sm.source_line_id = l.id
          AND sm.movement_type  = 'RECEIVE_CONFIRM'
      )
  LOOP
    v_cp := null;
    IF v_line.customer_product_code IS NOT NULL THEN
      SELECT cp.* INTO v_cp
      FROM public.tgd_customer_products cp
      WHERE cp.customer_id           = v_req.customer_id
        AND cp.customer_product_code = v_line.customer_product_code
      LIMIT 1;
    END IF;

    v_internal_product_id := null;

    IF v_cp IS NOT NULL THEN
      v_internal_product_id := v_cp.internal_product_id;

      IF v_internal_product_id IS NULL THEN
        SELECT id INTO v_internal_product_id
        FROM public.tgd_products
        WHERE sku = v_cp.customer_product_code
        LIMIT 1;

        IF NOT FOUND THEN
          INSERT INTO public.tgd_products (sku, name, description, created_at, updated_at)
          VALUES (v_cp.customer_product_code, v_cp.product_name, null, now(), now())
          RETURNING id INTO v_internal_product_id;
        END IF;

        UPDATE public.tgd_customer_products
        SET internal_product_id = v_internal_product_id
        WHERE id = v_cp.id;
      END IF;
    END IF;

    -- Try product_id directly on the line as fallback
    IF v_internal_product_id IS NULL THEN
      v_internal_product_id := v_line.product_id;
    END IF;

    IF v_internal_product_id IS NULL THEN
      CONTINUE;
    END IF;

    v_lot_id := null;
    IF v_line.lot_no IS NOT NULL THEN
      SELECT l2.id INTO v_lot_id
      FROM public.tgd_lots l2
      WHERE l2.customer_id = v_req.customer_id
        AND l2.product_id  = v_internal_product_id
        AND l2.lot_number  = v_line.lot_no
      LIMIT 1;

      IF NOT FOUND THEN
        INSERT INTO public.tgd_lots (customer_id, product_id, lot_number, created_at, updated_at)
        VALUES (v_req.customer_id, v_internal_product_id, v_line.lot_no, now(), now())
        RETURNING id INTO v_lot_id;
      END IF;
    ELSE
      SELECT l2.id INTO v_lot_id
      FROM public.tgd_lots l2
      WHERE l2.customer_id = v_req.customer_id
        AND l2.product_id  = v_internal_product_id
        AND l2.lot_number  = 'AUTO-' || p_deposit_request_id::text
      LIMIT 1;

      IF NOT FOUND THEN
        INSERT INTO public.tgd_lots (customer_id, product_id, lot_number, created_at, updated_at)
        VALUES (v_req.customer_id, v_internal_product_id, 'AUTO-' || p_deposit_request_id::text, now(), now())
        RETURNING id INTO v_lot_id;
      END IF;
    END IF;

    v_qty := coalesce(v_line.actual_boxes,  0);
    v_wt  := coalesce(v_line.actual_weight, 0);

    INSERT INTO public.tgd_stock_movements (
      customer_id, product_id, lot_id,
      from_location_id, to_location_id,
      source_location_id, target_location_id,
      quantity, weight, movement_type, movement_date,
      source_module, source_document_id, source_line_id,
      created_by, occurred_at, source_reference
    ) VALUES (
      v_req.customer_id, v_internal_product_id, v_lot_id,
      null, v_line.location_id,
      null, v_line.location_id,
      v_qty, v_wt, 'RECEIVE_CONFIRM', v_occurred_at::date,
      'CUSTOMER_DEPOSIT_REQUEST', p_deposit_request_id, v_line.id,
      p_actor_user_id, v_occurred_at, 'CDR-CONFIRM'
    );

    IF v_line.location_id IS NOT NULL THEN
      INSERT INTO public.tgd_stock_balances (
        customer_id, product_id, lot_id, location_id,
        quantity, qty_on_hand, qty_allocated,
        weight, uom, updated_at
      ) VALUES (
        v_req.customer_id, v_internal_product_id, v_lot_id, v_line.location_id,
        v_qty, v_qty, 0,
        v_wt, 'กล่อง', now()
      )
      ON CONFLICT (customer_id, product_id, lot_id, location_id)
      DO UPDATE SET
        quantity    = public.tgd_stock_balances.quantity    + excluded.quantity,
        qty_on_hand = public.tgd_stock_balances.qty_on_hand + excluded.qty_on_hand,
        weight      = public.tgd_stock_balances.weight      + excluded.weight,
        updated_at  = now();
    END IF;

  END LOOP;
END;
$func$;

GRANT EXECUTE ON FUNCTION public.tgd_create_stock_movements_from_deposit(uuid, uuid) TO authenticated;


-- ─────────────────────────────────────────────────────────────────────────────
-- Step 4: Patch RECEIVE_CONFIRM movements that are missing to_location_id
-- ─────────────────────────────────────────────────────────────────────────────

UPDATE public.tgd_stock_movements sm
SET
  to_location_id     = l.location_id,
  target_location_id = l.location_id
FROM public.tgd_customer_deposit_request_lines l
WHERE sm.source_line_id = l.id
  AND sm.movement_type  = 'RECEIVE_CONFIRM'
  AND l.location_id IS NOT NULL
  AND sm.to_location_id IS NULL;


-- ─────────────────────────────────────────────────────────────────────────────
-- Step 5: Backfill tgd_stock_balances directly from confirmed deposit lines
-- Authoritative source: tgd_customer_deposit_request_lines.location_id + actual_boxes
-- ─────────────────────────────────────────────────────────────────────────────

DO $backfill$
DECLARE
  v_req  record;
  v_line record;
  v_cp   record;
  v_internal_product_id uuid;
  v_lot_id uuid;
  v_qty  numeric;
  v_wt   numeric;
BEGIN
  FOR v_req IN
    SELECT id, customer_id
    FROM public.tgd_customer_deposit_requests
    WHERE status IN ('RECEIVED_CONFIRMED', 'CUSTOMER_NOTIFIED', 'COMPLETED')
  LOOP
    FOR v_line IN
      SELECT l.id,
             l.customer_product_code,
             l.product_id,
             l.lot_no,
             l.actual_boxes,
             l.actual_weight,
             l.location_id
      FROM public.tgd_customer_deposit_request_lines l
      WHERE l.deposit_request_id = v_req.id
        AND l.actual_boxes IS NOT NULL
        AND l.location_id IS NOT NULL
    LOOP
      -- Resolve internal product id
      v_internal_product_id := null;

      IF v_line.customer_product_code IS NOT NULL THEN
        SELECT cp.internal_product_id INTO v_internal_product_id
        FROM public.tgd_customer_products cp
        WHERE cp.customer_id           = v_req.customer_id
          AND cp.customer_product_code = v_line.customer_product_code
        LIMIT 1;

        IF v_internal_product_id IS NULL THEN
          SELECT id INTO v_internal_product_id
          FROM public.tgd_products
          WHERE sku = v_line.customer_product_code
          LIMIT 1;
        END IF;
      END IF;

      IF v_internal_product_id IS NULL THEN
        v_internal_product_id := v_line.product_id;
      END IF;

      IF v_internal_product_id IS NULL THEN
        CONTINUE;
      END IF;

      -- Resolve lot id
      v_lot_id := null;

      IF v_line.lot_no IS NOT NULL THEN
        SELECT id INTO v_lot_id
        FROM public.tgd_lots
        WHERE customer_id = v_req.customer_id
          AND product_id  = v_internal_product_id
          AND lot_number  = v_line.lot_no
        LIMIT 1;

        IF NOT FOUND THEN
          INSERT INTO public.tgd_lots (customer_id, product_id, lot_number, created_at, updated_at)
          VALUES (v_req.customer_id, v_internal_product_id, v_line.lot_no, now(), now())
          RETURNING id INTO v_lot_id;
        END IF;
      ELSE
        SELECT id INTO v_lot_id
        FROM public.tgd_lots
        WHERE customer_id = v_req.customer_id
          AND product_id  = v_internal_product_id
          AND lot_number  = 'AUTO-' || v_req.id::text
        LIMIT 1;

        IF NOT FOUND THEN
          INSERT INTO public.tgd_lots (customer_id, product_id, lot_number, created_at, updated_at)
          VALUES (v_req.customer_id, v_internal_product_id, 'AUTO-' || v_req.id::text, now(), now())
          RETURNING id INTO v_lot_id;
        END IF;
      END IF;

      v_qty := coalesce(v_line.actual_boxes,  0);
      v_wt  := coalesce(v_line.actual_weight, 0);

      -- Upsert stock balance
      INSERT INTO public.tgd_stock_balances (
        customer_id, product_id, lot_id, location_id,
        quantity, qty_on_hand, qty_allocated,
        weight, uom, updated_at
      ) VALUES (
        v_req.customer_id, v_internal_product_id, v_lot_id, v_line.location_id,
        v_qty, v_qty, 0,
        v_wt, 'กล่อง', now()
      )
      ON CONFLICT (customer_id, product_id, lot_id, location_id)
      DO UPDATE SET
        quantity    = excluded.quantity,
        qty_on_hand = excluded.qty_on_hand,
        weight      = excluded.weight,
        updated_at  = now();

    END LOOP;
  END LOOP;
END;
$backfill$;


-- ─────────────────────────────────────────────────────────────────────────────
-- Step 6: Patch NULL lot_id rows (PostgreSQL NULL != NULL in unique index)
-- ─────────────────────────────────────────────────────────────────────────────

UPDATE public.tgd_stock_balances sb
SET
  qty_on_hand = sq.total_qty,
  quantity    = sq.total_qty,
  weight      = sq.total_weight,
  updated_at  = now()
FROM (
  SELECT
    dr.customer_id,
    cp.internal_product_id AS product_id,
    l.location_id,
    sum(coalesce(l.actual_boxes,  0)) AS total_qty,
    sum(coalesce(l.actual_weight, 0)) AS total_weight
  FROM public.tgd_customer_deposit_request_lines l
  JOIN public.tgd_customer_deposit_requests dr
    ON dr.id = l.deposit_request_id
  JOIN public.tgd_customer_products cp
    ON cp.customer_id           = dr.customer_id
   AND cp.customer_product_code = l.customer_product_code
  WHERE dr.status IN ('RECEIVED_CONFIRMED', 'CUSTOMER_NOTIFIED', 'COMPLETED')
    AND l.actual_boxes IS NOT NULL
    AND l.location_id  IS NOT NULL
    AND cp.internal_product_id IS NOT NULL
  GROUP BY dr.customer_id, cp.internal_product_id, l.location_id
) sq
WHERE sb.customer_id = sq.customer_id
  AND sb.product_id  = sq.product_id
  AND sb.location_id = sq.location_id
  AND sb.lot_id IS NULL;
