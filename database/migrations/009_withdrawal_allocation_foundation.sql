create table if not exists tgd_withdrawal_allocations (
  id uuid primary key default gen_random_uuid(),
  allocation_no text not null unique,
  withdrawal_request_id uuid not null references tgd_withdrawal_requests(id),
  customer_id uuid not null references tgd_customers(id),
  warehouse_id uuid not null references tgd_warehouses(id),
  status text not null default 'DRAFT',
  allocation_method text not null default 'MANUAL',
  allocated_at timestamptz,
  allocated_by uuid references tgd_user_profiles(id),
  cancelled_at timestamptz,
  cancelled_by uuid references tgd_user_profiles(id),
  cancel_reason text,
  remark text,
  created_by uuid references tgd_user_profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tgd_withdrawal_allocations_status_check check (
    status in ('DRAFT', 'CONFIRMED', 'POSTED', 'CANCELLED', 'REVERSED')
  ),
  constraint tgd_withdrawal_allocations_method_check check (
    allocation_method in ('MANUAL', 'FIFO', 'FEFO', 'SYSTEM_SUGGESTED')
  )
);

create table if not exists tgd_withdrawal_allocation_lines (
  id uuid primary key default gen_random_uuid(),
  allocation_id uuid not null references tgd_withdrawal_allocations(id) on delete cascade,
  withdrawal_request_line_id uuid not null references tgd_withdrawal_request_lines(id),
  line_no integer not null,
  product_id uuid not null references tgd_products(id),
  lot_id uuid references tgd_lots(id),
  warehouse_id uuid not null references tgd_warehouses(id),
  location_id uuid not null references tgd_locations(id),
  pallet_id uuid references tgd_pallets(id),
  allocated_qty numeric not null default 0,
  uom text not null,
  allocation_rule text,
  movement_id uuid references tgd_inventory_movements(id),
  remark text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tgd_withdrawal_allocation_lines_document_line_unique unique (allocation_id, line_no),
  constraint tgd_withdrawal_allocation_lines_allocated_qty_nonnegative check (allocated_qty >= 0)
);

create index if not exists tgd_withdrawal_allocations_allocation_no_idx
  on tgd_withdrawal_allocations (allocation_no);
create index if not exists tgd_withdrawal_allocations_request_id_idx
  on tgd_withdrawal_allocations (withdrawal_request_id);
create index if not exists tgd_withdrawal_allocations_customer_id_idx
  on tgd_withdrawal_allocations (customer_id);
create index if not exists tgd_withdrawal_allocations_warehouse_id_idx
  on tgd_withdrawal_allocations (warehouse_id);
create index if not exists tgd_withdrawal_allocations_status_idx
  on tgd_withdrawal_allocations (status);
create index if not exists tgd_withdrawal_allocations_method_idx
  on tgd_withdrawal_allocations (allocation_method);

create index if not exists tgd_withdrawal_allocation_lines_allocation_id_idx
  on tgd_withdrawal_allocation_lines (allocation_id);
create index if not exists tgd_withdrawal_allocation_lines_request_line_id_idx
  on tgd_withdrawal_allocation_lines (withdrawal_request_line_id);
create index if not exists tgd_withdrawal_allocation_lines_product_id_idx
  on tgd_withdrawal_allocation_lines (product_id);
create index if not exists tgd_withdrawal_allocation_lines_lot_id_idx
  on tgd_withdrawal_allocation_lines (lot_id);
create index if not exists tgd_withdrawal_allocation_lines_location_id_idx
  on tgd_withdrawal_allocation_lines (location_id);
create index if not exists tgd_withdrawal_allocation_lines_pallet_id_idx
  on tgd_withdrawal_allocation_lines (pallet_id);
create index if not exists tgd_withdrawal_allocation_lines_movement_id_idx
  on tgd_withdrawal_allocation_lines (movement_id);

drop trigger if exists set_tgd_withdrawal_allocations_updated_at on tgd_withdrawal_allocations;
create trigger set_tgd_withdrawal_allocations_updated_at
before update on tgd_withdrawal_allocations
for each row execute function set_updated_at();

drop trigger if exists set_tgd_withdrawal_allocation_lines_updated_at on tgd_withdrawal_allocation_lines;
create trigger set_tgd_withdrawal_allocation_lines_updated_at
before update on tgd_withdrawal_allocation_lines
for each row execute function set_updated_at();

create or replace function tgd_post_withdrawal_allocation(
  p_allocation_id uuid,
  p_allocated_by uuid default null
)
returns table (posted_allocation_id uuid, posted_allocation_no text)
language plpgsql
as $$
declare
  v_allocation tgd_withdrawal_allocations%rowtype;
  v_request tgd_withdrawal_requests%rowtype;
  v_line tgd_withdrawal_allocation_lines%rowtype;
  v_line_count integer;
  v_movement_id uuid;
  v_total_requested numeric;
  v_total_allocated numeric;
  v_audit_log_id uuid;
