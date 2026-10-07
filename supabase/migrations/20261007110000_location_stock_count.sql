-- Stock count from the handheld scan center, walked row by row (location).
--
-- Counts against the stock the app actually tracks: pallet allocations
-- (tgd_customer_deposit_line_locations) minus their effective picks
-- (tgd_deposit_line_location_picked), in boxes + kg. The Sprint 4E
-- tgd_stock_count_* prototype (database/migrations/016) compares against
-- tgd_stock_balances and is not used; it is left untouched.
--
-- A count never changes stock. Differences are a report for an admin to
-- review and fix through the existing inventory pallet editor.

begin;

create table if not exists public.tgd_location_count_sessions (
  id uuid primary key default gen_random_uuid(),
  count_no text not null unique,
  status text not null default 'OPEN',
  started_by_profile_id uuid references public.tgd_user_profiles(id),
  started_by_email text,
  started_at timestamptz not null default now(),
  submitted_by_profile_id uuid references public.tgd_user_profiles(id),
  submitted_at timestamptz,
  reviewed_by_profile_id uuid references public.tgd_user_profiles(id),
  reviewed_at timestamptz,
  review_note text,
  created_at timestamptz not null default now(),
  constraint tgd_location_count_sessions_status_check
    check (status in ('OPEN', 'SUBMITTED', 'REVIEWED', 'CANCELLED'))
);

create table if not exists public.tgd_location_count_lines (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.tgd_location_count_sessions(id) on delete cascade,
  location_id uuid not null references public.tgd_locations(id),
  location_code text,
  allocation_id uuid references public.tgd_customer_deposit_line_locations(id) on delete set null,
  deposit_line_id uuid references public.tgd_customer_deposit_request_lines(id) on delete set null,
  customer_id uuid references public.tgd_customers(id),
  pallet_no integer,
  tracking_code text,
  customer_product_code text,
  product_name text,
  lot_no text,
  expected_boxes numeric,
  expected_weight numeric,
  counted_boxes numeric,
  counted_weight numeric,
  result text not null,
  note text,
  counted_by_profile_id uuid references public.tgd_user_profiles(id),
  counted_by_email text,
  counted_at timestamptz not null default now(),
  constraint tgd_location_count_lines_result_check
    check (result in ('MATCH', 'SHORT', 'OVER', 'MISSING', 'UNEXPECTED'))
);

create index if not exists tgd_location_count_lines_session_location_idx
  on public.tgd_location_count_lines (session_id, location_id);
create index if not exists tgd_location_count_sessions_status_idx
  on public.tgd_location_count_sessions (status, started_at desc);

alter table public.tgd_location_count_sessions enable row level security;
alter table public.tgd_location_count_lines enable row level security;

-- Read: warehouse/admin roles. Lines respect a customer-scoped staff role.
-- All writes go through the SECURITY DEFINER functions below.
drop policy if exists rls_location_count_sessions_select on public.tgd_location_count_sessions;
create policy rls_location_count_sessions_select
on public.tgd_location_count_sessions for select to authenticated
using (
  public.tgd_current_user_is_active()
  and public.tgd_current_user_role() in ('admin', 'warehouse_admin', 'warehouse_manager', 'warehouse_staff', 'accounting')
);

drop policy if exists rls_location_count_lines_select on public.tgd_location_count_lines;
create policy rls_location_count_lines_select
on public.tgd_location_count_lines for select to authenticated
using (
  public.tgd_current_user_is_active()
  and public.tgd_current_user_role() in ('admin', 'warehouse_admin', 'warehouse_manager', 'warehouse_staff', 'accounting')
  and (
    public.tgd_current_user_role_customer_scope() is null
    or customer_id is null
    or public.tgd_current_user_role_customer_scope() = customer_id
  )
);

grant select on public.tgd_location_count_sessions to authenticated;
grant select on public.tgd_location_count_lines to authenticated;

