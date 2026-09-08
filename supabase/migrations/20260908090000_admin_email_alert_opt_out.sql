-- Per-admin opt-out from the "OPERATIONS_ALERT" emails that
-- tgd_enqueue_customer_request_notifications sends to every active
-- admin/warehouse_admin on every customer CUSTOMER_SUBMIT event. There was
-- previously no way to stop a specific admin's mailbox from getting these
-- without deactivating their whole account (which would also block login).
-- Defaults to true so nobody's alerts silently stop by this migration.

begin;

alter table public.tgd_user_profiles
  add column if not exists receives_email_alerts boolean not null default true;

comment on column public.tgd_user_profiles.receives_email_alerts is
  'Whether this admin/warehouse_admin receives OPERATIONS_ALERT emails for customer document submissions. Default true (existing behavior).';

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

  elsif p_notification_event = 'WITHDRAWAL_ACCEPTED' then
    v_subject := format('[%s] คำขอเบิกสินค้าได้รับการอนุมัติแล้ว', coalesce(p_document_no, p_document_id::text));
    v_body := format(
      E'เรียนลูกค้า\n\n%s เลขที่ %s ได้รับการอนุมัติจากเจ้าหน้าที่แล้ว\nโปรดเข้าระบบเพื่อตรวจสอบรายละเอียด',
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
        and p.role in ('admin', 'warehouse_admin')
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

notify pgrst, 'reload schema';

commit;
