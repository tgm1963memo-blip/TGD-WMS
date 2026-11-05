-- TGC-confirmed dispatch date for customer withdrawals.
--
-- requested_dispatch_date stays the customer's own value (it also feeds the
-- billing/OT fallbacks and the print). TGC's commitment is stored beside it:
-- set with tgd_set_withdrawal_confirmed_dispatch_date before or after ACCEPT,
-- and defaulted to the requested date at ACCEPT when staff didn't set one.
-- Billing keeps using the actual dispatch date, never this one.
--
-- Function bodies are copied from their latest definitions:
--   tgd_review_customer_withdrawal_request       20261020100000
--   tgd_enqueue_customer_request_notifications   20260925110000
--   tgd_cancel_customer_withdrawal_request       20260618000002
-- Their signatures are unchanged, so existing grants carry over.

begin;

alter table public.tgd_customer_withdrawal_requests
  add column if not exists confirmed_dispatch_date date,
  add column if not exists confirmed_dispatch_by_email text,
  add column if not exists confirmed_dispatch_at timestamptz;

create or replace function public.tgd_set_withdrawal_confirmed_dispatch_date(
  p_request_id uuid,
  p_date       date,
  p_comment    text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_auth_user_id uuid := auth.uid();
  v_profile      record;
  v_document     record;
  v_bkk_today    date := (now() at time zone 'Asia/Bangkok')::date;
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

  if not public.tgd_role_function_allowed(
       v_profile.role, 'customer_request_approve',
       v_profile.role in ('admin', 'accounting')
     ) then
    raise exception 'Admin or accounting role required to confirm a dispatch date';
  end if;

  if p_date is null then
    raise exception 'Dispatch date is required';
  end if;

  select w.id, w.customer_id, w.status, w.withdrawal_no, w.confirmed_dispatch_date
  into v_document
  from public.tgd_customer_withdrawal_requests w
  where w.id = p_request_id
  for update;

  if not found then
    raise exception 'Customer withdrawal request not found';
  end if;

  if v_document.status not in ('SUBMITTED_BY_CUSTOMER', 'ADMIN_REVIEWING', 'ADMIN_ACCEPTED', 'WAREHOUSE_PICKING') then
    raise exception 'Cannot confirm a dispatch date from status %', v_document.status;
  end if;

  -- A planned date: only admin may put it in the past (keying in late paperwork).
  if p_date < v_bkk_today and v_profile.role is distinct from 'admin' then
    raise exception 'Dispatch date cannot be in the past';
  end if;

  if v_document.confirmed_dispatch_date is not distinct from p_date then
    return jsonb_build_object('id', v_document.id, 'confirmed_dispatch_date', p_date, 'changed', false);
  end if;

  update public.tgd_customer_withdrawal_requests
  set confirmed_dispatch_date     = p_date,
      confirmed_dispatch_by_email = v_profile.email,
      confirmed_dispatch_at       = now(),
      last_action_by_user_id      = v_profile.id,
      last_action_by_email        = v_profile.email,
      last_action_at              = now()
  where id = v_document.id;

  insert into public.tgd_customer_document_timeline_events (
    document_type, document_id, customer_id, action, from_status, to_status,
    actor_user_id, actor_email, actor_role, actor_customer_id, comment
  ) values (
    'CUSTOMER_WITHDRAWAL_REQUEST', v_document.id, v_document.customer_id,
    'CONFIRM_DISPATCH_DATE', v_document.status, v_document.status,
    v_profile.id, v_profile.email, v_profile.role, v_profile.customer_id,
    concat_ws(' — ', 'วันส่งที่ยืนยัน ' || to_char(p_date, 'DD/MM/YYYY'), nullif(btrim(p_comment), ''))
  );

  -- Before ACCEPT the date goes out with the WITHDRAWAL_ACCEPTED email; a
  -- change after it has been accepted is its own notice.
  if v_document.status in ('ADMIN_ACCEPTED', 'WAREHOUSE_PICKING') then
    perform public.tgd_enqueue_customer_request_notifications(
      'CUSTOMER_WITHDRAWAL_REQUEST', v_document.id, v_document.customer_id,
      v_document.withdrawal_no, null, 'WITHDRAWAL_DATE_CONFIRMED'
    );
  end if;

  return jsonb_build_object('id', v_document.id, 'confirmed_dispatch_date', p_date, 'changed', true);
end;
$$;

revoke all on function public.tgd_set_withdrawal_confirmed_dispatch_date(uuid, date, text) from public;
grant execute on function public.tgd_set_withdrawal_confirmed_dispatch_date(uuid, date, text) to authenticated;

create or replace function public.tgd_review_customer_withdrawal_request(
  p_request_id     uuid,
  p_decision       text,
  p_comment        text default null,
  p_effective_date date default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_auth_user_id uuid := auth.uid();
  v_profile      record;
  v_document     record;
  v_decision     text := upper(nullif(btrim(p_decision), ''));
  v_to_status    text;
  v_internal_id  uuid;
  v_unconfirmed_count int;
  v_bkk_now      timestamp := now() at time zone 'Asia/Bangkok';
  v_action_at    timestamptz := now();
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
     not public.tgd_role_function_allowed(
       v_profile.role, 'customer_request_approve',
       v_profile.role in ('admin', 'accounting')
     ) then
    raise exception 'Admin or accounting role required to review a withdrawal request';
  end if;

  if v_decision in ('SEND_TO_PICKING', 'CONFIRM_DISPATCH') and
     not public.tgd_role_function_allowed(
       v_profile.role, 'customer_withdrawal_send_to_picking',
       v_profile.role in ('admin', 'accounting', 'warehouse_admin', 'warehouse_manager', 'warehouse_staff')
     ) then
    raise exception 'Warehouse or admin role required for picking operations';
  end if;

  select w.id, w.customer_id, w.status, w.withdrawal_no, w.created_at
  into v_document
  from public.tgd_customer_withdrawal_requests w
  where w.id = p_request_id
  for update;

  if not found then
    raise exception 'Customer withdrawal request not found';
  end if;

  if p_effective_date is not null and v_decision = 'CONFIRM_DISPATCH' then
    if p_effective_date > v_bkk_now::date then
      raise exception 'Dispatch date cannot be in the future';
    end if;
    if p_effective_date < (v_document.created_at at time zone 'Asia/Bangkok')::date
       and v_profile.role is distinct from 'admin' then
      raise exception 'Dispatch date cannot be before the request was created (%)',
        (v_document.created_at at time zone 'Asia/Bangkok')::date;
    end if;
    if p_effective_date < v_bkk_now::date then
      v_action_at := (p_effective_date + time '12:00') at time zone 'Asia/Bangkok';
    end if;
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

    -- Every line must have a confirmed pick before dispatch can be
    -- confirmed (see 20260810090000).
    select count(*) into v_unconfirmed_count
    from public.tgd_customer_withdrawal_request_lines wl
    where wl.withdrawal_request_id = v_document.id
      and wl.picked_boxes is null
      and wl.picked_weight is null;

    if v_unconfirmed_count > 0 then
      raise exception 'Cannot confirm dispatch: % line(s) have no confirmed pick quantity (boxes/weight) recorded yet', v_unconfirmed_count;
    end if;
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
      last_action_at           = v_action_at
  where id = v_document.id;

  if v_decision = 'ACCEPT' then
    update public.tgd_customer_withdrawal_requests
    set confirmed_dispatch_date     = requested_dispatch_date,
        confirmed_dispatch_by_email = v_profile.email,
        confirmed_dispatch_at       = now()
    where id = v_document.id
      and confirmed_dispatch_date is null;
  end if;

  if v_decision = 'CONFIRM_DISPATCH' and v_action_at < now() then
    update public.tgd_customer_withdrawal_request_lines
    set picked_at = v_action_at
    where withdrawal_request_id = v_document.id
      and picked_at > v_action_at;
  end if;

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
    actor_user_id, actor_email, actor_role, actor_customer_id, comment, created_at
  ) values (
    'CUSTOMER_WITHDRAWAL_REQUEST', v_document.id, v_document.customer_id,
    'REVIEW_' || v_decision, v_document.status, v_to_status,
    v_profile.id, v_profile.email, v_profile.role, v_profile.customer_id,
    nullif(btrim(p_comment), ''), v_action_at
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
    'internal_withdrawal_request_id',  v_internal_id,
    'effective_at',                    v_action_at
  );
end;
$$;


create or replace function public.tgd_enqueue_customer_request_notifications(
  p_document_type text,
  p_document_id uuid,
  p_customer_id uuid,
  p_document_no text,
  p_submitter_email text default null::text,
  p_notification_event text default 'CUSTOMER_SUBMIT'::text
)
returns integer
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_customer_email text;
  v_notify_deposit_confirmed boolean;
  v_notify_withdrawal_completed boolean;
  v_notify_invoice_approved boolean;
  v_kind_label text;
  v_subject text;
  v_body text;
  v_count integer := 0;
  v_recipient record;
  v_confirmed_dispatch_date date;
begin
  select nullif(btrim(c.email), ''),
         coalesce(c.notify_deposit_confirmed, true),
         coalesce(c.notify_withdrawal_completed, true),
         coalesce(c.notify_invoice_approved, true)
  into v_customer_email, v_notify_deposit_confirmed, v_notify_withdrawal_completed, v_notify_invoice_approved
  from public.tgd_customers c
  where c.id = p_customer_id;

  if p_document_type = 'CUSTOMER_DEPOSIT_REQUEST' or p_document_type = 'DEPOSIT' then
    v_kind_label := 'ใบแจ้งฝากสินค้า';
  elsif p_document_type = 'CUSTOMER_WITHDRAWAL_REQUEST' then
    v_kind_label := 'ใบแจ้งเบิกสินค้า';
  elsif p_document_type = 'INVOICE_DRAFT' then
    v_kind_label := 'ใบแจ้งหนี้';
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
    if v_customer_email is not null and v_notify_deposit_confirmed then
      insert into public.tgd_customer_request_email_queue (
        document_type, document_id, customer_id, document_no,
        recipient_email, recipient_role, notification_kind, subject, body_preview
      ) values (
        p_document_type, p_document_id, p_customer_id, p_document_no,
        v_customer_email, 'customer_primary', 'CUSTOMER_CONFIRMATION', v_subject, v_body
      );
      v_count := v_count + 1;
    end if;

  elsif p_notification_event in ('WITHDRAWAL_ACCEPTED', 'WITHDRAWAL_DATE_CONFIRMED') then
    select w.confirmed_dispatch_date into v_confirmed_dispatch_date
    from public.tgd_customer_withdrawal_requests w
    where w.id = p_document_id;

    if p_notification_event = 'WITHDRAWAL_ACCEPTED' then
      v_subject := format('[%s] คำขอเบิกสินค้าได้รับการอนุมัติแล้ว', coalesce(p_document_no, p_document_id::text));
      v_body := format(
        E'เรียนลูกค้า\n\n%s เลขที่ %s ได้รับการอนุมัติจากเจ้าหน้าที่แล้ว%s\nโปรดเข้าระบบเพื่อตรวจสอบรายละเอียด',
        v_kind_label,
        coalesce(p_document_no, p_document_id::text),
        coalesce(E'\nวันส่งสินค้าที่ยืนยัน: ' || to_char(v_confirmed_dispatch_date, 'DD/MM/YYYY'), '')
      );
    else
      v_subject := format('[%s] เปลี่ยนวันส่งสินค้า', coalesce(p_document_no, p_document_id::text));
      v_body := format(
        E'เรียนลูกค้า\n\n%s เลขที่ %s มีการยืนยันวันส่งสินค้าใหม่%s\nโปรดเข้าระบบเพื่อตรวจสอบรายละเอียด',
        v_kind_label,
        coalesce(p_document_no, p_document_id::text),
        coalesce(E'\nวันส่งสินค้าที่ยืนยัน: ' || to_char(v_confirmed_dispatch_date, 'DD/MM/YYYY'), '')
      );
    end if;
    if v_customer_email is not null and v_notify_withdrawal_completed then
      insert into public.tgd_customer_request_email_queue (
        document_type, document_id, customer_id, document_no,
        recipient_email, recipient_role, notification_kind, subject, body_preview
      ) values (
        p_document_type, p_document_id, p_customer_id, p_document_no,
        v_customer_email, 'customer_primary', 'CUSTOMER_CONFIRMATION', v_subject, v_body
      );
      v_count := v_count + 1;
    end if;

  elsif p_notification_event = 'DISPATCH_CONFIRMED' then
    v_subject := format('[%s] จัดส่งสินค้าเรียบร้อยแล้ว', coalesce(p_document_no, p_document_id::text));
    v_body := format(
      E'เรียนลูกค้า\n\n%s เลขที่ %s ได้จัดส่งออกจากคลังเรียบร้อยแล้ว\nโปรดเข้าระบบเพื่อตรวจสอบรายละเอียด',
      v_kind_label,
      coalesce(p_document_no, p_document_id::text)
    );
    if v_customer_email is not null and v_notify_withdrawal_completed then
      insert into public.tgd_customer_request_email_queue (
        document_type, document_id, customer_id, document_no,
        recipient_email, recipient_role, notification_kind, subject, body_preview
      ) values (
        p_document_type, p_document_id, p_customer_id, p_document_no,
        v_customer_email, 'customer_primary', 'CUSTOMER_CONFIRMATION', v_subject, v_body
      );
      v_count := v_count + 1;
    end if;

  elsif p_notification_event = 'INVOICE_APPROVED' then
    v_subject := format('[%s] ใบแจ้งหนี้พร้อมแล้ว', coalesce(p_document_no, p_document_id::text));
    v_body := format(
      E'เรียนลูกค้า\n\n%s เลขที่ %s ได้รับการอนุมัติและพร้อมให้ตรวจสอบแล้ว\nโปรดเข้าระบบเพื่อตรวจสอบรายละเอียด',
      v_kind_label,
      coalesce(p_document_no, p_document_id::text)
    );
    if v_customer_email is not null and v_notify_invoice_approved then
      insert into public.tgd_customer_request_email_queue (
        document_type, document_id, customer_id, document_no,
        recipient_email, recipient_role, notification_kind, subject, body_preview
      ) values (
        p_document_type, p_document_id, p_customer_id, p_document_no,
        v_customer_email, 'customer_primary', 'CUSTOMER_CONFIRMATION', v_subject, v_body
      );
      v_count := v_count + 1;
    end if;

  elsif p_notification_event = 'RECOUNT_REQUESTED' then
    -- Internal only: ask the warehouse team to recount. Never goes to the
    -- customer or the submitter (it used to fall through to CUSTOMER_SUBMIT
    -- and send the customer a bogus "submission confirmed" email).
    v_subject := format('[%s] %s — %s', p_document_no, v_kind_label, 'ขอตรวจนับใหม่');
    v_body := format(
      'มีคำขอตรวจนับใหม่สำหรับ%s %s — โปรดตรวจสอบในระบบ WMS',
      v_kind_label,
      coalesce(p_document_no, p_document_id::text)
    );

    for v_recipient in
      select distinct nullif(btrim(p.email), '') as email, p.role
      from public.tgd_user_profiles p
      where p.is_active = true
        and p.role = 'warehouse_admin'
        and coalesce(p.receives_email_alerts, true) = true
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

  else
    -- CUSTOMER_SUBMIT: kept for backward compat. Not gated by any
    -- customer preference — this is the original submission-confirmation
    -- email, distinct from the 3 preference-gated events above.
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
        and p.role = 'warehouse_admin'
        and coalesce(p.receives_email_alerts, true) = true
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

-- Customer cancel lead time counts from the confirmed date once TGC has set one.
create or replace function public.tgd_cancel_customer_withdrawal_request(
  p_request_id uuid,
  p_comment text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_auth_user_id uuid := auth.uid();
  v_profile record;
  v_document record;
  v_policy record;
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

  if not found or v_profile.role not in ('customer_admin', 'customer_user', 'admin', 'accounting') then
    raise exception 'Role is not allowed to cancel a withdrawal request';
  end if;

  select w.id, w.customer_id, w.status,
         coalesce(w.confirmed_dispatch_date, w.requested_dispatch_date) as requested_dispatch_date
  into v_document
  from public.tgd_customer_withdrawal_requests w
  where w.id = p_request_id
  for update;

  if not found then
    raise exception 'Customer withdrawal request not found';
  end if;

  select p.deposit_cancel_lead_days, p.withdrawal_cancel_lead_days
  into v_policy
  from public.tgd_customer_request_policy p
  where p.id = 1;

  if not found then
    v_policy.deposit_cancel_lead_days := 3;
    v_policy.withdrawal_cancel_lead_days := 3;
  end if;

  if v_profile.role in ('customer_admin', 'customer_user') then
    if v_profile.customer_id is null or v_profile.customer_id <> v_document.customer_id then
      raise exception 'Customer scope violation';
    end if;
    if v_document.status not in ('WITHDRAWAL_DRAFT', 'SUBMITTED_BY_CUSTOMER', 'ADMIN_REVIEWING', 'ADMIN_ACCEPTED') then
      raise exception 'Customer cannot cancel withdrawal request from status %', v_document.status;
    end if;
    if v_document.status <> 'WITHDRAWAL_DRAFT'
       and v_document.requested_dispatch_date is not null
       and v_document.requested_dispatch_date < (current_date + v_policy.withdrawal_cancel_lead_days) then
      raise exception 'Cancellation must be requested at least % day(s) before the dispatch date', v_policy.withdrawal_cancel_lead_days;
    end if;
  elsif v_document.status in (
    'ADMIN_REJECTED',
    'LOADED_CONFIRMED',
    'CUSTOMER_NOTIFIED',
    'CLOSED',
    'CANCELLED'
  ) then
    raise exception 'Withdrawal request is terminal and cannot be cancelled';
  end if;

  update public.tgd_customer_withdrawal_requests
  set status = 'CANCELLED',
      last_action_by_user_id = v_profile.id,
      last_action_by_email = v_profile.email,
      last_action_at = now()
  where id = v_document.id;

  insert into public.tgd_customer_document_timeline_events (
    document_type, document_id, customer_id, action, from_status, to_status,
    actor_user_id, actor_email, actor_role, actor_customer_id, comment
  ) values (
    'CUSTOMER_WITHDRAWAL_REQUEST', v_document.id, v_document.customer_id,
    'CANCEL', v_document.status, 'CANCELLED',
    v_profile.id, v_profile.email, v_profile.role, v_profile.customer_id,
    nullif(btrim(p_comment), '')
  );

  return jsonb_build_object(
    'id', v_document.id,
    'customer_id', v_document.customer_id,
    'status', 'CANCELLED',
    'action', 'CANCEL'
  );
end;
$$;

notify pgrst, 'reload schema';

commit;
