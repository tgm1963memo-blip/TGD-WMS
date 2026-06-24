-- Migration 073: Fix stock balances not updating after deposit CONFIRM_RECEIPT
--
-- Root causes:
-- 1. tgd_create_stock_movements_from_deposit used source_location_id/target_location_id
--    but the balance trigger reads from_location_id/to_location_id → trigger fired but did nothing.
-- 2. The trigger function wrote to `quantity`, not `qty_on_hand`. getSectionsWithOccupancy
--    and getStockAtLocation both filter on qty_on_hand > 0 → map always showed empty.
-- 3. CREATE TRIGGER may not exist in production (was only in design files).
--
-- Fix:
-- a) Update tgd_create_stock_movements_from_deposit to use from_location_id/to_location_id
--    AND directly upsert tgd_stock_balances.qty_on_hand (no trigger dependency).
-- b) Replace trigger function to update qty_on_hand correctly.
-- c) CREATE TRIGGER if not exists.
-- d) Backfill tgd_stock_balances from existing RECEIVE_CONFIRM movements.

-- ─── a) Fix tgd_create_stock_movements_from_deposit ─────────────────────────

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
  v_req record;
  v_line record;
  v_cp record;
  v_internal_product_id uuid;
  v_lot_id uuid;
  v_occurred_at timestamptz := now();
  v_movement_id uuid;
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
    -- Resolve customer product record
    v_cp := null;
    IF v_line.customer_product_code IS NOT NULL THEN
      SELECT cp.* INTO v_cp
      FROM public.tgd_customer_products cp
      WHERE cp.customer_id           = v_req.customer_id
        AND cp.customer_product_code = v_line.customer_product_code
      LIMIT 1;
    END IF;

    -- Resolve internal product id
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

    IF v_internal_product_id IS NULL THEN
      CONTINUE;
    END IF;

    -- Resolve or create lot
    v_lot_id := null;
    IF v_line.lot_no IS NOT NULL THEN
      SELECT l2.id INTO v_lot_id
      FROM public.tgd_lots l2
      WHERE l2.customer_id  = v_req.customer_id
        AND l2.product_id   = v_internal_product_id
        AND l2.lot_number   = v_line.lot_no
      LIMIT 1;

      IF NOT FOUND THEN
        INSERT INTO public.tgd_lots (customer_id, product_id, lot_number, created_at, updated_at)
        VALUES (v_req.customer_id, v_internal_product_id, v_line.lot_no, now(), now())
        RETURNING id INTO v_lot_id;
      END IF;
    ELSE
      SELECT l2.id INTO v_lot_id
      FROM public.tgd_lots l2
      WHERE l2.customer_id  = v_req.customer_id
        AND l2.product_id   = v_internal_product_id
        AND l2.lot_number   = 'AUTO-' || p_deposit_request_id::text
      LIMIT 1;

      IF NOT FOUND THEN
        INSERT INTO public.tgd_lots (customer_id, product_id, lot_number, created_at, updated_at)
        VALUES (v_req.customer_id, v_internal_product_id, 'AUTO-' || p_deposit_request_id::text, now(), now())
        RETURNING id INTO v_lot_id;
      END IF;
    END IF;

    -- Insert movement using from_location_id/to_location_id (aligned with trigger)
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
      source_document_id,
      source_line_id,
      created_by,
      occurred_at,
      source_reference
    ) VALUES (
      v_req.customer_id,
      v_internal_product_id,
      v_lot_id,
      null,
      v_line.location_id,
      null,
      v_line.location_id,
      coalesce(v_line.actual_boxes, 0),
      coalesce(v_line.actual_weight, 0),
      'RECEIVE_CONFIRM',
      v_occurred_at::date,
      'CUSTOMER_DEPOSIT_REQUEST',
      p_deposit_request_id,
      v_line.id,
      p_actor_user_id,
      v_occurred_at,
      'CDR-CONFIRM'
    )
    RETURNING id INTO v_movement_id;

    -- Directly upsert stock balance (do not rely solely on trigger)
    IF v_line.location_id IS NOT NULL THEN
      INSERT INTO public.tgd_stock_balances (
        customer_id,
        product_id,
        lot_id,
        location_id,
        qty_on_hand,
        qty_allocated,
        uom,
        weight,
        updated_at
      ) VALUES (
        v_req.customer_id,
        v_internal_product_id,
        v_lot_id,
        v_line.location_id,
        coalesce(v_line.actual_boxes, 0),
        0,
        'กล่อง',
        coalesce(v_line.actual_weight, 0),
        now()
      )
      ON CONFLICT (customer_id, product_id, lot_id, location_id)
      DO UPDATE SET
        qty_on_hand = public.tgd_stock_balances.qty_on_hand + excluded.qty_on_hand,
        weight      = public.tgd_stock_balances.weight + excluded.weight,
        updated_at  = now();
    END IF;

  END LOOP;
