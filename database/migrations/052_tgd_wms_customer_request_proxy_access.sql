-- 052_tgd_wms_customer_request_proxy_access.sql
-- Admin and warehouse roles may view all customer deposit/withdrawal requests
-- and create or submit them on behalf of customers.

begin;

create or replace function public.tgd_is_customer_request_proxy_role(p_role text)
returns boolean
language sql
immutable
as $$
  select lower(coalesce(p_role, '')) in (
    'admin', 'warehouse_admin', 'warehouse_manager', 'warehouse_staff'
  );
$$;

create or replace function public.tgd_assert_customer_request_actor(
  p_role text,
  p_customer_id uuid
)
returns void
language plpgsql
as $$
begin
  if p_role in ('customer_admin', 'customer_user') then
    if p_customer_id is null then
      raise exception 'Customer profile must be linked to a customer_id';
    end if;
  elsif not public.tgd_is_customer_request_proxy_role(p_role) then
    raise exception 'Unauthorized role for customer request action';
  end if;
end;
$$;

create or replace function public.tgd_assert_customer_request_document_scope(
  p_role text,
  p_actor_customer_id uuid,
  p_document_customer_id uuid
)
returns void
language plpgsql
as $$
begin
  if p_role in ('customer_admin', 'customer_user') then
    if p_actor_customer_id is null or p_actor_customer_id <> p_document_customer_id then
      raise exception 'Customer scope violation';
    end if;
  elsif not public.tgd_is_customer_request_proxy_role(p_role) then
    raise exception 'Unauthorized role for customer request action';
  end if;
end;
$$;

create or replace function public.tgd_resolve_customer_request_target_id(
  p_role text,
  p_actor_customer_id uuid,
  p_customer_id uuid
)
returns uuid
language plpgsql
as $$
begin
  if p_role in ('customer_admin', 'customer_user') then
    return p_actor_customer_id;
  elsif public.tgd_is_customer_request_proxy_role(p_role) then
    if p_customer_id is null then
      raise exception 'customer_id required when creating on behalf of a customer';
    end if;
    if not exists (
      select 1 from public.tgd_customers c
      where c.id = p_customer_id and c.is_active = true
    ) then
      raise exception 'Active customer not found';
    end if;
    return p_customer_id;
  else
    raise exception 'Unauthorized role for customer request action';
  end if;
end;
$$;

drop policy if exists rls_customer_deposit_requests_select on public.tgd_customer_deposit_requests;
create policy rls_customer_deposit_requests_select
on public.tgd_customer_deposit_requests
for select to authenticated
using (
  public.tgd_current_user_is_active()
  and (
    public.tgd_current_user_role() in (
      'admin', 'warehouse_admin', 'warehouse_manager', 'warehouse_staff', 'accounting', 'viewer'
    )
    or (
      public.tgd_current_user_role() in ('customer_admin', 'customer_user')
      and public.tgd_current_user_customer_id() = customer_id
    )
  )
);

drop policy if exists rls_customer_deposit_request_lines_select on public.tgd_customer_deposit_request_lines;
create policy rls_customer_deposit_request_lines_select
on public.tgd_customer_deposit_request_lines
for select to authenticated
using (
  exists (
    select 1 from public.tgd_customer_deposit_requests d
    where d.id = deposit_request_id
      and public.tgd_current_user_is_active()
      and (
        public.tgd_current_user_role() in (
          'admin', 'warehouse_admin', 'warehouse_manager', 'warehouse_staff', 'accounting', 'viewer'
        )
        or (
          public.tgd_current_user_role() in ('customer_admin', 'customer_user')
          and public.tgd_current_user_customer_id() = d.customer_id
        )
      )
  )
);

drop policy if exists rls_customer_withdrawal_requests_select on public.tgd_customer_withdrawal_requests;
create policy rls_customer_withdrawal_requests_select
on public.tgd_customer_withdrawal_requests
for select to authenticated
using (
  public.tgd_current_user_is_active()
  and (
    public.tgd_current_user_role() in (
      'admin', 'warehouse_admin', 'warehouse_manager', 'warehouse_staff', 'accounting', 'viewer'
    )
    or (
      public.tgd_current_user_role() in ('customer_admin', 'customer_user')
      and public.tgd_current_user_customer_id() = customer_id
    )
  )
);

