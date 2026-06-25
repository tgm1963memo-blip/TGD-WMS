-- Migration: Fix invoice draft source_document_no and email notification triggers
-- 1. Fix tgd_billing_movement_weight_v to resolve CDR-... number from deposit request
-- 2. Backfill existing invoice draft lines that have null source_document_no
-- 3. Cancel all existing PENDING emails (they were sent on customer submit, not admin confirm)
-- 4. Remove notification from customer submit functions
-- 5. Add notification to admin confirm deposit / admin accept withdrawal functions
-- 6. Update enqueue function to support admin-action notification events

-- ============================================================
-- 1. Fix tgd_billing_movement_weight_v
-- ============================================================
CREATE OR REPLACE VIEW public.tgd_billing_movement_weight_v AS
SELECT
  um.id AS movement_id,
  um.movement_type_raw AS movement_type,
  um.movement_type_canonical,
  um.movement_date,
  um.customer_id,
  NULL::text AS customer_code,
  c.name AS customer_name,
  um.product_id,
  p.sku AS product_code,
  COALESCE(p.name, p.description) AS product_name,
  um.lot_id,
  l.lot_number AS lot_no,
  COALESCE(um.to_pallet_id, um.from_pallet_id) AS pallet_id,
  pal.identifier AS pallet_no,
  COALESCE(um.to_warehouse_id, um.from_warehouse_id) AS warehouse_id,
  um.from_location_id,
  um.to_location_id,
  um.qty,
  COALESCE(um.uom, p.unit) AS uom,
  um.net_weight,
  um.gross_weight,
  um.chargeable_weight,
  NULL::numeric AS weight_per_unit,
  NULL::numeric AS pallet_weight,
  COALESCE(um.reference_no, cdr.request_no) AS source_document_no,
  COALESCE(um.source_module, um.reference_type) AS source_document_type,
  um.source_document_id,
  um.is_draft,
  um.is_billable,
  um.billing_exclusion_reason,
  um.billing_service_type,
  um.billing_status,
  um.ledger_source
FROM public.tgd_unified_movements_v um
LEFT JOIN public.tgd_customers c ON c.id = um.customer_id
LEFT JOIN public.tgd_products p ON p.id = um.product_id
LEFT JOIN public.tgd_lots l ON l.id = um.lot_id
LEFT JOIN public.tgd_pallets pal ON pal.id = COALESCE(um.to_pallet_id, um.from_pallet_id)
LEFT JOIN public.tgd_customer_deposit_requests cdr
  ON cdr.id = um.source_document_id
  AND um.source_module = 'CUSTOMER_DEPOSIT_REQUEST';

-- ============================================================
-- 2. Backfill existing invoice draft lines
-- ============================================================
UPDATE public.tgd_billing_invoice_draft_lines idl
SET source_document_no = cdr.request_no
FROM public.tgd_stock_movements sm
JOIN public.tgd_customer_deposit_requests cdr ON cdr.id = sm.source_document_id
WHERE idl.source_movement_id = sm.id
  AND idl.source_document_no IS NULL
  AND sm.source_document_id IS NOT NULL;

-- ============================================================
-- 3. Skip all existing PENDING emails (stop the non-stop sending loop)
-- ============================================================
UPDATE public.tgd_customer_request_email_queue
SET status = 'SKIPPED'
WHERE status = 'PENDING';

