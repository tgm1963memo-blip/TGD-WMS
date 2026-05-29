create table if not exists tgd_withdrawal_requests (
  id uuid primary key default gen_random_uuid(),
  withdrawal_no text not null unique,
  customer_id uuid not null references tgd_customers(id),
  warehouse_id uuid not null references tgd_warehouses(id),
  withdrawal_type text not null default 'NORMAL',
  status text not null default 'DRAFT',
  request_source text,
  request_reference_no text,
  request_reference_id uuid,
  request_date date,
  requested_dispatch_date date,
  requested_by_name text,
  requested_by_phone text,
  delivery_to_name text,
  delivery_to_phone text,
  delivery_to_address text,
  route_code text,
  priority text default 'NORMAL',
  confirmed_at timestamptz,
  confirmed_by uuid references tgd_user_profiles(id),
  cancelled_at timestamptz,
  cancelled_by uuid references tgd_user_profiles(id),
  cancel_reason text,
  remark text,
  created_by uuid references tgd_user_profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tgd_withdrawal_requests_status_check check (
    status in (
      'DRAFT',
      'CONFIRMED',
      'ALLOCATED',
      'PARTIALLY_ALLOCATED',
      'PICKING',
      'PICKED',
      'DISPATCHED',
      'CANCELLED',
      'CLOSED'
    )
  ),
  constraint tgd_withdrawal_requests_type_check check (
    withdrawal_type in (
      'NORMAL',
      'CUSTOMER_PICKUP',
      'DELIVERY',
      'RETURN_TO_CUSTOMER',
      'SAMPLE',
      'DAMAGE_DISPOSAL',
      'OTHER'
    )
  ),
  constraint tgd_withdrawal_requests_priority_check check (
    priority in ('LOW', 'NORMAL', 'HIGH', 'URGENT')
  )
);

create table if not exists tgd_withdrawal_request_lines (
  id uuid primary key default gen_random_uuid(),
  withdrawal_request_id uuid not null references tgd_withdrawal_requests(id) on delete cascade,
  line_no integer not null,
  product_id uuid not null references tgd_products(id),
  lot_id uuid references tgd_lots(id),
  requested_lot_no text,
  requested_exp_date date,
  requested_qty numeric not null default 0,
  allocated_qty numeric not null default 0,
  picked_qty numeric not null default 0,
  dispatched_qty numeric not null default 0,
  uom text not null,
  customer_note text,
  warehouse_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tgd_withdrawal_request_lines_document_line_unique unique (withdrawal_request_id, line_no),
  constraint tgd_withdrawal_request_lines_requested_qty_nonnegative check (requested_qty >= 0),
  constraint tgd_withdrawal_request_lines_allocated_qty_nonnegative check (allocated_qty >= 0),
  constraint tgd_withdrawal_request_lines_picked_qty_nonnegative check (picked_qty >= 0),
  constraint tgd_withdrawal_request_lines_dispatched_qty_nonnegative check (dispatched_qty >= 0),
  constraint tgd_withdrawal_request_lines_allocated_lte_requested check (allocated_qty <= requested_qty),
  constraint tgd_withdrawal_request_lines_picked_lte_allocated check (picked_qty <= allocated_qty),
  constraint tgd_withdrawal_request_lines_dispatched_lte_picked check (dispatched_qty <= picked_qty)
);

create index if not exists tgd_withdrawal_requests_withdrawal_no_idx
  on tgd_withdrawal_requests (withdrawal_no);
create index if not exists tgd_withdrawal_requests_customer_id_idx
  on tgd_withdrawal_requests (customer_id);
create index if not exists tgd_withdrawal_requests_warehouse_id_idx
  on tgd_withdrawal_requests (warehouse_id);
create index if not exists tgd_withdrawal_requests_status_idx
  on tgd_withdrawal_requests (status);
create index if not exists tgd_withdrawal_requests_withdrawal_type_idx
  on tgd_withdrawal_requests (withdrawal_type);
create index if not exists tgd_withdrawal_requests_source_idx
  on tgd_withdrawal_requests (request_source, request_reference_no);
create index if not exists tgd_withdrawal_requests_requested_dispatch_date_idx
  on tgd_withdrawal_requests (requested_dispatch_date);
create index if not exists tgd_withdrawal_requests_route_code_idx
  on tgd_withdrawal_requests (route_code);

create index if not exists tgd_withdrawal_request_lines_request_id_idx
  on tgd_withdrawal_request_lines (withdrawal_request_id);
create index if not exists tgd_withdrawal_request_lines_product_id_idx
  on tgd_withdrawal_request_lines (product_id);
create index if not exists tgd_withdrawal_request_lines_lot_id_idx
  on tgd_withdrawal_request_lines (lot_id);
create index if not exists tgd_withdrawal_request_lines_requested_lot_no_idx
  on tgd_withdrawal_request_lines (requested_lot_no);

drop trigger if exists set_tgd_withdrawal_requests_updated_at on tgd_withdrawal_requests;
create trigger set_tgd_withdrawal_requests_updated_at
before update on tgd_withdrawal_requests
for each row execute function set_updated_at();

drop trigger if exists set_tgd_withdrawal_request_lines_updated_at on tgd_withdrawal_request_lines;
create trigger set_tgd_withdrawal_request_lines_updated_at
before update on tgd_withdrawal_request_lines
for each row execute function set_updated_at();

create or replace function tgd_confirm_withdrawal_request(
  p_withdrawal_request_id uuid,
  p_confirmed_by uuid default null
)
returns table (confirmed_withdrawal_request_id uuid, confirmed_withdrawal_no text)
language plpgsql
as $$
declare
  v_request tgd_withdrawal_requests%rowtype;
  v_line_count integer;
  v_audit_log_id uuid;
begin
  select *
  into v_request
  from tgd_withdrawal_requests
  where id = p_withdrawal_request_id
  for update;

  if v_request.id is null then
    raise exception 'withdrawal request not found';
  end if;

  if v_request.status <> 'DRAFT' then
    raise exception 'withdrawal request status % cannot be confirmed', v_request.status;
  end if;

  select count(*)
  into v_line_count
  from tgd_withdrawal_request_lines
  where withdrawal_request_id = v_request.id;

  if v_line_count = 0 then
    raise exception 'withdrawal request has no lines';
  end if;

  if exists (
    select 1
    from tgd_withdrawal_request_lines
    where withdrawal_request_id = v_request.id
      and requested_qty <= 0
  ) then
    raise exception 'all withdrawal request lines must have requested_qty greater than zero';
  end if;

  update tgd_withdrawal_requests
  set status = 'CONFIRMED',
      confirmed_at = now(),
      confirmed_by = p_confirmed_by
  where id = v_request.id;

  select tgd_write_audit_log(
    jsonb_build_object(
      'entity_type', 'tgd_withdrawal_requests',
      'entity_id', v_request.id,
      'action', 'CONFIRM',
      'old_value', jsonb_build_object('status', v_request.status),
      'new_value', jsonb_build_object('status', 'CONFIRMED'),
      'metadata', jsonb_build_object(
        'withdrawal_no', v_request.withdrawal_no,
        'line_count', v_line_count,
        'withdrawal_type', v_request.withdrawal_type,
        'priority', v_request.priority
      ),
      'performed_by', p_confirmed_by,
      'request_id', v_request.withdrawal_no
    )
  ) into v_audit_log_id;

  confirmed_withdrawal_request_id := v_request.id;
  confirmed_withdrawal_no := v_request.withdrawal_no;
  return next;
end;
$$;