create or replace function public.tgd_location_count_assert_staff()
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is null or not public.tgd_current_user_is_active()
    or public.tgd_current_user_role() not in ('admin', 'warehouse_admin', 'warehouse_manager', 'warehouse_staff') then
    raise exception 'ไม่มีสิทธิ์นับสต็อก';
  end if;
end;
$$;

-- Pallets that should be on a location right now (only ones still holding
-- stock). Pallets usually record boxes only, so kg falls back to the lot's
-- kg per box.
create or replace function public.tgd_get_location_count_expected(p_location_id uuid)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_scope uuid;
  v_result jsonb;
begin
  perform public.tgd_location_count_assert_staff();
  v_scope := public.tgd_current_user_role_customer_scope();

  with pallets as (
    select
      a.id as allocation_id,
      a.line_id as deposit_line_id,
      dr.customer_id,
      coalesce(c.customer_name, c.name, c.customer_code) as customer_name,
      a.pallet_no,
      dl.tracking_code,
      dl.customer_product_code,
      dl.product_name,
      dl.lot_no,
      dl.exp_date,
      case when a.boxes is not null then greatest(a.boxes - coalesce(p.picked_boxes, 0), 0) end as remaining_boxes,
      case when a.weight is not null then greatest(a.weight - coalesce(p.picked_weight, 0), 0) end as remaining_weight,
      case
        when coalesce(dl.actual_boxes, dl.expected_boxes, 0) > 0
          then coalesce(dl.actual_weight, dl.expected_weight, 0) / coalesce(dl.actual_boxes, dl.expected_boxes)
        else dl.weight_per_box
      end as kg_per_box
    from public.tgd_customer_deposit_line_locations a
    join public.tgd_customer_deposit_request_lines dl on dl.id = a.line_id
    join public.tgd_customer_deposit_requests dr on dr.id = dl.deposit_request_id
    left join public.tgd_customers c on c.id = dr.customer_id
    left join public.tgd_deposit_line_location_picked p on p.allocation_id = a.id
    where a.location_id = p_location_id
      and dr.status in ('RECEIVED_CONFIRMED', 'CUSTOMER_NOTIFIED')
      and (v_scope is null or dr.customer_id = v_scope)
  )
  select coalesce(jsonb_agg(jsonb_build_object(
      'allocation_id', allocation_id,
      'deposit_line_id', deposit_line_id,
      'customer_id', customer_id,
      'customer_name', customer_name,
      'pallet_no', pallet_no,
      'tracking_code', tracking_code,
      'customer_product_code', customer_product_code,
      'product_name', product_name,
      'lot_no', lot_no,
      'exp_date', exp_date,
      'kg_per_box', round(coalesce(kg_per_box, 0)::numeric, 4),
      'expected_boxes', remaining_boxes,
      'expected_weight', round(coalesce(remaining_weight, coalesce(remaining_boxes, 0) * coalesce(kg_per_box, 0))::numeric, 2)
    ) order by pallet_no, tracking_code), '[]'::jsonb)
  into v_result
  from pallets
  where (remaining_boxes is not null and remaining_boxes > 0)
     or (remaining_boxes is null and coalesce(remaining_weight, 1) > 0);

  return v_result;
end;
$$;

create or replace function public.tgd_start_location_count(p_actor_profile_id uuid default null)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_session public.tgd_location_count_sessions;
  v_prefix text;
  v_seq integer;
  v_email text;
begin
  perform public.tgd_location_count_assert_staff();
  perform pg_advisory_xact_lock(hashtext('tgd_location_count_sessions'));

  select * into v_session from public.tgd_location_count_sessions
    where status = 'OPEN' order by started_at desc limit 1;
  if found then return to_jsonb(v_session); end if;

  v_prefix := 'CNT-' || to_char(now() at time zone 'Asia/Bangkok', 'YYYYMMDD') || '-';
  select coalesce(max(substring(count_no from length(v_prefix) + 1)::integer), 0) + 1 into v_seq
    from public.tgd_location_count_sessions where count_no like v_prefix || '%';
  select email into v_email from public.tgd_user_profiles where id = p_actor_profile_id;

  insert into public.tgd_location_count_sessions (count_no, started_by_profile_id, started_by_email)
  values (v_prefix || lpad(v_seq::text, 4, '0'), p_actor_profile_id, coalesce(v_email, auth.jwt() ->> 'email'))
  returning * into v_session;

  return to_jsonb(v_session);