drop policy if exists rls_customer_withdrawal_request_lines_select on public.tgd_customer_withdrawal_request_lines;
create policy rls_customer_withdrawal_request_lines_select
on public.tgd_customer_withdrawal_request_lines
for select to authenticated
using (
  exists (
    select 1 from public.tgd_customer_withdrawal_requests w
    where w.id = withdrawal_request_id
      and public.tgd_current_user_is_active()
      and (
        public.tgd_current_user_role() in (
          'admin', 'warehouse_admin', 'warehouse_manager', 'warehouse_staff', 'accounting', 'viewer'
        )
        or (
          public.tgd_current_user_role() in ('customer_admin', 'customer_user')
          and public.tgd_current_user_customer_id() = w.customer_id
        )
      )
  )
);

drop policy if exists rls_customer_document_attachments_select on public.tgd_customer_document_attachments;
create policy rls_customer_document_attachments_select
on public.tgd_customer_document_attachments
for select to authenticated
using (
  public.tgd_current_user_is_active()
  and (
    public.tgd_current_user_role() in (
      'admin', 'warehouse_admin', 'warehouse_manager', 'warehouse_staff', 'accounting'
    )
    or (
      public.tgd_current_user_role() in ('customer_admin', 'customer_user')
      and public.tgd_current_user_customer_id() = customer_id
    )
  )
);

drop policy if exists rls_customer_document_timeline_events_select on public.tgd_customer_document_timeline_events;
create policy rls_customer_document_timeline_events_select
on public.tgd_customer_document_timeline_events
for select to authenticated
using (
  public.tgd_current_user_is_active()
  and (
    public.tgd_current_user_role() in (
      'admin', 'warehouse_admin', 'warehouse_manager', 'warehouse_staff', 'accounting', 'viewer'
    )
    or (
      public.tgd_current_user_role() in ('customer_admin', 'customer_user')
      and public.tgd_current_user_customer_id() = customer_id
    )
  )
);

