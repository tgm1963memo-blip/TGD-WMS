-- Close the remaining ways request emails reached role=admin users, and
-- give RECOUNT_REQUESTED its own internal-only branch.
--
-- 1. The queue trigger from 113 only looked at recipient_role = 'admin'.
--    An admin could still be mailed under another label, e.g. as
--    'customer_submitter' when they submitted a document on a customer's
--    behalf, or when their address is a customer contact. The trigger now
--    skips any PENDING row whose recipient_email belongs to an active admin
--    profile, whatever the label.
-- 2. tgd_enqueue_customer_request_notifications: OPERATIONS_ALERT goes to
--    warehouse_admin only, and RECOUNT_REQUESTED (used by "ขอตรวจนับใหม่")
--    no longer falls through to the customer-submit confirmation.
-- 3. Re-adds receives_email_alerts (from 20260908090000, which never reached
--    production) so the per-user opt-out actually works.

begin;

alter table public.tgd_user_profiles
  add column if not exists receives_email_alerts boolean not null default true;

create or replace function public.tgd_is_admin_email(p_email text)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select exists (
    select 1 from public.tgd_user_profiles p
    where p.is_active = true
      and p.role = 'admin'
      and lower(btrim(p.email)) = lower(btrim(coalesce(p_email, '')))
  );
$$;

create or replace function public.tgd_skip_admin_request_email_queue()
returns trigger
language plpgsql
set search_path to 'public'
as $$
begin
  if new.status = 'PENDING' and (
    lower(btrim(coalesce(new.recipient_role, ''))) = 'admin'
    or public.tgd_is_admin_email(new.recipient_email)
  ) then
    new.status := 'SKIPPED';
    new.error_log := coalesce(new.error_log, 'Skipped: role admin no longer receives request emails.');
    new.sent_at := coalesce(new.sent_at, now());
  end if;

  return new;
end;
$$;

drop trigger if exists tgd_skip_admin_request_email_queue_trg
  on public.tgd_customer_request_email_queue;

create trigger tgd_skip_admin_request_email_queue_trg
before insert or update of recipient_role, recipient_email, status
on public.tgd_customer_request_email_queue
for each row
when (new.status = 'PENDING')
execute function public.tgd_skip_admin_request_email_queue();

update public.tgd_customer_request_email_queue
set
  status = 'SKIPPED',
  error_log = coalesce(error_log, 'Skipped: role admin no longer receives request emails.'),
  sent_at = coalesce(sent_at, now())
where status = 'PENDING'
  and (lower(btrim(coalesce(recipient_role, ''))) = 'admin' or public.tgd_is_admin_email(recipient_email));

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

notify pgrst, 'reload schema';

commit;
