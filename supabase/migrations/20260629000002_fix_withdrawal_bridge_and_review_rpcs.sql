-- Fix withdrawal approval flow end-to-end.
-- Root cause: tgd_bridge_customer_withdrawal_to_internal in production uses wrong column
-- names (withdrawal_no instead of request_no in tgd_withdrawal_requests INSERT).
-- Also: tgd_enqueue_customer_request_notifications is missing the p_notification_event param
-- (migration 005 was never applied), causing the ACCEPT notification call to fail.
-- All corrected versions must be applied manually via Supabase Dashboard SQL Editor.

-- ─── Step 0: Fix notification function (migration 005 was never applied) ─────

CREATE OR REPLACE FUNCTION public.tgd_enqueue_customer_request_notifications(
  p_document_type text,
  p_document_id uuid,
  p_customer_id uuid,
  p_document_no text,
  p_submitter_email text DEFAULT NULL::text,
  p_notification_event text DEFAULT 'CUSTOMER_SUBMIT'::text
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
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

  if p_notification_event = 'DEPOSIT_CONFIRMED' then
    v_subject := format('[%s] ยืนยันการรับสินค้าเข้าคลังแล้ว', coalesce(p_document_no, p_document_id::text));
    v_body := format(
      E'เรียนลูกค้า\n\nสินค้าตาม%s เลขที่ %s ได้รับการยืนยันการรับเข้าคลังเรียบร้อยแล้ว\nโปรดเข้าระบบเพื่อตรวจสอบรายละเอียด',
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

  elsif p_notification_event = 'WITHDRAWAL_ACCEPTED' then
    v_subject := format('[%s] คำขอเบิกสินค้าได้รับการอนุมัติแล้ว', coalesce(p_document_no, p_document_id::text));
    v_body := format(
      E'เรียนลูกค้า\n\n%s เลขที่ %s ได้รับการอนุมัติจากเจ้าหน้าที่แล้ว\nโปรดเข้าระบบเพื่อตรวจสอบรายละเอียด',
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

  else
    -- CUSTOMER_SUBMIT: kept for backward compat
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

-- ─── Step 1: Add bridging columns if they don't exist yet ────────────────────

ALTER TABLE public.tgd_withdrawal_requests
  ADD COLUMN IF NOT EXISTS source_customer_withdrawal_request_id uuid
    REFERENCES public.tgd_customer_withdrawal_requests(id);

ALTER TABLE public.tgd_withdrawal_requests
  ADD COLUMN IF NOT EXISTS source_customer_withdrawal_no text;

-- ─── Step 2: Correct bridge function ─────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.tgd_bridge_customer_withdrawal_to_internal(
  p_withdrawal_request_id uuid,
  p_actor_user_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
declare
  v_withdrawal record;
  v_internal_id uuid;
  v_line record;
  v_product_id uuid;
  v_lot_id uuid;
begin
  if p_withdrawal_request_id is null then
    raise exception 'withdrawal_request_id is required';
  end if;

  select w.id, w.withdrawal_no, w.customer_id, w.status
  into v_withdrawal
  from public.tgd_customer_withdrawal_requests w
  where w.id = p_withdrawal_request_id;

  if not found then
    raise exception 'Customer withdrawal request not found';
  end if;

  if v_withdrawal.status <> 'ADMIN_ACCEPTED' then
    raise exception 'Withdrawal request must be ADMIN_ACCEPTED before execution bridge';
  end if;

  -- Idempotency: return existing internal request if already bridged
  if exists (
    select 1
    from public.tgd_customer_withdrawal_execution_links l
    where l.customer_withdrawal_request_id = v_withdrawal.id
      and l.internal_withdrawal_request_id is not null
  ) then
    select l.internal_withdrawal_request_id
    into v_internal_id
    from public.tgd_customer_withdrawal_execution_links l
    where l.customer_withdrawal_request_id = v_withdrawal.id
    order by l.created_at
    limit 1;
    return v_internal_id;
  end if;

  -- Create internal withdrawal request using actual schema columns
  insert into public.tgd_withdrawal_requests (
    request_no,
    customer_id,
    status,
    requested_at,
    source_customer_withdrawal_request_id,
    source_customer_withdrawal_no
  ) values (
    v_withdrawal.withdrawal_no,
    v_withdrawal.customer_id,
    'DRAFT',
    now(),
    v_withdrawal.id,
    v_withdrawal.withdrawal_no
  )
  returning id into v_internal_id;

  -- Link header record
  insert into public.tgd_customer_withdrawal_execution_links (
    customer_withdrawal_request_id,
    internal_withdrawal_request_id,
    link_scope,
    created_by_user_id
  ) values (
    v_withdrawal.id,
    v_internal_id,
    'HEADER',
    p_actor_user_id
  );

  -- Bridge each line, skipping lines where product or lot cannot be resolved
  for v_line in
    select l.*
    from public.tgd_customer_withdrawal_request_lines l
    where l.withdrawal_request_id = v_withdrawal.id
    order by l.line_no
  loop
    v_product_id := v_line.product_id;

    if v_product_id is null and nullif(btrim(v_line.internal_product_code), '') is not null then
      select p.id into v_product_id
      from public.tgd_products p
      where lower(p.sku) = lower(btrim(v_line.internal_product_code))
      limit 1;
    end if;

    if v_product_id is null and nullif(btrim(v_line.customer_product_code), '') is not null then
      select cp.internal_product_id into v_product_id
      from public.tgd_customer_products cp
      where cp.customer_id = v_withdrawal.customer_id
        and lower(cp.customer_product_code) = lower(btrim(v_line.customer_product_code))
      limit 1;
    end if;

    if v_product_id is null then
      continue;
    end if;

    v_lot_id := null;
    if nullif(btrim(coalesce(v_line.source_lot_no, v_line.lot_no)), '') is not null then
      select lt.id into v_lot_id
      from public.tgd_lots lt
      where lt.product_id = v_product_id
        and lt.lot_number = btrim(coalesce(v_line.source_lot_no, v_line.lot_no))
      limit 1;
    end if;

    -- lot_id is NOT NULL in tgd_withdrawal_request_lines — skip if not found
    if v_lot_id is null then
      continue;
    end if;

    insert into public.tgd_withdrawal_request_lines (
      request_id,
      product_id,
      lot_id,
      quantity,
      weight
    ) values (
      v_internal_id,
      v_product_id,
      v_lot_id,
      coalesce(v_line.requested_qty, 0),
      v_line.requested_weight
    );

    insert into public.tgd_customer_withdrawal_execution_links (
      customer_withdrawal_request_id,
      customer_withdrawal_request_line_id,
      internal_withdrawal_request_id,
      link_scope,
      created_by_user_id
    ) values (
      v_withdrawal.id,
      v_line.id,
      v_internal_id,
      'LINE',
      p_actor_user_id
    );
  end loop;

  return v_internal_id;
end;
$$;

-- ─── Step 3: Correct review function (no stock-deduction side-effect) ─────────

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