end;
$$;

-- Saves one location's count. p_results: [{ allocation_id?, counted_boxes,
-- counted_weight, note?, tracking_code?, product_name?, customer_product_code?,
-- lot_no? }]. Rows with an allocation_id are matched to the pallets expected
-- right now (re-read here, not trusted from the client); rows without one
-- are pallets found that the system doesn't know about. Expected pallets the
-- client didn't send are recorded as MISSING. Re-saving a location replaces
-- its previous result in the session.
create or replace function public.tgd_record_location_count_row(
  p_session_id uuid, p_location_id uuid, p_results jsonb, p_actor_profile_id uuid default null
) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_status text;
  v_location_code text;
  v_expected jsonb;
  v_email text;
  v_scope uuid;
  v_count integer;
begin
  perform public.tgd_location_count_assert_staff();
  v_scope := public.tgd_current_user_role_customer_scope();

  select status into v_status from public.tgd_location_count_sessions where id = p_session_id for update;
  if not found then raise exception 'ไม่พบรอบนับ'; end if;
  if v_status <> 'OPEN' then raise exception 'รอบนับนี้ปิดแล้ว'; end if;

  select coalesce(code, location_code) into v_location_code from public.tgd_locations where id = p_location_id;
  if not found then raise exception 'ไม่พบ Location'; end if;
  if jsonb_typeof(coalesce(p_results, '[]'::jsonb)) <> 'array' then raise exception 'ข้อมูลการนับไม่ถูกต้อง'; end if;
  if exists (
    select 1 from jsonb_array_elements(coalesce(p_results, '[]'::jsonb)) r
    where coalesce((r ->> 'counted_boxes')::numeric, 0) < 0 or coalesce((r ->> 'counted_weight')::numeric, 0) < 0
  ) then raise exception 'จำนวนที่นับต้องไม่ติดลบ'; end if;

  v_expected := public.tgd_get_location_count_expected(p_location_id);
  select email into v_email from public.tgd_user_profiles where id = p_actor_profile_id;
  v_email := coalesce(v_email, auth.jwt() ->> 'email');

  -- A customer-scoped counter only replaces lines of their own customer.
  delete from public.tgd_location_count_lines
    where session_id = p_session_id and location_id = p_location_id
      and (v_scope is null or customer_id = v_scope or customer_id is null);

  insert into public.tgd_location_count_lines (
    session_id, location_id, location_code, allocation_id, deposit_line_id, customer_id, pallet_no,
    tracking_code, customer_product_code, product_name, lot_no,
    expected_boxes, expected_weight, counted_boxes, counted_weight, result, note,
    counted_by_profile_id, counted_by_email
  )
  select
    p_session_id, p_location_id, v_location_code,
    (e ->> 'allocation_id')::uuid, (e ->> 'deposit_line_id')::uuid, (e ->> 'customer_id')::uuid,
    (e ->> 'pallet_no')::integer, e ->> 'tracking_code', e ->> 'customer_product_code',
    e ->> 'product_name', e ->> 'lot_no',
    (e ->> 'expected_boxes')::numeric, (e ->> 'expected_weight')::numeric,
    coalesce((r ->> 'counted_boxes')::numeric, 0),
    coalesce((r ->> 'counted_weight')::numeric, 0),
    case
      when r is null or coalesce((r ->> 'counted_boxes')::numeric, 0) = 0 and coalesce((r ->> 'counted_weight')::numeric, 0) = 0 then 'MISSING'
      when (e ->> 'expected_boxes') is not null and (r ->> 'counted_boxes')::numeric < (e ->> 'expected_boxes')::numeric then 'SHORT'
      when (e ->> 'expected_boxes') is not null and (r ->> 'counted_boxes')::numeric > (e ->> 'expected_boxes')::numeric then 'OVER'
      when (e ->> 'expected_boxes') is null and coalesce((r ->> 'counted_weight')::numeric, 0) < (e ->> 'expected_weight')::numeric - 0.01 then 'SHORT'
      when (e ->> 'expected_boxes') is null and coalesce((r ->> 'counted_weight')::numeric, 0) > (e ->> 'expected_weight')::numeric + 0.01 then 'OVER'
      else 'MATCH'
    end,
    nullif(trim(r ->> 'note'), ''),
    p_actor_profile_id, v_email
  from jsonb_array_elements(v_expected) e
  left join lateral (
    select x as r from jsonb_array_elements(coalesce(p_results, '[]'::jsonb)) x
    where x ->> 'allocation_id' = e ->> 'allocation_id' limit 1
  ) rr on true;

  -- Pallets found on the location that the system doesn't expect there.
  insert into public.tgd_location_count_lines (
    session_id, location_id, location_code, deposit_line_id, customer_id,
    tracking_code, customer_product_code, product_name, lot_no,
    expected_boxes, expected_weight, counted_boxes, counted_weight, result, note,
    counted_by_profile_id, counted_by_email
  )
  select
    p_session_id, p_location_id, v_location_code, dl.id, dr.customer_id,
    coalesce(dl.tracking_code, nullif(trim(r ->> 'tracking_code'), '')),
    coalesce(dl.customer_product_code, nullif(trim(r ->> 'customer_product_code'), '')),
    coalesce(dl.product_name, nullif(trim(r ->> 'product_name'), '')),
    coalesce(dl.lot_no, nullif(trim(r ->> 'lot_no'), '')),
    0, 0,
    coalesce((r ->> 'counted_boxes')::numeric, 0),
    coalesce((r ->> 'counted_weight')::numeric, 0),
    'UNEXPECTED',
    nullif(trim(r ->> 'note'), ''),
    p_actor_profile_id, v_email
  from jsonb_array_elements(coalesce(p_results, '[]'::jsonb)) r
  left join public.tgd_customer_deposit_request_lines dl
    on nullif(trim(r ->> 'tracking_code'), '') is not null and dl.tracking_code = trim(r ->> 'tracking_code')
  left join public.tgd_customer_deposit_requests dr on dr.id = dl.deposit_request_id
  where nullif(r ->> 'allocation_id', '') is null
    and (coalesce((r ->> 'counted_boxes')::numeric, 0) > 0 or coalesce((r ->> 'counted_weight')::numeric, 0) > 0)
    and (v_scope is null or dr.customer_id is null or dr.customer_id = v_scope);

  select count(*) into v_count from public.tgd_location_count_lines
    where session_id = p_session_id and location_id = p_location_id;
  return jsonb_build_object('session_id', p_session_id, 'location_id', p_location_id, 'lines', v_count);
