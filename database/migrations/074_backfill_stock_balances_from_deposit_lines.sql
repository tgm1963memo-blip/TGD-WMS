-- Migration 074: Backfill tgd_stock_balances directly from deposit request lines
--
-- Why this is needed after 073:
-- Migration 072's backfill section created tgd_stock_movements rows WITHOUT
-- location_id (source_location_id/target_location_id/from_location_id/to_location_id
-- were all omitted). Migration 073's backfill queried tgd_stock_movements and found
-- coalesce(to_location_id, target_location_id) = NULL → no stock balances were created.
--
-- The authoritative location data is on tgd_customer_deposit_request_lines.location_id.
-- This migration reads directly from deposit lines to build correct stock balances.
--
-- Also: update existing RECEIVE_CONFIRM movements to carry the correct to_location_id
-- so the trigger works correctly going forward.

-- ─── Step 1: Patch existing RECEIVE_CONFIRM movements with correct location ──

UPDATE public.tgd_stock_movements sm
SET
  to_location_id     = l.location_id,
  target_location_id = l.location_id
FROM public.tgd_customer_deposit_request_lines l
WHERE sm.source_line_id = l.id
  AND sm.movement_type  = 'RECEIVE_CONFIRM'
  AND l.location_id IS NOT NULL
  AND sm.to_location_id IS NULL;


-- ─── Step 2: Directly backfill tgd_stock_balances from deposit lines ─────────

DO $backfill$
DECLARE
  v_req  record;
  v_line record;
  v_cp   record;
  v_internal_product_id uuid;
  v_lot_id uuid;
BEGIN
  FOR v_req IN
    SELECT id, customer_id
    FROM public.tgd_customer_deposit_requests
    WHERE status IN ('RECEIVED_CONFIRMED', 'CUSTOMER_NOTIFIED', 'COMPLETED')
  LOOP
    FOR v_line IN
      SELECT
        l.id,
        l.customer_product_code,
        l.lot_no,
        l.actual_boxes,
        l.actual_weight,
        l.location_id
      FROM public.tgd_customer_deposit_request_lines l
      WHERE l.deposit_request_id = v_req.id
        AND l.actual_boxes IS NOT NULL
        AND l.location_id IS NOT NULL
    LOOP

      -- ── Resolve internal product id ──────────────────────────────────────
      v_internal_product_id := null;

      IF v_line.customer_product_code IS NOT NULL THEN
        SELECT cp.internal_product_id
        INTO v_internal_product_id
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

      -- Fall back: use product_id column directly if available on line
      IF v_internal_product_id IS NULL THEN
        SELECT l2.product_id INTO v_internal_product_id
        FROM public.tgd_customer_deposit_request_lines l2
        WHERE l2.id = v_line.id
          AND l2.product_id IS NOT NULL;
      END IF;

      IF v_internal_product_id IS NULL THEN
        CONTINUE;
      END IF;

      -- ── Resolve lot id ───────────────────────────────────────────────────
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

      -- ── Upsert stock balance ─────────────────────────────────────────────
      INSERT INTO public.tgd_stock_balances (
        customer_id,
        product_id,
        lot_id,
        location_id,
        quantity,
        qty_on_hand,
        qty_allocated,
        weight,
        uom,
        updated_at
      ) VALUES (
        v_req.customer_id,
        v_internal_product_id,
        v_lot_id,
        v_line.location_id,
        coalesce(v_line.actual_boxes,  0),
        coalesce(v_line.actual_boxes,  0),
        0,
        coalesce(v_line.actual_weight, 0),
        'กล่อง',
        now()
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


-- ─── Step 3: Also cover lines where lot_id is NULL in unique index ────────────
-- PostgreSQL treats NULLs as distinct in unique indexes, so ON CONFLICT won't
-- match a row with NULL lot_id.  Patch those rows explicitly.

UPDATE public.tgd_stock_balances sb
SET
  qty_on_hand = sq.total_qty,
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