-- ============================================================
-- 4. Update enqueue function to support different notification events
-- ============================================================
CREATE OR REPLACE FUNCTION public.tgd_enqueue_customer_request_notifications(
  p_document_type text,
  p_document_id uuid,
  p_customer_id uuid,
  p_document_no text,
  p_submitter_email text DEFAULT NULL::text,
  p_notification_event text DEFAULT 'CUSTOMER_SUBMIT'
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
declare
  v_customer_email text;
  v_kind_label text;
  v_subject text;
  v_body text;
  v_count integer := 0;
  v_recipient record;
begin
  select nullif(btrim(c.contact_email), '')
  into v_customer_email
  from public.tgd_customers c
  where c.id = p_customer_id;

  if p_document_type = 'CUSTOMER_DEPOSIT_REQUEST' then
    v_kind_label := 'ใบแจ้งฝากสินค้า';
  elsif p_document_type = 'CUSTOMER_WITHDRAWAL_REQUEST' then
    v_kind_label := 'ใบแจ้งเบิกสินค้า';
  else
    v_kind_label := 'คำขอลูกค้า';
  end if;

  -- Build subject/body based on event type
  if p_notification_event = 'DEPOSIT_CONFIRMED' then
    v_subject := format('[%s] ยืนยันการรับสินค้าเข้าคลังแล้ว', coalesce(p_document_no, p_document_id::text));
    v_body := format(
      'เรียนลูกค้า%n%nสินค้าตาม%s เลขที่ %s ได้รับการยืนยันการรับเข้าคลังเรียบร้อยแล้ว%nโปรดเข้าระบบเพื่อตรวจสอบรายละเอียด',
      v_kind_label,
      coalesce(p_document_no, p_document_id::text)
    );
    -- Send only to customer
    if v_customer_email is not null then
      insert into public.tgd_customer_request_email_queue (
        document_type, document_id, customer_id, document_no,
        recipient_email, recipient_role, notification_kind, subject, body_preview
      ) values (
        p_document_type, p_document_id, p_customer_id, p_document_no,
        v_customer_email, 'customer_primary', 'CUSTOMER_CONFIRMATION', v_subject, v_body
      );
      v_count := v_count + 1;
    end if;

  elsif p_notification_event = 'WITHDRAWAL_ACCEPTED' then
    v_subject := format('[%s] คำขอเบิกสินค้าได้รับการอนุมัติแล้ว', coalesce(p_document_no, p_document_id::text));
    v_body := format(
      'เรียนลูกค้า%n%n%s เลขที่ %s ได้รับการอนุมัติจากเจ้าหน้าที่แล้ว%nโปรดเข้าระบบเพื่อตรวจสอบรายละเอียด',
      v_kind_label,
      coalesce(p_document_no, p_document_id::text)
    );
    -- Send only to customer
    if v_customer_email is not null then
      insert into public.tgd_customer_request_email_queue (
        document_type, document_id, customer_id, document_no,
        recipient_email, recipient_role, notification_kind, subject, body_preview
      ) values (
        p_document_type, p_document_id, p_customer_id, p_document_no,
        v_customer_email, 'customer_primary', 'CUSTOMER_CONFIRMATION', v_subject, v_body
      );
      v_count := v_count + 1;
    end if;

  else
    -- Default: CUSTOMER_SUBMIT event (kept for backward compatibility, but no longer called)
    v_subject := format('[%s] %s — %s', p_document_no, v_kind_label, 'ยืนยันการส่งคำขอ');
    v_body := format(
      'ลูกค้าส่ง%s %s เรียบร้อยแล้ว ระบบบันทึกสถานะ SUBMITTED_BY_CUSTOMER',
      v_kind_label,
      coalesce(p_document_no, p_document_id::text)
    );

    if v_customer_email is not null then
      insert into public.tgd_customer_request_email_queue (
        document_type, document_id, customer_id, document_no,
        recipient_email, recipient_role, notification_kind, subject, body_preview
      ) values (
        p_document_type, p_document_id, p_customer_id, p_document_no,
        v_customer_email, 'customer_primary', 'CUSTOMER_CONFIRMATION', v_subject, v_body
      );
      v_count := v_count + 1;
    end if;

    if nullif(btrim(p_submitter_email), '') is not null
       and lower(btrim(p_submitter_email)) is distinct from lower(coalesce(v_customer_email, '')) then
      insert into public.tgd_customer_request_email_queue (
        document_type, document_id, customer_id, document_no,
        recipient_email, recipient_role, notification_kind, subject, body_preview
      ) values (
        p_document_type, p_document_id, p_customer_id, p_document_no,
        btrim(p_submitter_email), 'customer_submitter', 'CUSTOMER_CONFIRMATION', v_subject, v_body
      );
      v_count := v_count + 1;
    end if;

    v_subject := format('[%s] %s — %s', p_document_no, v_kind_label, 'แจ้งธุรการ/คลัง');
    v_body := format(
      'มี%sใหม่จากลูกค้า: %s — โปรดตรวจสอบในระบบ WMS',
      v_kind_label,
      coalesce(p_document_no, p_document_id::text)
    );

    for v_recipient in
      select distinct nullif(btrim(p.email), '') as email, p.role
      from public.tgd_user_profiles p
      where p.is_active = true
        and p.role in ('admin', 'accounting', 'warehouse_admin', 'warehouse_manager')
        and nullif(btrim(p.email), '') is not null
    loop
      insert into public.tgd_customer_request_email_queue (
        document_type, document_id, customer_id, document_no,
        recipient_email, recipient_role, notification_kind, subject, body_preview
      ) values (
        p_document_type, p_document_id, p_customer_id, p_document_no,
        v_recipient.email, v_recipient.role, 'OPERATIONS_ALERT', v_subject, v_body
      );
      v_count := v_count + 1;
    end loop;
  end if;

  return v_count;
end;
$$;

grant execute on function public.tgd_enqueue_customer_request_notifications(
  text, uuid, uuid, text, text, text
) to authenticated;

-- ============================================================
-- 5. Remove notification from tgd_submit_customer_deposit_request
-- ============================================================
CREATE OR REPLACE FUNCTION public.tgd_submit_customer_deposit_request(
  p_request_id uuid,
  p_comment text DEFAULT NULL::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
declare
  v_auth_user_id uuid := auth.uid();
  v_profile record;
  v_document record;
  v_request_no text;
begin
  if v_auth_user_id is null or not public.tgd_current_user_is_active() then
    raise exception 'Active authenticated user required';
  end if;

  select p.id, p.email, p.role, p.customer_id into v_profile
  from public.tgd_user_profiles p
  where p.auth_user_id = v_auth_user_id and p.is_active = true limit 1;
  if not found then raise exception 'Active profile required'; end if;
  perform public.tgd_assert_customer_request_actor(v_profile.role, v_profile.customer_id);

  select d.id, d.customer_id, d.status, d.request_no into v_document
  from public.tgd_customer_deposit_requests d where d.id = p_request_id for update;
  if not found then raise exception 'Customer deposit request not found'; end if;
  perform public.tgd_assert_customer_request_document_scope(v_profile.role, v_profile.customer_id, v_document.customer_id);
  if v_document.status <> 'DRAFT' then raise exception 'Deposit request must be DRAFT before submission'; end if;

  v_request_no := v_document.request_no;

  update public.tgd_customer_deposit_requests
  set status = 'SUBMITTED_BY_CUSTOMER',
      submitted_by_user_id = v_profile.id,
      submitted_by_email = v_profile.email,
      submitted_at = now(),
      last_action_by_user_id = v_profile.id,
      last_action_by_email = v_profile.email,
      last_action_at = now()
  where id = v_document.id;

  insert into public.tgd_customer_document_timeline_events (
    document_type, document_id, customer_id, action, from_status, to_status,
    actor_user_id, actor_email, actor_role, actor_customer_id, comment
  ) values (
    'CUSTOMER_DEPOSIT_REQUEST', v_document.id, v_document.customer_id,
    'SUBMIT', v_document.status, 'SUBMITTED_BY_CUSTOMER',
    v_profile.id, v_profile.email, v_profile.role, v_profile.customer_id,
    nullif(btrim(p_comment), '')
  );

  -- Email notification removed: only sent when admin confirms receipt (CONFIRM_RECEIPT)

  return jsonb_build_object(
    'id', v_document.id, 'customer_id', v_document.customer_id,
    'status', 'SUBMITTED_BY_CUSTOMER', 'action', 'SUBMIT'
  );
end;
$$;

-- ============================================================
-- 6. Remove notification from tgd_submit_customer_withdrawal_request
-- ============================================================
CREATE OR REPLACE FUNCTION public.tgd_submit_customer_withdrawal_request(
  p_request_id uuid,
  p_comment text DEFAULT NULL::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
declare
  v_auth_user_id uuid := auth.uid();
  v_profile record;
  v_document record;
  v_withdrawal_no text;
begin
  if v_auth_user_id is null or not public.tgd_current_user_is_active() then
    raise exception 'Active authenticated user required';
  end if;

  select p.id, p.email, p.role, p.customer_id into v_profile
  from public.tgd_user_profiles p
  where p.auth_user_id = v_auth_user_id and p.is_active = true limit 1;
  if not found then raise exception 'Active profile required'; end if;
  perform public.tgd_assert_customer_request_actor(v_profile.role, v_profile.customer_id);

  select w.id, w.customer_id, w.status, w.withdrawal_no into v_document
  from public.tgd_customer_withdrawal_requests w where w.id = p_request_id for update;
  if not found then raise exception 'Customer withdrawal request not found'; end if;
  perform public.tgd_assert_customer_request_document_scope(v_profile.role, v_profile.customer_id, v_document.customer_id);

  if v_document.status <> 'WITHDRAWAL_DRAFT' then raise exception 'Withdrawal request must be DRAFT before submission'; end if;

  v_withdrawal_no := v_document.withdrawal_no;

  update public.tgd_customer_withdrawal_requests
  set status = 'SUBMITTED_BY_CUSTOMER',
      submitted_by_user_id = v_profile.id,
      submitted_by_email = v_profile.email,
      submitted_at = now(),
      last_action_by_user_id = v_profile.id,
      last_action_by_email = v_profile.email,
      last_action_at = now()
  where id = v_document.id;

  insert into public.tgd_customer_document_timeline_events (
    document_type, document_id, customer_id, action, from_status, to_status,
    actor_user_id, actor_email, actor_role, actor_customer_id, comment
  ) values (
    'CUSTOMER_WITHDRAWAL_REQUEST', v_document.id, v_document.customer_id,
    'SUBMIT', v_document.status, 'SUBMITTED_BY_CUSTOMER',
    v_profile.id, v_profile.email, v_profile.role, v_profile.customer_id,
    nullif(btrim(p_comment), '')
  );

  -- Email notification removed: only sent when admin accepts (ACCEPT)

  return jsonb_build_object(
    'id', v_document.id, 'customer_id', v_document.customer_id,
    'status', 'SUBMITTED_BY_CUSTOMER', 'action', 'SUBMIT'
  );
end;
$$;

-- ============================================================
-- 7. Add notification to tgd_review_customer_deposit_request on CONFIRM_RECEIPT
-- ============================================================
CREATE OR REPLACE FUNCTION public.tgd_review_customer_deposit_request(
  p_request_id uuid,
  p_decision text,
  p_comment text DEFAULT NULL::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
declare
  v_auth_user_id uuid := auth.uid();
  v_profile record;
  v_document record;
  v_decision text := upper(nullif(btrim(p_decision), ''));
  v_to_status text;
  v_receiving_id uuid;
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

  if v_decision not in ('ACCEPT', 'REJECT', 'REVIEWING', 'CONFIRM_RECEIPT') then
    raise exception 'Decision must be ACCEPT, REJECT, REVIEWING, or CONFIRM_RECEIPT';
  end if;

  if v_decision = 'CONFIRM_RECEIPT' then
    if v_profile.role not in ('admin', 'accounting', 'warehouse_manager', 'warehouse_admin') then
      raise exception 'Admin, accounting, or warehouse role required to confirm deposit receiving';
    end if;
  else
    if v_profile.role not in ('admin', 'accounting') then
      raise exception 'Admin or accounting role required to review a deposit request';
    end if;
  end if;

  select d.id, d.customer_id, d.status, d.request_no
  into v_document
  from public.tgd_customer_deposit_requests d
  where d.id = p_request_id
  for update;

  if not found then
    raise exception 'Customer deposit request not found';
  end if;

  if v_decision = 'REVIEWING' and v_document.status = 'SUBMITTED_BY_CUSTOMER' then
    v_to_status := 'ADMIN_REVIEWING';
  elsif v_decision = 'ACCEPT' and v_document.status = 'ADMIN_REVIEWING' then
    v_to_status := 'ADMIN_ACCEPTED';
  elsif v_decision = 'REJECT' and v_document.status = 'ADMIN_REVIEWING' then
    v_to_status := 'ADMIN_REJECTED';
  elsif v_decision = 'CONFIRM_RECEIPT' and v_document.status in ('WAREHOUSE_RECEIVING', 'PALLETIZING', 'COUNT_VARIANCE_REVIEW', 'ADMIN_RECOUNT_REQUESTED') then
    v_to_status := 'RECEIVED_CONFIRMED';
  else
    raise exception 'Invalid deposit review transition from % using %',
      v_document.status, v_decision;
  end if;

  update public.tgd_customer_deposit_requests
  set status = v_to_status,
      reviewed_by_user_id = case when v_decision in ('ACCEPT', 'REJECT') then v_profile.id else reviewed_by_user_id end,
      reviewed_by_email = case when v_decision in ('ACCEPT', 'REJECT') then v_profile.email else reviewed_by_email end,
      reviewed_at = case when v_decision in ('ACCEPT', 'REJECT') then now() else reviewed_at end,
      web_approved_by_user_id = case when v_decision = 'CONFIRM_RECEIPT' then v_profile.id else web_approved_by_user_id end,
      web_approved_by_email = case when v_decision = 'CONFIRM_RECEIPT' then v_profile.email else web_approved_by_email end,
      review_comment = nullif(btrim(p_comment), ''),
      last_action_by_user_id = v_profile.id,
      last_action_by_email = v_profile.email,
      last_action_at = now()
  where id = v_document.id;

  if v_decision = 'ACCEPT' then
    v_receiving_id := public.tgd_bridge_customer_deposit_to_receiving(v_document.id, v_profile.id);
  end if;

  insert into public.tgd_customer_document_timeline_events (
    document_type, document_id, customer_id, action, from_status, to_status,
    actor_user_id, actor_email, actor_role, actor_customer_id, comment
  ) values (
    'CUSTOMER_DEPOSIT_REQUEST', v_document.id, v_document.customer_id,
    'REVIEW_' || v_decision, v_document.status,
    case when v_decision = 'ACCEPT' then 'WAREHOUSE_RECEIVING' else v_to_status end,
    v_profile.id, v_profile.email, v_profile.role, v_profile.customer_id,
    nullif(btrim(p_comment), '')
  );

  -- Send email to customer when admin confirms receipt of deposit
  if v_decision = 'CONFIRM_RECEIPT' then
    perform public.tgd_enqueue_customer_request_notifications(
      'CUSTOMER_DEPOSIT_REQUEST', v_document.id, v_document.customer_id,
      v_document.request_no, null, 'DEPOSIT_CONFIRMED'
    );
  end if;

  return jsonb_build_object(
    'id', v_document.id,
    'customer_id', v_document.customer_id,
    'status', case when v_decision = 'ACCEPT' then 'WAREHOUSE_RECEIVING' else v_to_status end,
    'action', 'REVIEW_' || v_decision,
    'receiving_document_id', v_receiving_id
  );
end;
$$;

-- ============================================================
-- 8. Add notification to tgd_review_customer_withdrawal_request on ACCEPT
-- ============================================================
CREATE OR REPLACE FUNCTION public.tgd_review_customer_withdrawal_request(
  p_request_id uuid,
  p_decision text,
  p_comment text DEFAULT NULL::text
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

  if not found or v_profile.role not in ('admin', 'accounting') then
    raise exception 'Admin or accounting role required to review a withdrawal request';
  end if;

  if v_decision not in ('ACCEPT', 'REJECT', 'REVIEWING', 'SEND_TO_PICKING', 'CONFIRM_DISPATCH') then
    raise exception 'Decision must be ACCEPT, REJECT, REVIEWING, SEND_TO_PICKING, or CONFIRM_DISPATCH';
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
  set status = v_to_status,
      reviewed_by_user_id  = case when v_decision in ('ACCEPT', 'REJECT') then v_profile.id else reviewed_by_user_id end,
      reviewed_by_email    = case when v_decision in ('ACCEPT', 'REJECT') then v_profile.email else reviewed_by_email end,
      reviewed_at          = case when v_decision in ('ACCEPT', 'REJECT') then now() else reviewed_at end,
      review_comment       = nullif(btrim(p_comment), ''),
      last_action_by_user_id = v_profile.id,
      last_action_by_email   = v_profile.email,
      last_action_at         = now()
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

  -- Send email to customer when admin accepts the withdrawal
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
