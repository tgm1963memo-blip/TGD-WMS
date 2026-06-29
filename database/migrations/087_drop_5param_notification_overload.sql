-- Migration 087: Remove 5-param overload of tgd_enqueue_customer_request_notifications
--
-- Root cause: supabase/migrations/20260629000002 (applied via supabase db push today)
-- created a canonical 6-param version with p_notification_event text DEFAULT 'CUSTOMER_SUBMIT'.
-- Migration 085 had left a 5-param version with only p_submitter_email.
-- Both versions match a 5-param named-param call, causing PostgreSQL to raise
-- "could not choose the best candidate function" on any RPC call with 5 params.
--
-- Fix: drop the 5-param version entirely; the 6-param version covers all cases
-- (CUSTOMER_SUBMIT default covers existing 5-param callers).
-- Also add a DISPATCH_CONFIRMED event branch to the 6-param function and
-- update grants to include the 6-param signature.

begin;

-- 1. Drop the 5-param overload (created by migration 085)
drop function if exists public.tgd_enqueue_customer_request_notifications(text, uuid, uuid, text, text);

-- 2. Replace the 6-param version to add DISPATCH_CONFIRMED event handling
create or replace function public.tgd_enqueue_customer_request_notifications(
  p_document_type       text,
  p_document_id         uuid,
  p_customer_id         uuid,
  p_document_no         text,
  p_submitter_email     text default null,
  p_notification_event  text default 'CUSTOMER_SUBMIT'
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_customer_email text;
  v_kind_label     text;
  v_subject        text;
  v_body           text;
  v_count          integer := 0;
  v_recipient      record;
begin
  select nullif(btrim(c.contact_email), '')
  into v_customer_email
  from public.tgd_customers c
  where c.id = p_customer_id;

  if p_document_type in ('CUSTOMER_DEPOSIT_REQUEST', 'DEPOSIT') then
    v_kind_label := 'ใบแจ้งฝากสินค้า';
  elsif p_document_type in ('CUSTOMER_WITHDRAWAL_REQUEST', 'WITHDRAWAL') then
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

  elsif p_notification_event = 'DISPATCH_CONFIRMED' then
    v_subject := format('[%s] จัดส่งสินค้าเรียบร้อยแล้ว', coalesce(p_document_no, p_document_id::text));
    v_body := format(
      E'เรียนลูกค้า\n\n%s เลขที่ %s ได้รับการจัดส่งสินค้าเรียบร้อยแล้ว\nโปรดเข้าระบบเพื่อตรวจสอบรายละเอียด',
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
    -- CUSTOMER_SUBMIT (default): submission confirmation
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

revoke all on function public.tgd_enqueue_customer_request_notifications(text, uuid, uuid, text, text, text) from public;
grant execute on function public.tgd_enqueue_customer_request_notifications(text, uuid, uuid, text, text, text) to authenticated;

commit;