end;
$$;

create or replace function public.tgd_set_location_count_status(
  p_session_id uuid, p_status text, p_actor_profile_id uuid default null, p_note text default null
) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_session public.tgd_location_count_sessions;
begin
  perform public.tgd_location_count_assert_staff();
  select * into v_session from public.tgd_location_count_sessions where id = p_session_id for update;
  if not found then raise exception 'ไม่พบรอบนับ'; end if;

  if p_status = 'SUBMITTED' and v_session.status = 'OPEN' then
    update public.tgd_location_count_sessions
      set status = 'SUBMITTED', submitted_at = now(), submitted_by_profile_id = p_actor_profile_id
      where id = p_session_id returning * into v_session;
  elsif p_status = 'CANCELLED' and v_session.status = 'OPEN' then
    update public.tgd_location_count_sessions set status = 'CANCELLED'
      where id = p_session_id returning * into v_session;
  elsif p_status = 'REVIEWED' and v_session.status = 'SUBMITTED' then
    if public.tgd_current_user_role() not in ('admin', 'warehouse_admin', 'warehouse_manager') then
      raise exception 'เฉพาะแอดมิน/หัวหน้าคลังเท่านั้นที่ตรวจผลการนับได้';
    end if;
    update public.tgd_location_count_sessions
      set status = 'REVIEWED', reviewed_at = now(), review_note = nullif(trim(p_note), ''),
          reviewed_by_profile_id = coalesce(p_actor_profile_id,
            (select id from public.tgd_user_profiles where auth_user_id = auth.uid() limit 1))
      where id = p_session_id returning * into v_session;
  else
    raise exception 'เปลี่ยนสถานะรอบนับจาก % เป็น % ไม่ได้', v_session.status, p_status;
  end if;

  return to_jsonb(v_session);
