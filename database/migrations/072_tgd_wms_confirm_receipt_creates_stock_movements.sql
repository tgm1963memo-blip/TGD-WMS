-- Migration 072: Create stock movements when deposit is CONFIRM_RECEIPT
-- Root cause fix: CONFIRM_RECEIPT action was not writing to tgd_stock_movements,
-- causing Movement Ledger and Billing Movement Weight reports to show 0 data.
--
-- Also adds UNIQUE constraint on tgd_products.sku so ON CONFLICT can be used safely.

-- ─── Unique constraint on tgd_products.sku ──────────────────────────────────

DO $outer$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.tgd_products'::regclass
      AND contype = 'u'
      AND conname = 'tgd_products_sku_key'
  ) THEN
    ALTER TABLE public.tgd_products ADD CONSTRAINT tgd_products_sku_key UNIQUE (sku);
  END IF;
END;
$outer$;

-- ─── Helper function ────────────────────────────────────────────────────────

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

    -- Resolve internal product id (tgd_products.id)
    v_internal_product_id := null;

    IF v_cp IS NOT NULL THEN
      v_internal_product_id := v_cp.internal_product_id;

      IF v_internal_product_id IS NULL THEN
        -- Check if tgd_products already has an entry for this sku
        SELECT id INTO v_internal_product_id
        FROM public.tgd_products
        WHERE sku = v_cp.customer_product_code
        LIMIT 1;

        IF NOT FOUND THEN
          -- Auto-create tgd_products entry from customer product data
          INSERT INTO public.tgd_products (sku, name, description, created_at, updated_at)
          VALUES (
            v_cp.customer_product_code,
            v_cp.product_name,
            null,
            now(),
            now()
          )
          RETURNING id INTO v_internal_product_id;
        END IF;

        -- Link back to customer product
        UPDATE public.tgd_customer_products
        SET internal_product_id = v_internal_product_id
        WHERE id = v_cp.id;
      END IF;
    END IF;

    -- Skip line if we cannot resolve a product
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
      -- Synthetic lot when no lot_no
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

    INSERT INTO public.tgd_stock_movements (
      customer_id,
      product_id,
      lot_id,
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
    );
  END LOOP;
END;
$func$;

GRANT EXECUTE ON FUNCTION public.tgd_create_stock_movements_from_deposit(uuid, uuid)
  TO authenticated;


-- ─── Update CONFIRM_RECEIPT to also create stock movements ───────────────────

