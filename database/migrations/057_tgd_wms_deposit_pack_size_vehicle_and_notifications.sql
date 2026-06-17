-- 057_tgd_wms_deposit_pack_size_vehicle_and_notifications.sql
-- Deposit pack-size columns, vehicle registration, and email notification queue on submit.

begin;

alter table public.tgd_customer_deposit_requests
  add column if not exists vehicle_registration text;

alter table public.tgd_customer_deposit_request_lines
  add column if not exists weight_per_box numeric;

alter table public.tgd_customer_products
  add column if not exists pack_weight_kg numeric;

alter table public.tgd_customer_deposit_request_lines
  drop constraint if exists tgd_customer_deposit_request_lines_weight_per_box_nonnegative;
alter table public.tgd_customer_deposit_request_lines
  add constraint tgd_customer_deposit_request_lines_weight_per_box_nonnegative check (
    weight_per_box is null or weight_per_box >= 0
  );

alter table public.tgd_customer_products
  drop constraint if exists tgd_customer_products_pack_weight_kg_nonnegative;
alter table public.tgd_customer_products
  add constraint tgd_customer_products_pack_weight_kg_nonnegative check (
    pack_weight_kg is null or pack_weight_kg >= 0
  );

create table if not exists public.tgd_customer_request_email_queue (
  id uuid primary key default gen_random_uuid(),
  document_type text not null,
  document_id uuid not null,
  customer_id uuid references public.tgd_customers(id),
  document_no text,
  recipient_email text not null,
  recipient_role text,
  notification_kind text not null,
  subject text not null,
  body_preview text not null,
  status text not null default 'PENDING',
  created_at timestamptz not null default now(),
  constraint tgd_customer_request_email_queue_status_check check (
    status in ('PENDING', 'SENT', 'FAILED', 'SKIPPED')
  ),
  constraint tgd_customer_request_email_queue_kind_check check (
    notification_kind in ('CUSTOMER_CONFIRMATION', 'OPERATIONS_ALERT')
  )
);

create index if not exists tgd_customer_request_email_queue_document_idx
  on public.tgd_customer_request_email_queue (document_type, document_id);
create index if not exists tgd_customer_request_email_queue_status_idx
  on public.tgd_customer_request_email_queue (status);

alter table public.tgd_customer_request_email_queue enable row level security;

drop policy if exists rls_customer_request_email_queue_select on public.tgd_customer_request_email_queue;
create policy rls_customer_request_email_queue_select
on public.tgd_customer_request_email_queue
for select to authenticated
using (
  public.tgd_current_user_is_active()
  and public.tgd_current_user_role() in ('admin', 'accounting', 'warehouse_admin', 'warehouse_manager')
);

revoke insert, update, delete on public.tgd_customer_request_email_queue from anon, authenticated;