end;
$$;

revoke all on function public.tgd_location_count_assert_staff() from public, anon;
revoke all on function public.tgd_get_location_count_expected(uuid) from public, anon;
revoke all on function public.tgd_start_location_count(uuid) from public, anon;
revoke all on function public.tgd_record_location_count_row(uuid, uuid, jsonb, uuid) from public, anon;
revoke all on function public.tgd_set_location_count_status(uuid, text, uuid, text) from public, anon;
grant execute on function public.tgd_location_count_assert_staff() to authenticated;
grant execute on function public.tgd_get_location_count_expected(uuid) to authenticated;
grant execute on function public.tgd_start_location_count(uuid) to authenticated;
grant execute on function public.tgd_record_location_count_row(uuid, uuid, jsonb, uuid) to authenticated;
grant execute on function public.tgd_set_location_count_status(uuid, text, uuid, text) to authenticated;

-- Packaging photos on the customer product master (document_id =
-- tgd_customer_products.id), shown to the counter so they know what the
-- box looks like.
alter table public.tgd_customer_document_attachments
  drop constraint if exists tgd_customer_document_attachments_document_type_check;
alter table public.tgd_customer_document_attachments
  add constraint tgd_customer_document_attachments_document_type_check check (
    document_type in (
      'CUSTOMER_DEPOSIT_REQUEST',
      'CUSTOMER_WITHDRAWAL_REQUEST',
      'CUSTOMER_DEPOSIT_RECEIVING_PHOTO',
      'CUSTOMER_PRODUCT_PACKAGING_PHOTO'
    )
  );

drop policy if exists rls_customer_document_attachments_update_receiving_photo
  on public.tgd_customer_document_attachments;
create policy rls_customer_document_attachments_update_receiving_photo
on public.tgd_customer_document_attachments
for update
to authenticated
using (
  document_type in ('CUSTOMER_DEPOSIT_RECEIVING_PHOTO', 'CUSTOMER_PRODUCT_PACKAGING_PHOTO')
  and public.tgd_current_user_is_active()
  and public.tgd_current_user_role() in (
    'admin', 'warehouse_admin', 'warehouse_manager', 'warehouse_staff'
  )
  and (
    public.tgd_current_user_role_customer_scope() is null
    or public.tgd_current_user_role_customer_scope() = customer_id
  )
)
with check (
  document_type in ('CUSTOMER_DEPOSIT_RECEIVING_PHOTO', 'CUSTOMER_PRODUCT_PACKAGING_PHOTO')
  and public.tgd_current_user_is_active()
  and public.tgd_current_user_role() in (
    'admin', 'warehouse_admin', 'warehouse_manager', 'warehouse_staff'
  )
  and (
    public.tgd_current_user_role_customer_scope() is null
    or public.tgd_current_user_role_customer_scope() = customer_id
  )
);

notify pgrst, 'reload schema';
commit;