begin
  select *
  into v_allocation
  from tgd_withdrawal_allocations
  where id = p_allocation_id
  for update;

  if v_allocation.id is null then
    raise exception 'withdrawal allocation not found';
  end if;

  if v_allocation.status in ('POSTED', 'CANCELLED', 'REVERSED') then
    raise exception 'withdrawal allocation status % cannot be posted', v_allocation.status;
  end if;

  select *
  into v_request
  from tgd_withdrawal_requests
  where id = v_allocation.withdrawal_request_id
  for update;

  if v_request.id is null then
    raise exception 'linked withdrawal request not found';
  end if;

  if v_request.status not in ('CONFIRMED', 'PARTIALLY_ALLOCATED') then
    raise exception 'withdrawal request status % cannot be allocated', v_request.status;
  end if;

  select count(*)
  into v_line_count
  from tgd_withdrawal_allocation_lines
  where allocation_id = v_allocation.id;

  if v_line_count = 0 then
    raise exception 'withdrawal allocation has no lines';
  end if;

  if exists (
    select 1
    from tgd_withdrawal_allocation_lines
    where allocation_id = v_allocation.id
      and allocated_qty <= 0
  ) then
    raise exception 'all withdrawal allocation lines must have allocated_qty greater than zero';
  end if;

  for v_line in
    select *
    from tgd_withdrawal_allocation_lines
    where allocation_id = v_allocation.id
    order by line_no
    for update
  loop
    select posted.movement_id
    into v_movement_id
    from tgd_post_inventory_movement(
      jsonb_build_object(
        'movement_type', 'PICK_ALLOCATE',
        'customer_id', v_allocation.customer_id,
        'product_id', v_line.product_id,
        'lot_id', v_line.lot_id,
        'from_warehouse_id', v_line.warehouse_id,
        'from_location_id', v_line.location_id,
        'from_pallet_id', v_line.pallet_id,
        'qty', v_line.allocated_qty,
        'uom', v_line.uom,
        'reference_type', 'WITHDRAWAL_ALLOCATION',
        'reference_no', v_allocation.allocation_no,
        'reference_id', v_allocation.id,
        'remark', v_line.remark,
        'created_by', p_allocated_by
      )
    ) as posted
    limit 1;

    update tgd_withdrawal_allocation_lines
    set movement_id = v_movement_id
    where id = v_line.id;
  end loop;

  update tgd_withdrawal_allocations
  set status = 'POSTED',
      allocated_at = now(),
      allocated_by = p_allocated_by
  where id = v_allocation.id;

  update tgd_withdrawal_request_lines request_line
  set allocated_qty = coalesce(posted_allocations.allocated_qty, 0)
  from (
    select
      allocation_line.withdrawal_request_line_id,
      sum(allocation_line.allocated_qty) as allocated_qty
    from tgd_withdrawal_allocation_lines allocation_line
    join tgd_withdrawal_allocations allocation
      on allocation.id = allocation_line.allocation_id
    where allocation.withdrawal_request_id = v_allocation.withdrawal_request_id
      and allocation.status = 'POSTED'
    group by allocation_line.withdrawal_request_line_id
  ) posted_allocations
  where request_line.id = posted_allocations.withdrawal_request_line_id
    and request_line.withdrawal_request_id = v_allocation.withdrawal_request_id;

  if exists (
    select 1
    from tgd_withdrawal_request_lines
    where withdrawal_request_id = v_allocation.withdrawal_request_id
      and allocated_qty > requested_qty
  ) then
    raise exception 'allocated quantity cannot exceed requested quantity';
  end if;

  select
    coalesce(sum(requested_qty), 0),
    coalesce(sum(allocated_qty), 0)
  into v_total_requested, v_total_allocated
  from tgd_withdrawal_request_lines
  where withdrawal_request_id = v_allocation.withdrawal_request_id;

  update tgd_withdrawal_requests
  set status = case
        when v_total_requested > 0 and v_total_allocated = v_total_requested then 'ALLOCATED'
        when v_total_allocated > 0 then 'PARTIALLY_ALLOCATED'
        else status
      end
  where id = v_allocation.withdrawal_request_id;

  select tgd_write_audit_log(
    jsonb_build_object(
      'entity_type', 'tgd_withdrawal_allocations',
      'entity_id', v_allocation.id,
      'action', 'POST',
      'old_value', jsonb_build_object('status', v_allocation.status),
      'new_value', jsonb_build_object('status', 'POSTED'),
      'metadata', jsonb_build_object(
        'allocation_no', v_allocation.allocation_no,
        'withdrawal_request_id', v_allocation.withdrawal_request_id,
        'line_count', v_line_count,
        'allocation_method', v_allocation.allocation_method
      ),
      'performed_by', p_allocated_by,
      'request_id', v_allocation.allocation_no
    )
  ) into v_audit_log_id;

  posted_allocation_id := v_allocation.id;
  posted_allocation_no := v_allocation.allocation_no;
  return next;
end;
$$;
