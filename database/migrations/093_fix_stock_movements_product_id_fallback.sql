-- Migration 093: Fix tgd_create_stock_movements_from_deposit to use product_id fallback
--
-- Root cause: The function resolves internal_product_id only via customer_product_code lookup.
-- If a deposit line has product_id set directly but no customer_product_code (or the code
-- doesn't exist in tgd_customer_products), the line is silently skipped (CONTINUE).
-- This caused migration 092's backfill to insert zero rows → warehouse map stays 0%.
--
-- Fix: After the customer_product_code lookup, fall back to l.product_id directly if
-- v_internal_product_id is still null.  Also re-run the backfill for any deposits that
-- were skipped.

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

    -- Fallback: use product_id directly from the deposit line (avoids silent skip
    -- when customer_product_code is missing or not in tgd_customer_products)
    IF v_internal_product_id IS NULL AND v_line.product_id IS NOT NULL THEN
      v_internal_product_id := v_line.product_id;
    END IF;

    IF v_internal_product_id IS NULL THEN
      RAISE NOTICE 'Skipping line % — no product resolved (no customer_product_code and no product_id)', v_line.id;
      CONTINUE;
    END IF;

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

    v_qty := coalesce(v_line.actual_boxes,  0);
    v_wt  := coalesce(v_line.actual_weight, 0);

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
      v_qty,
      v_wt,
      'RECEIVE_CONFIRM',
      v_occurred_at::date,
      'CUSTOMER_DEPOSIT_REQUEST',
      p_deposit_request_id,
      v_line.id,
      p_actor_user_id,
      v_occurred_at,
      'CDR-CONFIRM'
    );

    IF v_line.location_id IS NOT NULL THEN
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
        v_qty,
        v_qty,
        0,
        v_wt,
        'กล่อง',
        now()
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

-- Re-run backfill for any deposits where lines were silently skipped (no stock movements).
-- The NOT EXISTS guard in the function prevents duplicates.
do $backfill$
declare
  v_req       record;
  v_actor_id  uuid;
begin
  select id into v_actor_id
  from public.tgd_user_profiles
  where role in ('admin', 'accounting', 'warehouse_manager', 'warehouse_admin')
    and is_active = true
  order by created_at
  limit 1;

  if v_actor_id is null then
    raise exception 'No active admin user found for backfill actor';
  end if;

  for v_req in
    select distinct dr.id
    from public.tgd_customer_deposit_requests dr
    join public.tgd_customer_deposit_request_lines l
      on l.deposit_request_id = dr.id
     and l.actual_boxes is not null
     and l.actual_boxes > 0
     and l.location_id is not null
    where dr.status in ('RECEIVED_CONFIRMED', 'CUSTOMER_NOTIFIED', 'COMPLETED')
      and exists (
        select 1
        from public.tgd_customer_deposit_request_lines l2
        where l2.deposit_request_id = dr.id
          and l2.actual_boxes is not null
          and not exists (
            select 1 from public.tgd_stock_movements sm
            where sm.source_line_id = l2.id
              and sm.movement_type  = 'RECEIVE_CONFIRM'
          )
      )
  loop
    raise notice 'Backfilling stock movements for deposit %', v_req.id;
    perform public.tgd_create_stock_movements_from_deposit(v_req.id, v_actor_id);
  end loop;

  raise notice 'Backfill complete.';
end;
$backfill$;
