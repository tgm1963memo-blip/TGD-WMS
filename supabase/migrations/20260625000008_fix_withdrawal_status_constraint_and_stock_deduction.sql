-- Fix 1: The status check constraint on tgd_customer_withdrawal_requests does not include
-- 'COMPLETED', causing CONFIRM_DISPATCH to fail.  Drop and recreate.
-- NOT VALID skips validating existing rows so any legacy status values don't block the migration.

ALTER TABLE public.tgd_customer_withdrawal_requests
  DROP CONSTRAINT IF EXISTS tgd_customer_withdrawal_requests_status_check;

ALTER TABLE public.tgd_customer_withdrawal_requests
  ADD CONSTRAINT tgd_customer_withdrawal_requests_status_check
  CHECK (status IN (
    'DRAFT',
    'SUBMITTED_BY_CUSTOMER',
    'ADMIN_REVIEWING',
    'ADMIN_ACCEPTED',
    'ADMIN_REJECTED',
    'REJECTED',
    'WAREHOUSE_PICKING',
    'COMPLETED',
    'DISPATCHED',
    'CANCELLED'
  )) NOT VALID;

-- Fix 2: Stock deduction function.
-- Called after a customer withdrawal is confirmed (CONFIRM_DISPATCH → COMPLETED).
-- For each picked line in the withdrawal request, reduce actual_boxes / actual_weight
-- on the matching customer deposit request line so the ยอดคงเหลือลูกค้า page reflects
-- the deduction automatically.
--
-- Matching strategy (in priority order):
--   A) Direct link via source_customer_deposit_request_id + lot_no → exact row
--   B) Same customer + customer_product_code + lot_no ordered by oldest deposit first (FIFO)
-- Deduction is capped at zero; we never go negative.

CREATE OR REPLACE FUNCTION public.tgd_deduct_stock_for_withdrawal(
  p_withdrawal_request_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
declare
  v_withdrawal   record;
  v_line         record;
  v_dep_line_id  uuid;
  v_deduct_boxes numeric;
  v_deduct_weight numeric;
begin
  select w.id, w.customer_id, w.status
  into v_withdrawal
  from public.tgd_customer_withdrawal_requests w
  where w.id = p_withdrawal_request_id;

  if not found then
    raise exception 'Withdrawal request not found: %', p_withdrawal_request_id;
  end if;

  for v_line in
    select
      wl.id,
      wl.source_customer_deposit_request_id,
      wl.source_lot_no,
      wl.lot_no,
      wl.customer_product_code,
      wl.picked_boxes,
      wl.picked_weight
    from public.tgd_customer_withdrawal_request_lines wl
    where wl.withdrawal_request_id = v_withdrawal.id
      and (wl.picked_boxes > 0 or wl.picked_weight > 0)
  loop
    v_dep_line_id := null;

    -- Strategy A: direct link via source deposit request + lot
    if v_line.source_customer_deposit_request_id is not null then
      select dl.id into v_dep_line_id
      from public.tgd_customer_deposit_request_lines dl
      where dl.deposit_request_id = v_line.source_customer_deposit_request_id
        and (
          dl.lot_no = coalesce(nullif(btrim(v_line.source_lot_no), ''), nullif(btrim(v_line.lot_no), ''))
          or dl.lot_no is null
        )
      order by dl.line_no
      limit 1;
    end if;

    -- Strategy B: FIFO match by customer + product_code + lot_no
    if v_dep_line_id is null and nullif(btrim(v_line.lot_no), '') is not null then
      select dl.id into v_dep_line_id
      from public.tgd_customer_deposit_request_lines dl
      join public.tgd_customer_deposit_requests dr on dr.id = dl.deposit_request_id
      where dr.customer_id = v_withdrawal.customer_id
        and dr.status in ('RECEIVED_CONFIRMED', 'CUSTOMER_NOTIFIED')
        and dl.lot_no = btrim(v_line.lot_no)
        and (
          nullif(btrim(v_line.customer_product_code), '') is null
          or dl.customer_product_code = btrim(v_line.customer_product_code)
        )
        and coalesce(dl.actual_boxes, 0) > 0
      order by dr.last_action_at asc
      limit 1;
    end if;

    if v_dep_line_id is null then
      continue;
    end if;

    v_deduct_boxes  := coalesce(v_line.picked_boxes, 0);
    v_deduct_weight := coalesce(v_line.picked_weight, 0);

    update public.tgd_customer_deposit_request_lines
    set actual_boxes  = greatest(0, coalesce(actual_boxes,  0) - v_deduct_boxes),
        actual_weight = greatest(0, coalesce(actual_weight, 0) - v_deduct_weight)
    where id = v_dep_line_id;
  end loop;
end;
$$;

-- Wire stock deduction into the review function so it fires automatically on CONFIRM_DISPATCH.
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

  -- ACCEPT / REJECT / REVIEWING require admin or accounting
  if v_decision in ('ACCEPT', 'REJECT', 'REVIEWING') and
     v_profile.role not in ('admin', 'accounting') then
    raise exception 'Admin or accounting role required to review a withdrawal request';
  end if;

  -- SEND_TO_PICKING and CONFIRM_DISPATCH allow warehouse roles too
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

  -- Deduct picked quantities from deposit line stock when dispatch is confirmed
  if v_decision = 'CONFIRM_DISPATCH' then
    perform public.tgd_deduct_stock_for_withdrawal(v_document.id);
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
