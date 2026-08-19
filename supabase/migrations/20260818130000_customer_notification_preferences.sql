-- Per-customer email notification preferences, plus 3 fixes to the
-- existing notification pipeline that were blocking these preferences
-- from having any real effect:
--
-- 1. tgd_customers has had two separate email columns (`email`, managed by
--    the customer admin UI, and `contact_email`, read by the notification
--    RPC but never populated by any UI) — consolidating to `email`, with a
--    one-time backfill so no customer's notification address regresses.
-- 2. DEPOSIT_CONFIRMED already had a branch with correct copy in the RPC,
--    but the only real caller never passed that event name — fixed at the
--    call site (customerDepositRequestService.js), not here.
-- 3. The withdrawal caller already passes DISPATCH_CONFIRMED, but the RPC
--    had no matching branch — added here.
-- 4. Invoice-draft approval had zero notification wiring at all — added
--    here (INVOICE_APPROVED branch) plus a new caller in
--    billingInvoiceDraftService.js.
--
-- All 3 new boolean columns default to true, preserving today's
-- "always send" behavior for every existing customer — staff opt specific
-- customers OUT, nobody is silently opted out by this migration.

begin;

alter table public.tgd_customers
  add column if not exists notify_deposit_confirmed boolean not null default true,
  add column if not exists notify_withdrawal_completed boolean not null default true,
  add column if not exists notify_invoice_approved boolean not null default true;

comment on column public.tgd_customers.notify_deposit_confirmed is
  'Whether this customer receives an email when their deposit is confirmed received into the warehouse. Default true (existing behavior).';
comment on column public.tgd_customers.notify_withdrawal_completed is
  'Whether this customer receives an email when their withdrawal request is dispatched/completed. Default true (existing behavior).';
comment on column public.tgd_customers.notify_invoice_approved is
  'Whether this customer receives an email when their billing invoice draft is approved. Default true.';

-- Recover any address that only ever lived in the orphaned contact_email
-- column, before the RPC below stops reading it.
update public.tgd_customers
set email = nullif(btrim(contact_email), '')
where nullif(btrim(email), '') is null
  and nullif(btrim(contact_email), '') is not null;

comment on column public.tgd_customers.contact_email is
  'Deprecated — superseded by email as of 2026-08-18. No longer read by tgd_enqueue_customer_request_notifications; kept only to avoid a destructive column drop on a live table.';

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
    -- preference — this is the original submission-confirmation email,
    -- distinct from the 3 new preference-gated events above.
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