create or replace function public.tgd_enqueue_customer_request_notifications(
  p_document_type text,
  p_document_id uuid,
  p_customer_id uuid,
  p_document_no text,
  p_submitter_email text default null
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
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

  return v_count;
end;
$$;

revoke all on function public.tgd_enqueue_customer_request_notifications(text, uuid, uuid, text, text) from public;
grant execute on function public.tgd_enqueue_customer_request_notifications(text, uuid, uuid, text, text) to authenticated;

-- Extend create deposit RPC (proxy-aware signature from 052)
create or replace function public.tgd_create_customer_deposit_request(
  p_expected_arrival_date date,
  p_contact_name text,
  p_contact_phone text,
  p_note text default null,
  p_customer_id uuid default null,
  p_vehicle_registration text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_auth_user_id uuid := auth.uid();
  v_profile record;
  v_target_customer_id uuid;
  v_day text := to_char(timezone('utc', now()), 'YYYYMMDD');
  v_seq integer;
  v_request_no text;
  v_request_id uuid;
begin
  if v_auth_user_id is null or not public.tgd_current_user_is_active() then
    raise exception 'Active authenticated user required';
  end if;

  select p.id, p.email, p.role, p.customer_id
  into v_profile
  from public.tgd_user_profiles p
  where p.auth_user_id = v_auth_user_id and p.is_active = true
  limit 1;

  if not found then raise exception 'Active profile required'; end if;

  v_target_customer_id := public.tgd_resolve_customer_request_target_id(
    v_profile.role, v_profile.customer_id, p_customer_id
  );

  perform pg_advisory_xact_lock(hashtext('cdr:' || v_target_customer_id::text || ':' || v_day));

  select coalesce(max(nullif(regexp_replace(d.request_no, '^CDR-' || v_day || '-', ''), '')::integer), 0) + 1
  into v_seq
  from public.tgd_customer_deposit_requests d
  where d.request_no like 'CDR-' || v_day || '-%';

  v_request_no := format('CDR-%s-%s', v_day, lpad(v_seq::text, 4, '0'));

  insert into public.tgd_customer_deposit_requests (
    request_no, customer_id, status,
    expected_arrival_date, contact_name, contact_phone, note, vehicle_registration,
    created_by_user_id, created_by_email, created_by_display_name, created_by_role,
    last_action_by_user_id, last_action_by_email, last_action_at
  ) values (
    v_request_no, v_target_customer_id, 'DRAFT',
    p_expected_arrival_date, nullif(btrim(p_contact_name), ''), nullif(btrim(p_contact_phone), ''),
    nullif(btrim(p_note), ''), nullif(btrim(p_vehicle_registration), ''),
    v_profile.id, v_profile.email, null, v_profile.role,
    v_profile.id, v_profile.email, now()
  )
  returning id into v_request_id;

  insert into public.tgd_customer_document_timeline_events (
    document_type, document_id, customer_id, action, from_status, to_status,
    actor_user_id, actor_email, actor_role, actor_customer_id, comment
  ) values (
    'CUSTOMER_DEPOSIT_REQUEST', v_request_id, v_target_customer_id,
    'CREATE_DRAFT', null, 'DRAFT',
    v_profile.id, v_profile.email, v_profile.role, v_profile.customer_id, null
  );

  return jsonb_build_object(
    'id', v_request_id, 'request_no', v_request_no,
    'customer_id', v_target_customer_id, 'status', 'DRAFT', 'action', 'CREATE_DRAFT'
  );
end;
$$;

create or replace function public.tgd_update_customer_deposit_request_draft(
  p_request_id uuid,
  p_expected_arrival_date date,
  p_contact_name text,
  p_contact_phone text,
  p_note text default null,
  p_vehicle_registration text default null
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
begin
  if v_auth_user_id is null or not public.tgd_current_user_is_active() then
    raise exception 'Active authenticated user required';
  end if;

  select p.id, p.email, p.role, p.customer_id into v_profile
  from public.tgd_user_profiles p
  where p.auth_user_id = v_auth_user_id and p.is_active = true limit 1;
  if not found then raise exception 'Active profile required'; end if;
  perform public.tgd_assert_customer_request_actor(v_profile.role, v_profile.customer_id);

  select d.id, d.customer_id, d.status into v_document
  from public.tgd_customer_deposit_requests d where d.id = p_request_id for update;
  if not found then raise exception 'Customer deposit request not found'; end if;
  perform public.tgd_assert_customer_request_document_scope(v_profile.role, v_profile.customer_id, v_document.customer_id);
  if v_document.status <> 'DRAFT' then raise exception 'Deposit request must be DRAFT before update'; end if;

  update public.tgd_customer_deposit_requests
  set expected_arrival_date = p_expected_arrival_date,
      contact_name = nullif(btrim(p_contact_name), ''),
      contact_phone = nullif(btrim(p_contact_phone), ''),
      note = nullif(btrim(p_note), ''),
      vehicle_registration = nullif(btrim(p_vehicle_registration), ''),
      last_action_by_user_id = v_profile.id,
      last_action_by_email = v_profile.email,
      last_action_at = now()
  where id = v_document.id;

  return jsonb_build_object('id', v_document.id, 'status', v_document.status, 'action', 'UPDATE_DRAFT');
end;
$$;

create or replace function public.tgd_upsert_customer_deposit_request_line(
  p_request_id uuid,
  p_line_id uuid default null,
  p_line_no integer default null,
  p_customer_product_code text default null,
  p_internal_product_code text default null,
  p_product_id uuid default null,
  p_product_name text default null,
  p_lot_no text default null,
  p_mfg_date date default null,
  p_exp_date date default null,
  p_expected_qty numeric default null,
  p_expected_boxes numeric default null,
  p_expected_weight numeric default null,
  p_weight_per_box numeric default null,
  p_uom text default null,
  p_temperature_type text default null,
  p_note text default null
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
  v_line_id uuid;
  v_line_no integer;
  v_action text;
  v_temp text := nullif(btrim(p_temperature_type), '');
  v_catalog record;
begin
  if v_auth_user_id is null or not public.tgd_current_user_is_active() then
    raise exception 'Active authenticated user required';
  end if;

  select p.id, p.email, p.role, p.customer_id into v_profile
  from public.tgd_user_profiles p
  where p.auth_user_id = v_auth_user_id and p.is_active = true limit 1;
  if not found then raise exception 'Active profile required'; end if;
  perform public.tgd_assert_customer_request_actor(v_profile.role, v_profile.customer_id);

  select d.id, d.customer_id, d.status into v_document
  from public.tgd_customer_deposit_requests d where d.id = p_request_id for update;
  if not found then raise exception 'Customer deposit request not found'; end if;
  perform public.tgd_assert_customer_request_document_scope(v_profile.role, v_profile.customer_id, v_document.customer_id);
  if v_document.status <> 'DRAFT' then raise exception 'Deposit request must be DRAFT before line edit'; end if;

  if v_temp is null and nullif(btrim(p_customer_product_code), '') is not null then
    select cp.temperature_type into v_catalog
    from public.tgd_customer_products cp
    where cp.customer_id = v_document.customer_id
      and lower(cp.customer_product_code) = lower(btrim(p_customer_product_code))
      and cp.is_active = true
    limit 1;
    v_temp := v_catalog.temperature_type;
  end if;

  if p_line_id is not null then
    update public.tgd_customer_deposit_request_lines
    set line_no = coalesce(p_line_no, line_no),
        customer_product_code = nullif(btrim(p_customer_product_code), ''),
        internal_product_code = nullif(btrim(p_internal_product_code), ''),
        product_id = p_product_id,
        product_name = nullif(btrim(p_product_name), ''),
        lot_no = nullif(btrim(p_lot_no), ''),
        mfg_date = p_mfg_date,
        exp_date = p_exp_date,
        expected_qty = p_expected_qty,
        expected_boxes = p_expected_boxes,
        expected_weight = p_expected_weight,
        weight_per_box = p_weight_per_box,
        uom = nullif(btrim(p_uom), ''),
        temperature_type = v_temp,
        note = nullif(btrim(p_note), '')
    where id = p_line_id and deposit_request_id = v_document.id
    returning id, line_no into v_line_id, v_line_no;
    if not found then raise exception 'Deposit request line not found'; end if;
    v_action := 'UPDATE_LINE';
  else
    if p_line_no is null then
      select coalesce(max(l.line_no), 0) + 1 into v_line_no
      from public.tgd_customer_deposit_request_lines l where l.deposit_request_id = v_document.id;
    else
      v_line_no := p_line_no;
    end if;

    insert into public.tgd_customer_deposit_request_lines (
      deposit_request_id, line_no, customer_product_code, internal_product_code,
      product_id, product_name, lot_no, mfg_date, exp_date,
      expected_qty, expected_boxes, expected_weight, weight_per_box, uom, temperature_type, note
    ) values (
      v_document.id, v_line_no,
      nullif(btrim(p_customer_product_code), ''), nullif(btrim(p_internal_product_code), ''),
      p_product_id, nullif(btrim(p_product_name), ''),
      nullif(btrim(p_lot_no), ''), p_mfg_date, p_exp_date,
      p_expected_qty, p_expected_boxes, p_expected_weight, p_weight_per_box,
      nullif(btrim(p_uom), ''), v_temp, nullif(btrim(p_note), '')
    ) returning id into v_line_id;
    v_action := 'INSERT_LINE';
  end if;

  return jsonb_build_object('id', v_document.id, 'line_id', v_line_id, 'line_no', v_line_no, 'status', v_document.status, 'action', v_action);
end;
$$;

create or replace function public.tgd_submit_customer_deposit_request(
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

  perform public.tgd_enqueue_customer_request_notifications(
    'CUSTOMER_DEPOSIT_REQUEST', v_document.id, v_document.customer_id, v_request_no, v_profile.email
  );

  return jsonb_build_object(
    'id', v_document.id, 'customer_id', v_document.customer_id,
    'status', 'SUBMITTED_BY_CUSTOMER', 'action', 'SUBMIT'
  );
end;
$$;

create or replace function public.tgd_submit_customer_withdrawal_request(
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
  if v_document.status <> 'DRAFT' then raise exception 'Withdrawal request must be DRAFT before submission'; end if;

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

  perform public.tgd_enqueue_customer_request_notifications(
    'CUSTOMER_WITHDRAWAL_REQUEST', v_document.id, v_document.customer_id, v_withdrawal_no, v_profile.email
  );

  return jsonb_build_object(
    'id', v_document.id, 'customer_id', v_document.customer_id,
    'status', 'SUBMITTED_BY_CUSTOMER', 'action', 'SUBMIT'
  );
end;
$$;

commit;