CREATE OR REPLACE FUNCTION public.tgd_review_customer_deposit_request(
  p_request_id uuid,
  p_decision text,
  p_comment text default null
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_auth_user_id uuid := auth.uid();
  v_profile record;
  v_document record;
  v_decision text := upper(nullif(btrim(p_decision), ''));
  v_to_status text;
  v_receiving_id uuid;
BEGIN
  IF v_auth_user_id IS NULL OR NOT public.tgd_current_user_is_active() THEN
    RAISE EXCEPTION 'Active authenticated user required';
  END IF;

  SELECT p.id, p.email, p.role, p.customer_id
  INTO v_profile
  FROM public.tgd_user_profiles p
  WHERE p.auth_user_id = v_auth_user_id
    AND p.is_active = true
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User profile not found';
  END IF;

  IF v_decision NOT IN ('ACCEPT', 'REJECT', 'REVIEWING', 'CONFIRM_RECEIPT') THEN
    RAISE EXCEPTION 'Decision must be ACCEPT, REJECT, REVIEWING, or CONFIRM_RECEIPT';
  END IF;

  -- CONFIRM_RECEIPT allows warehouse roles
  IF v_decision = 'CONFIRM_RECEIPT' THEN
    IF v_profile.role NOT IN ('admin', 'accounting', 'warehouse_manager', 'warehouse_admin') THEN
      RAISE EXCEPTION 'Admin, accounting, or warehouse role required to confirm deposit receiving';
    END IF;
  ELSE
    IF v_profile.role NOT IN ('admin', 'accounting') THEN
      RAISE EXCEPTION 'Admin or accounting role required to review a deposit request';
    END IF;
  END IF;

  SELECT d.id, d.customer_id, d.status
  INTO v_document
  FROM public.tgd_customer_deposit_requests d
  WHERE d.id = p_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Customer deposit request not found';
  END IF;

  IF v_decision = 'REVIEWING' AND v_document.status = 'SUBMITTED_BY_CUSTOMER' THEN
    v_to_status := 'ADMIN_REVIEWING';
  ELSIF v_decision = 'ACCEPT' AND v_document.status = 'ADMIN_REVIEWING' THEN
    v_to_status := 'ADMIN_ACCEPTED';
  ELSIF v_decision = 'REJECT' AND v_document.status = 'ADMIN_REVIEWING' THEN
    v_to_status := 'ADMIN_REJECTED';
  ELSIF v_decision = 'CONFIRM_RECEIPT' AND v_document.status IN ('WAREHOUSE_RECEIVING', 'PALLETIZING', 'COUNT_VARIANCE_REVIEW', 'ADMIN_RECOUNT_REQUESTED') THEN
    v_to_status := 'RECEIVED_CONFIRMED';
  ELSE
    RAISE EXCEPTION 'Invalid deposit review transition from % using %',
      v_document.status, v_decision;
  END IF;

  UPDATE public.tgd_customer_deposit_requests
  SET status = v_to_status,
      reviewed_by_user_id = CASE WHEN v_decision IN ('ACCEPT', 'REJECT') THEN v_profile.id ELSE reviewed_by_user_id END,
      reviewed_by_email = CASE WHEN v_decision IN ('ACCEPT', 'REJECT') THEN v_profile.email ELSE reviewed_by_email END,
      reviewed_at = CASE WHEN v_decision IN ('ACCEPT', 'REJECT') THEN now() ELSE reviewed_at END,
      review_comment = nullif(btrim(p_comment), ''),
      last_action_by_user_id = v_profile.id,
      last_action_by_email = v_profile.email,
      last_action_at = now()
  WHERE id = v_document.id;

  IF v_decision = 'ACCEPT' THEN
    v_receiving_id := public.tgd_bridge_customer_deposit_to_receiving(v_document.id, v_profile.id);
  END IF;

  -- Create stock movements on receipt confirmation
  IF v_decision = 'CONFIRM_RECEIPT' THEN
    PERFORM public.tgd_create_stock_movements_from_deposit(v_document.id, v_profile.id);
  END IF;

  INSERT INTO public.tgd_customer_document_timeline_events (
    document_type, document_id, customer_id, action, from_status, to_status,
    actor_user_id, actor_email, actor_role, actor_customer_id, comment
  ) VALUES (
    'CUSTOMER_DEPOSIT_REQUEST', v_document.id, v_document.customer_id,
    'REVIEW_' || v_decision, v_document.status,
    CASE WHEN v_decision = 'ACCEPT' THEN 'WAREHOUSE_RECEIVING' ELSE v_to_status END,
    v_profile.id, v_profile.email, v_profile.role, v_profile.customer_id,
    nullif(btrim(p_comment), '')
  );

  RETURN jsonb_build_object(
    'id', v_document.id,
    'customer_id', v_document.customer_id,
    'status', CASE WHEN v_decision = 'ACCEPT' THEN 'WAREHOUSE_RECEIVING' ELSE v_to_status END,
    'action', 'REVIEW_' || v_decision,
    'receiving_document_id', v_receiving_id
  );
END;
$$;


-- ─── Backfill existing RECEIVED_CONFIRMED deposits ───────────────────────────
-- Uses direct INSERT to bypass any function-context RLS issues.
-- Idempotent: skips lines already in tgd_stock_movements (via NOT EXISTS check).

DO $backfill$
DECLARE
  v_req record;
  v_line record;
  v_cp record;
  v_actor_id uuid;
  v_internal_product_id uuid;
  v_lot_id uuid;
  v_occurred_at timestamptz := now();
BEGIN
  SELECT up.id INTO v_actor_id
  FROM public.tgd_user_profiles up
  WHERE up.role = 'admin' AND up.is_active = true
  ORDER BY up.created_at
  LIMIT 1;

  FOR v_req IN
    SELECT id, customer_id FROM public.tgd_customer_deposit_requests
    WHERE status = 'RECEIVED_CONFIRMED'
  LOOP
    FOR v_line IN
      SELECT l.id, l.customer_product_code, l.lot_no, l.actual_boxes, l.actual_weight, l.location_id
      FROM public.tgd_customer_deposit_request_lines l
      WHERE l.deposit_request_id = v_req.id
        AND l.actual_boxes IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM public.tgd_stock_movements sm
          WHERE sm.source_line_id = l.id AND sm.movement_type = 'RECEIVE_CONFIRM'
        )
    LOOP
      v_internal_product_id := null;

      IF v_line.customer_product_code IS NOT NULL THEN
        SELECT cp.internal_product_id INTO v_internal_product_id
        FROM public.tgd_customer_products cp
        WHERE cp.customer_id = v_req.customer_id
          AND cp.customer_product_code = v_line.customer_product_code
        LIMIT 1;

        IF v_internal_product_id IS NULL THEN
          SELECT id INTO v_internal_product_id FROM public.tgd_products WHERE sku = v_line.customer_product_code LIMIT 1;
          IF NOT FOUND THEN
            INSERT INTO public.tgd_products (sku, name, created_at, updated_at)
            SELECT cp.customer_product_code, cp.product_name, now(), now()
            FROM public.tgd_customer_products cp
            WHERE cp.customer_id = v_req.customer_id
              AND cp.customer_product_code = v_line.customer_product_code
            LIMIT 1
            RETURNING id INTO v_internal_product_id;
          END IF;
          UPDATE public.tgd_customer_products
          SET internal_product_id = v_internal_product_id
          WHERE customer_id = v_req.customer_id AND customer_product_code = v_line.customer_product_code;
        END IF;
      END IF;

      IF v_internal_product_id IS NULL THEN CONTINUE; END IF;

      v_lot_id := null;
      IF v_line.lot_no IS NOT NULL THEN
        SELECT id INTO v_lot_id FROM public.tgd_lots
        WHERE customer_id = v_req.customer_id AND product_id = v_internal_product_id AND lot_number = v_line.lot_no LIMIT 1;
        IF NOT FOUND THEN
          INSERT INTO public.tgd_lots (customer_id, product_id, lot_number, created_at, updated_at)
          VALUES (v_req.customer_id, v_internal_product_id, v_line.lot_no, now(), now())
          RETURNING id INTO v_lot_id;
        END IF;
      ELSE
        SELECT id INTO v_lot_id FROM public.tgd_lots
        WHERE customer_id = v_req.customer_id AND product_id = v_internal_product_id AND lot_number = 'AUTO-' || v_req.id::text LIMIT 1;
        IF NOT FOUND THEN
          INSERT INTO public.tgd_lots (customer_id, product_id, lot_number, created_at, updated_at)
          VALUES (v_req.customer_id, v_internal_product_id, 'AUTO-' || v_req.id::text, now(), now())
          RETURNING id INTO v_lot_id;
        END IF;
      END IF;

      INSERT INTO public.tgd_stock_movements (
        customer_id, product_id, lot_id, quantity, weight, movement_type, movement_date,
        source_module, source_document_id, source_line_id, created_by, occurred_at, source_reference
      ) VALUES (
        v_req.customer_id, v_internal_product_id, v_lot_id,
        coalesce(v_line.actual_boxes, 0), coalesce(v_line.actual_weight, 0),
        'RECEIVE_CONFIRM', v_occurred_at::date,
        'CUSTOMER_DEPOSIT_REQUEST', v_req.id, v_line.id,
        v_actor_id, v_occurred_at, 'CDR-CONFIRM'
      );
    END LOOP;
  END LOOP;
END;
$backfill$;
