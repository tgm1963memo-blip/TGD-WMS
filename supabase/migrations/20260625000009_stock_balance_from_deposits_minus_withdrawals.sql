-- Correct the stock balance logic end-to-end:
-- 1. Restore actual_boxes/weight that were wrongly zeroed by migration 008
-- 2. Remove the bad deduction call from tgd_review_customer_withdrawal_request
-- 3. New tgd_get_customer_stock_balance RPC: balance = deposits − completed withdrawals
-- 4. Lines with balance = 0 are excluded automatically

-- ─── Step 1: Restore deposit lines mutated by tgd_deduct_stock_for_withdrawal ────────────
-- Strategy A: direct link via source_customer_deposit_request_id

UPDATE public.tgd_customer_deposit_request_lines AS dl
SET actual_boxes  = dl.actual_boxes  + COALESCE(wl.picked_boxes,  0),
    actual_weight = dl.actual_weight + COALESCE(wl.picked_weight, 0)
FROM public.tgd_customer_withdrawal_request_lines AS wl
JOIN public.tgd_customer_withdrawal_requests AS wr ON wr.id = wl.withdrawal_request_id
WHERE wr.status = 'COMPLETED'
  AND wl.source_customer_deposit_request_id = dl.deposit_request_id
  AND (
    wl.source_lot_no = dl.lot_no
    OR wl.lot_no     = dl.lot_no
    OR wl.source_lot_no IS NULL
  )
  AND COALESCE(wl.picked_boxes, 0) > 0;

-- Strategy B: fallback FIFO match (no direct link)
UPDATE public.tgd_customer_deposit_request_lines AS dl
SET actual_boxes  = dl.actual_boxes  + COALESCE(wl.picked_boxes,  0),
    actual_weight = dl.actual_weight + COALESCE(wl.picked_weight, 0)
FROM public.tgd_customer_withdrawal_request_lines AS wl
JOIN public.tgd_customer_withdrawal_requests AS wr ON wr.id = wl.withdrawal_request_id
WHERE wr.status = 'COMPLETED'
  AND wl.source_customer_deposit_request_id IS NULL
  AND EXISTS (
    SELECT 1 FROM public.tgd_customer_deposit_requests dr
    WHERE dr.id = dl.deposit_request_id
      AND dr.customer_id = wr.customer_id
  )
  AND wl.lot_no = dl.lot_no
  AND (
    NULLIF(BTRIM(wl.customer_product_code), '') IS NULL
    OR wl.customer_product_code = dl.customer_product_code
  )
  AND COALESCE(wl.picked_boxes, 0) > 0;

-- ─── Step 2: Remove stock-deduction side-effect from review function ──────────────────────

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

-- ─── Step 3: New balance computation RPC ─────────────────────────────────────────────────
-- balance = received (actual_boxes from confirmed deposits)
--         - withdrawn (picked_boxes from COMPLETED withdrawals that reference this lot)
-- Rows with balance = 0 are excluded → disappear from stock view automatically.

CREATE OR REPLACE FUNCTION public.tgd_get_customer_stock_balance(
  p_customer_id uuid
)
RETURNS TABLE (
  deposit_line_id       uuid,
  deposit_request_id    uuid,
  request_no            text,
  lot_no                text,
  customer_product_code text,
  product_name          text,
  mfg_date              date,
  exp_date              date,
  temperature_type      text,
  received_at           timestamptz,
  received_boxes        numeric,
  received_weight       numeric,
  withdrawn_boxes       numeric,
  withdrawn_weight      numeric,
  balance_boxes         numeric,
  balance_weight        numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    dl.id                                                        AS deposit_line_id,
    dl.deposit_request_id,
    dr.request_no,
    dl.lot_no,
    dl.customer_product_code,
    dl.product_name,
    dl.mfg_date,
    dl.exp_date,
    dl.temperature_type,
    COALESCE(dr.last_action_at, dr.expected_arrival_date)        AS received_at,
    COALESCE(dl.actual_boxes,  dl.expected_boxes,  0)            AS received_boxes,
    COALESCE(dl.actual_weight, dl.expected_weight, 0)            AS received_weight,
    COALESCE(w.total_boxes,  0)                                  AS withdrawn_boxes,
    COALESCE(w.total_weight, 0)                                  AS withdrawn_weight,
    GREATEST(0,
      COALESCE(dl.actual_boxes,  dl.expected_boxes,  0)
      - COALESCE(w.total_boxes,  0))                             AS balance_boxes,
    GREATEST(0,
      COALESCE(dl.actual_weight, dl.expected_weight, 0)
      - COALESCE(w.total_weight, 0))                             AS balance_weight
  FROM public.tgd_customer_deposit_request_lines dl
  JOIN public.tgd_customer_deposit_requests dr
    ON dr.id = dl.deposit_request_id
   AND dr.customer_id = p_customer_id
   AND dr.status IN ('RECEIVED_CONFIRMED', 'CUSTOMER_NOTIFIED')
  -- Aggregate all COMPLETED withdrawal lines that belong to this deposit line's lot
  LEFT JOIN LATERAL (
    SELECT
      COALESCE(SUM(wl.picked_boxes),  0) AS total_boxes,
      COALESCE(SUM(wl.picked_weight), 0) AS total_weight
    FROM public.tgd_customer_withdrawal_request_lines wl
    JOIN public.tgd_customer_withdrawal_requests wr
      ON wr.id = wl.withdrawal_request_id
     AND wr.status = 'COMPLETED'
     AND wr.customer_id = p_customer_id
    WHERE
      -- A: direct link → this withdrawal line was created from this specific deposit request + lot
      (
        wl.source_customer_deposit_request_id = dl.deposit_request_id
        AND (
          wl.source_lot_no = dl.lot_no
          OR  wl.lot_no    = dl.lot_no
          OR (wl.source_lot_no IS NULL AND wl.lot_no IS NULL AND dl.lot_no IS NULL)
        )
      )
      OR
      -- B: no direct link → match by product code + lot across customer withdrawals
      (
        wl.source_customer_deposit_request_id IS NULL
        AND COALESCE(wl.customer_product_code, '') = COALESCE(dl.customer_product_code, '')
        AND COALESCE(wl.lot_no, '')                = COALESCE(dl.lot_no, '')
      )
  ) w ON true
  WHERE
    -- Only show lines that still have remaining stock
    GREATEST(0,
      COALESCE(dl.actual_boxes,  dl.expected_boxes,  0)
      - COALESCE(w.total_boxes,  0)
    ) > 0
  ORDER BY dr.last_action_at DESC, dl.line_no;
$$;
