-- Migration 081: Sync tgd_stock_balances when customer withdrawal is confirmed
--
-- Root cause: CONFIRM_DISPATCH transitions the customer withdrawal to COMPLETED
-- but never reduces qty_on_hand in tgd_stock_balances.  This causes the warehouse
-- layout map to still show those locations as occupied (orange) even after goods
-- have physically left.
--
-- Fix:
--   1. Create tgd_sync_stock_balances_for_withdrawal() — deducts picked_boxes from
--      the matching tgd_stock_balances records; falls back to FIFO if the source
--      deposit location is not directly linked.
--   2. Wire it into tgd_review_customer_withdrawal_request on CONFIRM_DISPATCH.
--   3. Backfill all existing COMPLETED withdrawals.


-- ─── Step 1: Sync function ────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.tgd_sync_stock_balances_for_withdrawal(
  p_withdrawal_request_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_customer_id     uuid;
  v_line            record;
  v_lot_id          uuid;
  v_dep_location_id uuid;
  v_deduct_qty      numeric;
  v_remaining       numeric;
  v_take            numeric;
  v_bal             record;
BEGIN
  SELECT customer_id INTO v_customer_id
  FROM public.tgd_customer_withdrawal_requests
  WHERE id = p_withdrawal_request_id;

  IF v_customer_id IS NULL THEN RETURN; END IF;

  FOR v_line IN
    SELECT
      wl.id,
      COALESCE(NULLIF(BTRIM(wl.source_lot_no), ''), NULLIF(BTRIM(wl.lot_no), '')) AS effective_lot_no,
      wl.source_customer_deposit_request_id,
      COALESCE(wl.picked_boxes, 0) AS picked_boxes
    FROM public.tgd_customer_withdrawal_request_lines wl
    WHERE wl.withdrawal_request_id = p_withdrawal_request_id
      AND COALESCE(wl.picked_boxes, 0) > 0
  LOOP
    IF v_line.effective_lot_no IS NULL THEN CONTINUE; END IF;

    -- Resolve lot ID in WMS lot master
    SELECT lt.id INTO v_lot_id
    FROM public.tgd_lots lt
    WHERE lt.lot_number = v_line.effective_lot_no
      AND lt.customer_id = v_customer_id
    LIMIT 1;

    IF v_lot_id IS NULL THEN CONTINUE; END IF;

    -- Try to get the specific storage location from the source deposit request line
    v_dep_location_id := NULL;
    IF v_line.source_customer_deposit_request_id IS NOT NULL THEN
      SELECT dl.location_id INTO v_dep_location_id
      FROM public.tgd_customer_deposit_request_lines dl
      WHERE dl.deposit_request_id = v_line.source_customer_deposit_request_id
        AND dl.lot_no = v_line.effective_lot_no
        AND dl.location_id IS NOT NULL
      ORDER BY dl.line_no
      LIMIT 1;
    END IF;

    v_deduct_qty := v_line.picked_boxes;

    IF v_dep_location_id IS NOT NULL THEN
      -- Exact location known: deduct from that location only
      UPDATE public.tgd_stock_balances
      SET qty_on_hand = GREATEST(0, qty_on_hand - v_deduct_qty),
          quantity    = GREATEST(0, quantity    - v_deduct_qty),
          updated_at  = now()
      WHERE lot_id      = v_lot_id
        AND customer_id = v_customer_id
        AND location_id = v_dep_location_id;
    ELSE
      -- Location not known: FIFO deduction from locations with most stock first
      v_remaining := v_deduct_qty;
      FOR v_bal IN
        SELECT id, qty_on_hand
        FROM public.tgd_stock_balances
        WHERE lot_id      = v_lot_id
          AND customer_id = v_customer_id
          AND qty_on_hand > 0
        ORDER BY qty_on_hand DESC
        FOR UPDATE
      LOOP
        EXIT WHEN v_remaining <= 0;
        v_take := LEAST(v_remaining, v_bal.qty_on_hand);
        UPDATE public.tgd_stock_balances
        SET qty_on_hand = GREATEST(0, qty_on_hand - v_take),
            quantity    = GREATEST(0, quantity    - v_take),
            updated_at  = now()
        WHERE id = v_bal.id;
        v_remaining := v_remaining - v_take;
      END LOOP;
    END IF;

  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.tgd_sync_stock_balances_for_withdrawal(uuid) TO authenticated;


-- ─── Step 2: Wire into review function ───────────────────────────────────────
-- Full replace based on the version from supabase/migrations/20260625000009
-- with one addition: call tgd_sync_stock_balances_for_withdrawal on CONFIRM_DISPATCH

CREATE OR REPLACE FUNCTION public.tgd_review_customer_withdrawal_request(
  p_request_id uuid,
  p_decision   text,
  p_comment    text DEFAULT NULL::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
declare
  v_auth_user_id uuid := auth.uid();
  v_profile      record;
  v_document     record;
  v_decision     text := upper(nullif(btrim(p_decision), ''));
  v_to_status    text;
  v_internal_id  uuid;
begin
  if v_auth_user_id is null or not public.tgd_current_user_is_active() then
    raise exception 'Active authenticated user required';
  end if;

  select p.id, p.email, p.role, p.customer_id
  into v_profile
  from public.tgd_user_profiles p
  where p.auth_user_id = v_auth_user_id
    and p.is_active = true
  limit 1;

  if not found then
    raise exception 'User profile not found';
  end if;

  if v_decision not in ('ACCEPT', 'REJECT', 'REVIEWING', 'SEND_TO_PICKING', 'CONFIRM_DISPATCH') then
    raise exception 'Decision must be ACCEPT, REJECT, REVIEWING, SEND_TO_PICKING, or CONFIRM_DISPATCH';
  end if;

  if v_decision in ('ACCEPT', 'REJECT', 'REVIEWING') and
     v_profile.role not in ('admin', 'accounting') then
    raise exception 'Admin or accounting role required to review a withdrawal request';
  end if;

  if v_decision in ('SEND_TO_PICKING', 'CONFIRM_DISPATCH') and
     v_profile.role not in ('admin', 'accounting', 'warehouse_admin', 'warehouse_manager', 'warehouse_staff') then
    raise exception 'Warehouse or admin role required for picking operations';
  end if;

  select w.id, w.customer_id, w.status, w.withdrawal_no
  into v_document
  from public.tgd_customer_withdrawal_requests w
  where w.id = p_request_id
  for update;

  if not found then
    raise exception 'Customer withdrawal request not found';
  end if;

  if v_decision = 'REVIEWING' and v_document.status = 'SUBMITTED_BY_CUSTOMER' then
    v_to_status := 'ADMIN_REVIEWING';
  elsif v_decision = 'ACCEPT' and v_document.status = 'ADMIN_REVIEWING' then
    v_to_status := 'ADMIN_ACCEPTED';
  elsif v_decision = 'REJECT' and v_document.status in ('ADMIN_REVIEWING', 'SUBMITTED_BY_CUSTOMER') then
    v_to_status := 'ADMIN_REJECTED';
  elsif v_decision = 'SEND_TO_PICKING' and v_document.status = 'ADMIN_ACCEPTED' then
    v_to_status := 'WAREHOUSE_PICKING';
  elsif v_decision = 'CONFIRM_DISPATCH' and v_document.status in ('WAREHOUSE_PICKING', 'ADMIN_ACCEPTED') then
    v_to_status := 'COMPLETED';
  else
    raise exception 'Invalid withdrawal review transition from % using %',
      v_document.status, v_decision;
  end if;

  update public.tgd_customer_withdrawal_requests
  set status                   = v_to_status,
      reviewed_by_user_id      = case when v_decision in ('ACCEPT', 'REJECT') then v_profile.id else reviewed_by_user_id end,
      reviewed_by_email        = case when v_decision in ('ACCEPT', 'REJECT') then v_profile.email else reviewed_by_email end,
      reviewed_at              = case when v_decision in ('ACCEPT', 'REJECT') then now() else reviewed_at end,
      review_comment           = nullif(btrim(p_comment), ''),
      last_action_by_user_id   = v_profile.id,
      last_action_by_email     = v_profile.email,
      last_action_at           = now()
  where id = v_document.id;

  if v_decision = 'ACCEPT' then
    v_internal_id := public.tgd_bridge_customer_withdrawal_to_internal(v_document.id, v_profile.id);
  end if;

  -- Reduce tgd_stock_balances when dispatch is confirmed so warehouse map
  -- immediately reflects the correct (empty) occupancy for vacated locations.
  if v_decision = 'CONFIRM_DISPATCH' then
    perform public.tgd_sync_stock_balances_for_withdrawal(v_document.id);
  end if;

  insert into public.tgd_customer_document_timeline_events (
    document_type, document_id, customer_id, action, from_status, to_status,
    actor_user_id, actor_email, actor_role, actor_customer_id, comment
  ) values (
    'CUSTOMER_WITHDRAWAL_REQUEST', v_document.id, v_document.customer_id,
    'REVIEW_' || v_decision, v_document.status, v_to_status,
    v_profile.id, v_profile.email, v_profile.role, v_profile.customer_id,
    nullif(btrim(p_comment), '')
  );

  if v_decision = 'ACCEPT' then
    perform public.tgd_enqueue_customer_request_notifications(
      'CUSTOMER_WITHDRAWAL_REQUEST', v_document.id, v_document.customer_id,
      v_document.withdrawal_no, null, 'WITHDRAWAL_ACCEPTED'
    );
  end if;

  return jsonb_build_object(
    'id',                              v_document.id,
    'customer_id',                     v_document.customer_id,
    'status',                          v_to_status,
    'action',                          'REVIEW_' || v_decision,
    'internal_withdrawal_request_id',  v_internal_id
  );
end;
$$;


-- ─── Step 3: Backfill all existing COMPLETED withdrawals ─────────────────────

DO $$
DECLARE
  v_id uuid;
BEGIN
  FOR v_id IN
    SELECT id
    FROM public.tgd_customer_withdrawal_requests
    WHERE status = 'COMPLETED'
    ORDER BY last_action_at
  LOOP
    PERFORM public.tgd_sync_stock_balances_for_withdrawal(v_id);
  END LOOP;
END;
$$;