create or replace function public.tgd_create_customer_deposit_request(
  p_expected_arrival_date date,
  p_contact_name text,
  p_contact_phone text,
  p_note text default null,
  p_customer_id uuid default null
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
  where p.auth_user_id = v_auth_user_id
    and p.is_active = true
  limit 1;

  if not found then
    raise exception 'Active profile required';
  end if;

  v_target_customer_id := public.tgd_resolve_customer_request_target_id(
    v_profile.role, v_profile.customer_id, p_customer_id
  );

  perform pg_advisory_xact_lock(hashtext('cdr:' || v_target_customer_id::text || ':' || v_day));

  select coalesce(max(
    nullif(regexp_replace(d.request_no, '^CDR-' || v_day || '-', ''), '')::integer
  ), 0) + 1
  into v_seq
  from public.tgd_customer_deposit_requests d
  where d.request_no like 'CDR-' || v_day || '-%';

  v_request_no := format('CDR-%s-%s', v_day, lpad(v_seq::text, 4, '0'));

  insert into public.tgd_customer_deposit_requests (
    request_no, customer_id, status,
    expected_arrival_date, contact_name, contact_phone, note,
    created_by_user_id, created_by_email, created_by_display_name, created_by_role,
    last_action_by_user_id, last_action_by_email, last_action_at
  ) values (
    v_request_no, v_target_customer_id, 'DRAFT',
    p_expected_arrival_date, nullif(btrim(p_contact_name), ''), nullif(btrim(p_contact_phone), ''),
    nullif(btrim(p_note), ''),
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
    v_profile.id, v_profile.email, v_profile.role, v_profile.customer_id,
    null
  );

  return jsonb_build_object(
    'id', v_request_id,
    'request_no', v_request_no,
    'customer_id', v_target_customer_id,
    'status', 'DRAFT',
    'action', 'CREATE_DRAFT'
  );
end;
$$;

create or replace function public.tgd_create_customer_withdrawal_request(
  p_requested_dispatch_date date,
  p_delivery_type text,
  p_pickup_contact text,
  p_destination text,
  p_note text default null,
  p_customer_id uuid default null
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
  v_withdrawal_no text;
  v_request_id uuid;
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
    raise exception 'Active profile required';
  end if;

  v_target_customer_id := public.tgd_resolve_customer_request_target_id(
    v_profile.role, v_profile.customer_id, p_customer_id
  );

  perform pg_advisory_xact_lock(hashtext('cwr:' || v_target_customer_id::text || ':' || v_day));

  select coalesce(max(
    nullif(regexp_replace(w.withdrawal_no, '^CWR-' || v_day || '-', ''), '')::integer
  ), 0) + 1
  into v_seq
  from public.tgd_customer_withdrawal_requests w
  where w.withdrawal_no like 'CWR-' || v_day || '-%';

  v_withdrawal_no := format('CWR-%s-%s', v_day, lpad(v_seq::text, 4, '0'));

  insert into public.tgd_customer_withdrawal_requests (
    withdrawal_no, customer_id, status,
    requested_dispatch_date, delivery_type, pickup_contact, destination, note,
    created_by_user_id, created_by_email, created_by_display_name, created_by_role,
    last_action_by_user_id, last_action_by_email, last_action_at
  ) values (
    v_withdrawal_no, v_target_customer_id, 'WITHDRAWAL_DRAFT',
    p_requested_dispatch_date, nullif(btrim(p_delivery_type), ''),
    nullif(btrim(p_pickup_contact), ''), nullif(btrim(p_destination), ''),
    nullif(btrim(p_note), ''),
    v_profile.id, v_profile.email, null, v_profile.role,
    v_profile.id, v_profile.email, now()
  )
  returning id into v_request_id;

  insert into public.tgd_customer_document_timeline_events (
    document_type, document_id, customer_id, action, from_status, to_status,
    actor_user_id, actor_email, actor_role, actor_customer_id, comment
  ) values (
    'CUSTOMER_WITHDRAWAL_REQUEST', v_request_id, v_target_customer_id,
    'CREATE_DRAFT', null, 'WITHDRAWAL_DRAFT',
    v_profile.id, v_profile.email, v_profile.role, v_profile.customer_id,
    null
  );

  return jsonb_build_object(
    'id', v_request_id,
    'withdrawal_no', v_withdrawal_no,
    'customer_id', v_target_customer_id,
    'status', 'WITHDRAWAL_DRAFT',
    'action', 'CREATE_DRAFT'
  );
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
    raise exception 'Active profile required';
  end if;

  perform public.tgd_assert_customer_request_actor(v_profile.role, v_profile.customer_id);

  select d.id, d.customer_id, d.status
  into v_document
  from public.tgd_customer_deposit_requests d
  where d.id = p_request_id
  for update;

  if not found then
    raise exception 'Customer deposit request not found';
  end if;

  perform public.tgd_assert_customer_request_document_scope(
    v_profile.role, v_profile.customer_id, v_document.customer_id
  );

  if v_document.status <> 'DRAFT' then
    raise exception 'Deposit request must be DRAFT before submission';
  end if;

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

  return jsonb_build_object(
    'id', v_document.id,
    'customer_id', v_document.customer_id,
    'status', 'SUBMITTED_BY_CUSTOMER',
    'action', 'SUBMIT'
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
    raise exception 'Active profile required';
  end if;

  perform public.tgd_assert_customer_request_actor(v_profile.role, v_profile.customer_id);

  select w.id, w.customer_id, w.status
  into v_document
  from public.tgd_customer_withdrawal_requests w
  where w.id = p_request_id
  for update;

  if not found then
    raise exception 'Customer withdrawal request not found';
  end if;

  perform public.tgd_assert_customer_request_document_scope(
    v_profile.role, v_profile.customer_id, v_document.customer_id
  );

  if v_document.status <> 'WITHDRAWAL_DRAFT' then
    raise exception 'Withdrawal request must be WITHDRAWAL_DRAFT before submission';
  end if;

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

  return jsonb_build_object(
    'id', v_document.id,
    'customer_id', v_document.customer_id,
    'status', 'SUBMITTED_BY_CUSTOMER',
    'action', 'SUBMIT'
  );
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
  p_expected_qty numeric default null,
  p_expected_boxes numeric default null,
  p_expected_weight numeric default null,
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
    raise exception 'Active profile required';
  end if;

  perform public.tgd_assert_customer_request_actor(v_profile.role, v_profile.customer_id);

  select d.id, d.customer_id, d.status
  into v_document
  from public.tgd_customer_deposit_requests d
  where d.id = p_request_id
  for update;

  if not found then
    raise exception 'Customer deposit request not found';
  end if;

  perform public.tgd_assert_customer_request_document_scope(
    v_profile.role, v_profile.customer_id, v_document.customer_id
  );

  if v_document.status <> 'DRAFT' then
    raise exception 'Deposit request must be DRAFT before line edit';
  end if;

  if p_line_id is not null then
    update public.tgd_customer_deposit_request_lines
    set line_no = coalesce(p_line_no, line_no),
        customer_product_code = nullif(btrim(p_customer_product_code), ''),
        internal_product_code = nullif(btrim(p_internal_product_code), ''),
        product_id = p_product_id,
        product_name = nullif(btrim(p_product_name), ''),
        lot_no = nullif(btrim(p_lot_no), ''),
        expected_qty = p_expected_qty,
        expected_boxes = p_expected_boxes,
        expected_weight = p_expected_weight,
        uom = nullif(btrim(p_uom), ''),
        temperature_type = nullif(btrim(p_temperature_type), ''),
        note = nullif(btrim(p_note), '')
    where id = p_line_id
      and deposit_request_id = v_document.id
    returning id, line_no into v_line_id, v_line_no;

    if not found then
      raise exception 'Deposit request line not found';
    end if;
    v_action := 'UPDATE_LINE';
  else
    if p_line_no is null then
      select coalesce(max(l.line_no), 0) + 1
      into v_line_no
      from public.tgd_customer_deposit_request_lines l
      where l.deposit_request_id = v_document.id;
    else
      v_line_no := p_line_no;
    end if;

    insert into public.tgd_customer_deposit_request_lines (
      deposit_request_id, line_no,
      customer_product_code, internal_product_code, product_id, product_name,
      lot_no, expected_qty, expected_boxes, expected_weight, uom, temperature_type, note
    ) values (
      v_document.id, v_line_no,
      nullif(btrim(p_customer_product_code), ''), nullif(btrim(p_internal_product_code), ''),
      p_product_id, nullif(btrim(p_product_name), ''),
      nullif(btrim(p_lot_no), ''), p_expected_qty, p_expected_boxes, p_expected_weight,
      nullif(btrim(p_uom), ''), nullif(btrim(p_temperature_type), ''), nullif(btrim(p_note), '')
    )
    returning id into v_line_id;
    v_action := 'INSERT_LINE';
  end if;

  insert into public.tgd_customer_document_timeline_events (
    document_type, document_id, customer_id, action, from_status, to_status,
    actor_user_id, actor_email, actor_role, actor_customer_id, comment, metadata_json
  ) values (
    'CUSTOMER_DEPOSIT_REQUEST', v_document.id, v_document.customer_id,
    v_action, v_document.status, v_document.status,
    v_profile.id, v_profile.email, v_profile.role, v_profile.customer_id,
    null,
    jsonb_build_object('line_id', v_line_id, 'line_no', v_line_no)
  );

  return jsonb_build_object(
    'id', v_document.id,
    'line_id', v_line_id,
    'line_no', v_line_no,
    'status', v_document.status,
    'action', v_action
  );
end;
$$;

create or replace function public.tgd_upsert_customer_withdrawal_request_line(
  p_request_id uuid,
  p_line_id uuid default null,
  p_line_no integer default null,
  p_source_customer_deposit_request_id uuid default null,
  p_source_lot_no text default null,
  p_customer_product_code text default null,
  p_internal_product_code text default null,
  p_product_id uuid default null,
  p_product_name text default null,
  p_requested_qty numeric default null,
  p_requested_boxes numeric default null,
  p_requested_weight numeric default null,
  p_uom text default null,
  p_picking_rule text default 'FEFO',
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
  v_picking_rule text := upper(nullif(btrim(p_picking_rule), ''));
  v_action text;
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
    raise exception 'Active profile required';
  end if;

  perform public.tgd_assert_customer_request_actor(v_profile.role, v_profile.customer_id);

  if v_picking_rule not in ('FEFO', 'SPECIFIC_DEPOSIT', 'SPECIFIC_LOT') then
    raise exception 'picking_rule must be FEFO, SPECIFIC_DEPOSIT, or SPECIFIC_LOT';
  end if;

  select w.id, w.customer_id, w.status
  into v_document
  from public.tgd_customer_withdrawal_requests w
  where w.id = p_request_id
  for update;

  if not found then
    raise exception 'Customer withdrawal request not found';
  end if;

  perform public.tgd_assert_customer_request_document_scope(
    v_profile.role, v_profile.customer_id, v_document.customer_id
  );

  if v_document.status <> 'WITHDRAWAL_DRAFT' then
    raise exception 'Withdrawal request must be WITHDRAWAL_DRAFT before line edit';
  end if;

  if p_line_id is not null then
    update public.tgd_customer_withdrawal_request_lines
    set line_no = coalesce(p_line_no, line_no),
        source_customer_deposit_request_id = p_source_customer_deposit_request_id,
        source_lot_no = nullif(btrim(p_source_lot_no), ''),
        customer_product_code = nullif(btrim(p_customer_product_code), ''),
        internal_product_code = nullif(btrim(p_internal_product_code), ''),
        product_id = p_product_id,
        product_name = nullif(btrim(p_product_name), ''),
        requested_qty = p_requested_qty,
        requested_boxes = p_requested_boxes,
        requested_weight = p_requested_weight,
        uom = nullif(btrim(p_uom), ''),
        picking_rule = v_picking_rule,
        note = nullif(btrim(p_note), '')
    where id = p_line_id
      and withdrawal_request_id = v_document.id
    returning id, line_no into v_line_id, v_line_no;

    if not found then
      raise exception 'Withdrawal request line not found';
    end if;
    v_action := 'UPDATE_LINE';
  else
    if p_line_no is null then
      select coalesce(max(l.line_no), 0) + 1
      into v_line_no
      from public.tgd_customer_withdrawal_request_lines l
      where l.withdrawal_request_id = v_document.id;
    else
      v_line_no := p_line_no;
    end if;

    insert into public.tgd_customer_withdrawal_request_lines (
      withdrawal_request_id, line_no,
      source_customer_deposit_request_id, source_lot_no,
      customer_product_code, internal_product_code, product_id, product_name,
      requested_qty, requested_boxes, requested_weight, uom, picking_rule, note
    ) values (
      v_document.id, v_line_no,
      p_source_customer_deposit_request_id, nullif(btrim(p_source_lot_no), ''),
      nullif(btrim(p_customer_product_code), ''), nullif(btrim(p_internal_product_code), ''),
      p_product_id, nullif(btrim(p_product_name), ''),
      p_requested_qty, p_requested_boxes, p_requested_weight,
      nullif(btrim(p_uom), ''), v_picking_rule, nullif(btrim(p_note), '')
    )
    returning id into v_line_id;
    v_action := 'INSERT_LINE';
  end if;

  insert into public.tgd_customer_document_timeline_events (
    document_type, document_id, customer_id, action, from_status, to_status,
    actor_user_id, actor_email, actor_role, actor_customer_id, comment, metadata_json
  ) values (
    'CUSTOMER_WITHDRAWAL_REQUEST', v_document.id, v_document.customer_id,
    v_action, v_document.status, v_document.status,
    v_profile.id, v_profile.email, v_profile.role, v_profile.customer_id,
    null,
    jsonb_build_object('line_id', v_line_id, 'line_no', v_line_no, 'picking_rule', v_picking_rule)
  );

  return jsonb_build_object(
    'id', v_document.id,
    'line_id', v_line_id,
    'line_no', v_line_no,
    'status', v_document.status,
    'action', v_action
  );
end;
$$;

grant execute on function public.tgd_create_customer_deposit_request(date, text, text, text, uuid) to authenticated;
grant execute on function public.tgd_create_customer_withdrawal_request(date, text, text, text, text, uuid) to authenticated;

comment on function public.tgd_is_customer_request_proxy_role(text) is
  'True for internal roles that may view/create customer deposit/withdrawal requests on behalf of customers.';
comment on function public.tgd_create_customer_deposit_request(date, text, text, text, uuid) is
  'Customer portal deposit draft create; proxy roles pass p_customer_id.';
comment on function public.tgd_create_customer_withdrawal_request(date, text, text, text, text, uuid) is
  'Customer portal withdrawal draft create; proxy roles pass p_customer_id.';

commit;
