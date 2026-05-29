create table if not exists tgd_dispatch_documents (
  id uuid primary key default gen_random_uuid(),
  dispatch_no text not null unique,
  withdrawal_request_id uuid not null references tgd_withdrawal_requests(id),
  picking_document_id uuid references tgd_picking_documents(id),
  customer_id uuid not null references tgd_customers(id),
  warehouse_id uuid not null references tgd_warehouses(id),
  status text not null default 'DRAFT',
  dispatch_type text not null default 'NORMAL',
  dispatch_date date,
  actual_dispatch_at timestamptz,
  transport_type text,
  vehicle_no text,
  driver_name text,
  driver_phone text,
  receiver_name text,
  receiver_phone text,
  delivery_address text,
  posted_at timestamptz,
  posted_by uuid references tgd_user_profiles(id),
  cancelled_at timestamptz,
  cancelled_by uuid references tgd_user_profiles(id),
  cancel_reason text,
  remark text,
  created_by uuid references tgd_user_profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tgd_dispatch_documents_status_check check (
    status in ('DRAFT', 'CONFIRMED', 'POSTED', 'CANCELLED', 'REVERSED')
  ),
  constraint tgd_dispatch_documents_type_check check (
    dispatch_type in (
      'NORMAL',
      'CUSTOMER_PICKUP',
      'DELIVERY',
      'RETURN_TO_CUSTOMER',
      'SAMPLE',
      'DAMAGE_DISPOSAL',
      'OTHER'
    )
  ),
  constraint tgd_dispatch_documents_transport_type_check check (
    transport_type is null
    or transport_type in ('COMPANY_TRUCK', 'CUSTOMER_PICKUP', 'THIRD_PARTY', 'OTHER')
  )
);

create table if not exists tgd_dispatch_lines (
  id uuid primary key default gen_random_uuid(),
  dispatch_document_id uuid not null references tgd_dispatch_documents(id) on delete cascade,
  withdrawal_request_line_id uuid not null references tgd_withdrawal_request_lines(id),
  picking_line_id uuid references tgd_picking_lines(id),
  allocation_line_id uuid references tgd_withdrawal_allocation_lines(id),
  line_no integer not null,
  product_id uuid not null references tgd_products(id),
  lot_id uuid references tgd_lots(id),
  warehouse_id uuid not null references tgd_warehouses(id),
  location_id uuid not null references tgd_locations(id),
  pallet_id uuid references tgd_pallets(id),
  picked_qty numeric not null default 0,
  dispatch_qty numeric not null default 0,
  uom text not null,
  movement_id uuid references tgd_inventory_movements(id),
  remark text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tgd_dispatch_lines_document_line_unique unique (dispatch_document_id, line_no),
  constraint tgd_dispatch_lines_picked_qty_nonnegative check (picked_qty >= 0),
  constraint tgd_dispatch_lines_dispatch_qty_nonnegative check (dispatch_qty >= 0),
  constraint tgd_dispatch_lines_dispatch_lte_picked check (dispatch_qty <= picked_qty)
);

create index if not exists tgd_dispatch_documents_dispatch_no_idx
  on tgd_dispatch_documents (dispatch_no);
create index if not exists tgd_dispatch_documents_withdrawal_request_id_idx
  on tgd_dispatch_documents (withdrawal_request_id);
create index if not exists tgd_dispatch_documents_picking_document_id_idx
  on tgd_dispatch_documents (picking_document_id);
create index if not exists tgd_dispatch_documents_customer_id_idx
  on tgd_dispatch_documents (customer_id);
create index if not exists tgd_dispatch_documents_warehouse_id_idx
  on tgd_dispatch_documents (warehouse_id);
create index if not exists tgd_dispatch_documents_status_idx
  on tgd_dispatch_documents (status);
create index if not exists tgd_dispatch_documents_dispatch_type_idx
  on tgd_dispatch_documents (dispatch_type);
create index if not exists tgd_dispatch_documents_dispatch_date_idx
  on tgd_dispatch_documents (dispatch_date);

create index if not exists tgd_dispatch_lines_document_id_idx
  on tgd_dispatch_lines (dispatch_document_id);
create index if not exists tgd_dispatch_lines_request_line_id_idx
  on tgd_dispatch_lines (withdrawal_request_line_id);
create index if not exists tgd_dispatch_lines_picking_line_id_idx
  on tgd_dispatch_lines (picking_line_id);
create index if not exists tgd_dispatch_lines_allocation_line_id_idx
  on tgd_dispatch_lines (allocation_line_id);
create index if not exists tgd_dispatch_lines_product_id_idx
  on tgd_dispatch_lines (product_id);
create index if not exists tgd_dispatch_lines_lot_id_idx
  on tgd_dispatch_lines (lot_id);
create index if not exists tgd_dispatch_lines_location_id_idx
  on tgd_dispatch_lines (location_id);
create index if not exists tgd_dispatch_lines_pallet_id_idx
  on tgd_dispatch_lines (pallet_id);
create index if not exists tgd_dispatch_lines_movement_id_idx
  on tgd_dispatch_lines (movement_id);

drop trigger if exists set_tgd_dispatch_documents_updated_at on tgd_dispatch_documents;
create trigger set_tgd_dispatch_documents_updated_at
before update on tgd_dispatch_documents
for each row execute function set_updated_at();

drop trigger if exists set_tgd_dispatch_lines_updated_at on tgd_dispatch_lines;
create trigger set_tgd_dispatch_lines_updated_at
before update on tgd_dispatch_lines
for each row execute function set_updated_at();