END;
$func$;

GRANT EXECUTE ON FUNCTION public.tgd_create_stock_movements_from_deposit(uuid, uuid) TO authenticated;


-- ─── b) Replace trigger function to update qty_on_hand ───────────────────────

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
      customer_id, product_id, lot_id, location_id, qty_on_hand, qty_allocated, updated_at
    ) VALUES (
      NEW.customer_id, NEW.product_id, NEW.lot_id, NEW.from_location_id,
      -coalesce(NEW.quantity, 0), 0, now()
    )
    ON CONFLICT (customer_id, product_id, lot_id, location_id)
    DO UPDATE SET
      qty_on_hand = public.tgd_stock_balances.qty_on_hand - coalesce(NEW.quantity, 0),
      updated_at  = now();
  END IF;

  -- Add to target location (inbound)
  IF NEW.to_location_id IS NOT NULL THEN
    INSERT INTO public.tgd_stock_balances (
      customer_id, product_id, lot_id, location_id, qty_on_hand, qty_allocated, updated_at
    ) VALUES (
      NEW.customer_id, NEW.product_id, NEW.lot_id, NEW.to_location_id,
      coalesce(NEW.quantity, 0), 0, now()
    )
    ON CONFLICT (customer_id, product_id, lot_id, location_id)
    DO UPDATE SET
      qty_on_hand = public.tgd_stock_balances.qty_on_hand + coalesce(NEW.quantity, 0),
      updated_at  = now();
  END IF;

  RETURN NEW;
END;
$$;


-- ─── c) Create trigger if not exists ─────────────────────────────────────────

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


-- ─── d) Backfill tgd_stock_balances from existing RECEIVE_CONFIRM movements ──
-- Idempotent: uses ON CONFLICT. Safe to run multiple times.

DO $backfill$
DECLARE
  v_row record;
BEGIN
  -- Fix existing movements that have target_location_id but NULL to_location_id
  UPDATE public.tgd_stock_movements
  SET to_location_id = target_location_id
  WHERE movement_type = 'RECEIVE_CONFIRM'
    AND target_location_id IS NOT NULL
    AND to_location_id IS NULL;

  -- Upsert stock balances from all RECEIVE_CONFIRM movements
  FOR v_row IN
    SELECT
      sm.customer_id,
      sm.product_id,
      sm.lot_id,
      coalesce(sm.to_location_id, sm.target_location_id) AS location_id,
      sum(coalesce(sm.quantity, 0)) AS total_qty,
      sum(coalesce(sm.weight,   0)) AS total_weight
    FROM public.tgd_stock_movements sm
    WHERE sm.movement_type = 'RECEIVE_CONFIRM'
      AND coalesce(sm.to_location_id, sm.target_location_id) IS NOT NULL
    GROUP BY sm.customer_id, sm.product_id, sm.lot_id,
             coalesce(sm.to_location_id, sm.target_location_id)
  LOOP
    INSERT INTO public.tgd_stock_balances (
      customer_id, product_id, lot_id, location_id,
      qty_on_hand, qty_allocated, weight, uom, updated_at
    ) VALUES (
      v_row.customer_id, v_row.product_id, v_row.lot_id, v_row.location_id,
      v_row.total_qty, 0, v_row.total_weight, 'กล่อง', now()
    )
    ON CONFLICT (customer_id, product_id, lot_id, location_id)
    DO UPDATE SET
      qty_on_hand = excluded.qty_on_hand,
      weight      = excluded.weight,
      updated_at  = now()
    WHERE public.tgd_stock_balances.qty_on_hand = 0
       OR public.tgd_stock_balances.qty_on_hand IS NULL;
  END LOOP;
END;
$backfill$;