create or replace function tgd_post_dispatch_document(
  p_dispatch_document_id uuid,
  p_posted_by uuid default null
)
returns table (posted_dispatch_document_id uuid, posted_dispatch_no text)
language plpgsql
as $$
declare
  v_document tgd_dispatch_documents%rowtype;
  v_request tgd_withdrawal_requests%rowtype;
  v_line tgd_dispatch_lines%rowtype;
  v_line_count integer;
  v_movement_id uuid;
  v_total_picked numeric;
  v_total_dispatched numeric;
  v_audit_log_id uuid;
begin
  select *
  into v_document
  from tgd_dispatch_documents
  where id = p_dispatch_document_id
  for update;

  if v_document.id is null then
    raise exception 'dispatch document not found';
  end if;

  if v_document.status in ('POSTED', 'CANCELLED', 'REVERSED') then
    raise exception 'dispatch document status % cannot be posted', v_document.status;
  end if;

  select *
  into v_request
  from tgd_withdrawal_requests
  where id = v_document.withdrawal_request_id
  for update;

  if v_request.id is null then
    raise exception 'linked withdrawal request not found';
  end if;

  if v_request.status not in ('PICKED', 'PICKING') then
    raise exception 'withdrawal request status % cannot be dispatched', v_request.status;
  end if;

  select count(*)
  into v_line_count
  from tgd_dispatch_lines
  where dispatch_document_id = v_document.id;

  if v_line_count = 0 then
    raise exception 'dispatch document has no lines';
  end if;

  if exists (
    select 1
    from tgd_dispatch_lines
    where dispatch_document_id = v_document.id
      and dispatch_qty <= 0
  ) then
    raise exception 'all dispatch lines must have dispatch_qty greater than zero';
  end if;

  if exists (
    select 1
    from tgd_dispatch_lines
    where dispatch_document_id = v_document.id
      and dispatch_qty > picked_qty
  ) then
    raise exception 'dispatch_qty cannot exceed picked_qty';
  end if;

  for v_line in
    select *
    from tgd_dispatch_lines
    where dispatch_document_id = v_document.id
    order by line_no
    for update
  loop
    select posted.movement_id
    into v_movement_id
    from tgd_post_inventory_movement(
      jsonb_build_object(
        'movement_type', 'PICK_CONFIRM',
        'customer_id', v_document.customer_id,
        'product_id', v_line.product_id,
        'lot_id', v_line.lot_id,
        'from_warehouse_id', v_line.warehouse_id,
        'from_location_id', v_line.location_id,
        'from_pallet_id', v_line.pallet_id,
        'qty', v_line.dispatch_qty,
        'uom', v_line.uom,
        'reference_type', 'DISPATCH',
        'reference_no', v_document.dispatch_no,
        'reference_id', v_document.id,
        'remark', v_line.remark,
        'created_by', p_posted_by
      )
    ) as posted
    limit 1;

    update tgd_dispatch_lines
    set movement_id = v_movement_id
    where id = v_line.id;
  end loop;

  update tgd_dispatch_documents
  set status = 'POSTED',
      posted_at = now(),
      posted_by = p_posted_by,
      actual_dispatch_at = coalesce(actual_dispatch_at, now())
  where id = v_document.id;

  update tgd_withdrawal_request_lines request_line
  set dispatched_qty = coalesce(posted_dispatches.dispatched_qty, 0)
  from (
    select
      dispatch_line.withdrawal_request_line_id,
      sum(dispatch_line.dispatch_qty) as dispatched_qty
    from tgd_dispatch_lines dispatch_line
    join tgd_dispatch_documents dispatch_document
      on dispatch_document.id = dispatch_line.dispatch_document_id
    where dispatch_document.withdrawal_request_id = v_document.withdrawal_request_id
      and dispatch_document.status = 'POSTED'
    group by dispatch_line.withdrawal_request_line_id
  ) posted_dispatches
  where request_line.id = posted_dispatches.withdrawal_request_line_id
    and request_line.withdrawal_request_id = v_document.withdrawal_request_id;

  if exists (
    select 1
    from tgd_withdrawal_request_lines
    where withdrawal_request_id = v_document.withdrawal_request_id
      and dispatched_qty > picked_qty
  ) then
    raise exception 'dispatched quantity cannot exceed picked quantity';
  end if;

  select
    coalesce(sum(picked_qty), 0),
    coalesce(sum(dispatched_qty), 0)
  into v_total_picked, v_total_dispatched
  from tgd_withdrawal_request_lines
  where withdrawal_request_id = v_document.withdrawal_request_id;

  update tgd_withdrawal_requests
  set status = case
        when v_total_picked > 0 and v_total_dispatched = v_total_picked then 'DISPATCHED'
        when v_total_picked > 0 then 'PICKED'
        else status
      end
  where id = v_document.withdrawal_request_id;

  select tgd_write_audit_log(
    jsonb_build_object(
      'entity_type', 'tgd_dispatch_documents',
      'entity_id', v_document.id,
      'action', 'POST',
      'old_value', jsonb_build_object('status', v_document.status),
      'new_value', jsonb_build_object('status', 'POSTED'),
      'metadata', jsonb_build_object(
        'dispatch_no', v_document.dispatch_no,
        'withdrawal_request_id', v_document.withdrawal_request_id,
        'picking_document_id', v_document.picking_document_id,
        'line_count', v_line_count,
        'dispatch_type', v_document.dispatch_type
      ),
      'performed_by', p_posted_by,
      'request_id', v_document.dispatch_no
    )
  ) into v_audit_log_id;

  posted_dispatch_document_id := v_document.id;
  posted_dispatch_no := v_document.dispatch_no;
  return next;
end;
$$;

