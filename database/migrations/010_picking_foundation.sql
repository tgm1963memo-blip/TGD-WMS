create table if not exists tgd_picking_documents (
  id uuid primary key default gen_random_uuid(),
  picking_no text not null unique,
  withdrawal_request_id uuid not null references tgd_withdrawal_requests(id),
  allocation_id uuid references tgd_withdrawal_allocations(id),
  customer_id uuid not null references tgd_customers(id),
  warehouse_id uuid not null references tgd_warehouses(id),
  status text not null default 'DRAFT',
  picking_method text not null default 'MANUAL',
  assigned_to uuid references tgd_user_profiles(id),
  planned_pick_date date,
  started_at timestamptz,
  completed_at timestamptz,
  completed_by uuid references tgd_user_profiles(id),
  cancelled_at timestamptz,
  cancelled_by uuid references tgd_user_profiles(id),
  cancel_reason text,
  remark text,
  created_by uuid references tgd_user_profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tgd_picking_documents_status_check check (
    status in ('DRAFT', 'RELEASED', 'IN_PROGRESS', 'PICKED', 'CANCELLED')
  ),
  constraint tgd_picking_documents_method_check check (
    picking_method in ('MANUAL', 'FIFO', 'FEFO', 'HANDHELD_SCAN', 'SYSTEM_SUGGESTED')
  )
);

create table if not exists tgd_picking_lines (
  id uuid primary key default gen_random_uuid(),
  picking_document_id uuid not null references tgd_picking_documents(id) on delete cascade,
  withdrawal_request_line_id uuid not null references tgd_withdrawal_request_lines(id),
  allocation_line_id uuid references tgd_withdrawal_allocation_lines(id),
  line_no integer not null,
  product_id uuid not null references tgd_products(id),
  lot_id uuid references tgd_lots(id),
  warehouse_id uuid not null references tgd_warehouses(id),
  location_id uuid not null references tgd_locations(id),
  pallet_id uuid references tgd_pallets(id),
  allocated_qty numeric not null default 0,
  picked_qty numeric not null default 0,
  uom text not null,
  picker_id uuid references tgd_user_profiles(id),
  picked_at timestamptz,
  scan_barcode text,
  scan_confirmed boolean not null default false,
  variance_qty numeric not null default 0,
  variance_reason text,
  remark text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tgd_picking_lines_document_line_unique unique (picking_document_id, line_no),
  constraint tgd_picking_lines_allocated_qty_nonnegative check (allocated_qty >= 0),
  constraint tgd_picking_lines_picked_qty_nonnegative check (picked_qty >= 0),
  constraint tgd_picking_lines_picked_lte_allocated check (picked_qty <= allocated_qty),
  constraint tgd_picking_lines_variance_matches_qty check (variance_qty = allocated_qty - picked_qty)
);

create index if not exists tgd_picking_documents_picking_no_idx
  on tgd_picking_documents (picking_no);
create index if not exists tgd_picking_documents_withdrawal_request_id_idx
  on tgd_picking_documents (withdrawal_request_id);
create index if not exists tgd_picking_documents_allocation_id_idx
  on tgd_picking_documents (allocation_id);
create index if not exists tgd_picking_documents_customer_id_idx
  on tgd_picking_documents (customer_id);
create index if not exists tgd_picking_documents_warehouse_id_idx
  on tgd_picking_documents (warehouse_id);
create index if not exists tgd_picking_documents_status_idx
  on tgd_picking_documents (status);
create index if not exists tgd_picking_documents_method_idx
  on tgd_picking_documents (picking_method);
create index if not exists tgd_picking_documents_assigned_to_idx
  on tgd_picking_documents (assigned_to);

create index if not exists tgd_picking_lines_document_id_idx
  on tgd_picking_lines (picking_document_id);
create index if not exists tgd_picking_lines_request_line_id_idx
  on tgd_picking_lines (withdrawal_request_line_id);
create index if not exists tgd_picking_lines_allocation_line_id_idx
  on tgd_picking_lines (allocation_line_id);
create index if not exists tgd_picking_lines_product_id_idx
  on tgd_picking_lines (product_id);
create index if not exists tgd_picking_lines_lot_id_idx
  on tgd_picking_lines (lot_id);
create index if not exists tgd_picking_lines_location_id_idx
  on tgd_picking_lines (location_id);
create index if not exists tgd_picking_lines_pallet_id_idx
  on tgd_picking_lines (pallet_id);
create index if not exists tgd_picking_lines_picker_id_idx
  on tgd_picking_lines (picker_id);

drop trigger if exists set_tgd_picking_documents_updated_at on tgd_picking_documents;
create trigger set_tgd_picking_documents_updated_at
before update on tgd_picking_documents
for each row execute function set_updated_at();

drop trigger if exists set_tgd_picking_lines_updated_at on tgd_picking_lines;
create trigger set_tgd_picking_lines_updated_at
before update on tgd_picking_lines
for each row execute function set_updated_at();

create or replace function tgd_confirm_picking_document(
  p_picking_document_id uuid,
  p_completed_by uuid default null
)
returns table (confirmed_picking_document_id uuid, confirmed_picking_no text)
language plpgsql
as $$
declare
  v_document tgd_picking_documents%rowtype;
  v_request tgd_withdrawal_requests%rowtype;
  v_line_count integer;
  v_total_allocated numeric;
  v_total_picked numeric;
  v_audit_log_id uuid;
begin
  select *
  into v_document
  from tgd_picking_documents
  where id = p_picking_document_id
  for update;

  if v_document.id is null then
    raise exception 'picking document not found';
  end if;

  if v_document.status in ('PICKED', 'CANCELLED') then
    raise exception 'picking document status % cannot be confirmed', v_document.status;
  end if;

  select *
  into v_request
  from tgd_withdrawal_requests
  where id = v_document.withdrawal_request_id
  for update;

  if v_request.id is null then
    raise exception 'linked withdrawal request not found';
  end if;

  if v_request.status not in ('ALLOCATED', 'PARTIALLY_ALLOCATED', 'PICKING') then
    raise exception 'withdrawal request status % cannot be picked', v_request.status;
  end if;

  select count(*)
  into v_line_count
  from tgd_picking_lines
  where picking_document_id = v_document.id;

  if v_line_count = 0 then
    raise exception 'picking document has no lines';
  end if;

  if exists (
    select 1
    from tgd_picking_lines
    where picking_document_id = v_document.id
      and picked_qty < 0
  ) then
    raise exception 'picked_qty cannot be negative';
  end if;

  if exists (
    select 1
    from tgd_picking_lines
    where picking_document_id = v_document.id
      and picked_qty > allocated_qty
  ) then
    raise exception 'picked_qty cannot exceed allocated_qty';
  end if;

  update tgd_picking_lines
  set variance_qty = allocated_qty - picked_qty,
      picked_at = case
        when picked_at is null and picked_qty > 0 then now()
        else picked_at
      end,
      picker_id = case
        when picker_id is null and p_completed_by is not null then p_completed_by
        else picker_id
      end
  where picking_document_id = v_document.id;

  update tgd_picking_documents
  set status = 'PICKED',
      completed_at = now(),
      completed_by = p_completed_by
  where id = v_document.id;

  update tgd_withdrawal_request_lines request_line
  set picked_qty = coalesce(confirmed_picks.picked_qty, 0)
  from (
    select
      picking_line.withdrawal_request_line_id,
      sum(picking_line.picked_qty) as picked_qty
    from tgd_picking_lines picking_line
    join tgd_picking_documents picking_document
      on picking_document.id = picking_line.picking_document_id
    where picking_document.withdrawal_request_id = v_document.withdrawal_request_id
      and picking_document.status = 'PICKED'
    group by picking_line.withdrawal_request_line_id
  ) confirmed_picks
  where request_line.id = confirmed_picks.withdrawal_request_line_id
    and request_line.withdrawal_request_id = v_document.withdrawal_request_id;

  if exists (
    select 1
    from tgd_withdrawal_request_lines
    where withdrawal_request_id = v_document.withdrawal_request_id
      and picked_qty > allocated_qty
  ) then
    raise exception 'picked quantity cannot exceed allocated quantity';
  end if;

  select
    coalesce(sum(allocated_qty), 0),
    coalesce(sum(picked_qty), 0)
  into v_total_allocated, v_total_picked
  from tgd_withdrawal_request_lines
  where withdrawal_request_id = v_document.withdrawal_request_id;

  update tgd_withdrawal_requests
  set status = case
        when v_total_allocated > 0 and v_total_picked = v_total_allocated then 'PICKED'
        when v_total_picked > 0 then 'PICKING'
        else status
      end
  where id = v_document.withdrawal_request_id;

  select tgd_write_audit_log(
    jsonb_build_object(
      'entity_type', 'tgd_picking_documents',
      'entity_id', v_document.id,
      'action', 'CONFIRM_PICKING',
      'old_value', jsonb_build_object('status', v_document.status),
      'new_value', jsonb_build_object('status', 'PICKED'),
      'metadata', jsonb_build_object(
        'picking_no', v_document.picking_no,
        'withdrawal_request_id', v_document.withdrawal_request_id,
        'allocation_id', v_document.allocation_id,
        'line_count', v_line_count,
        'picking_method', v_document.picking_method
      ),
      'performed_by', p_completed_by,
      'request_id', v_document.picking_no
    )
  ) into v_audit_log_id;

  confirmed_picking_document_id := v_document.id;
  confirmed_picking_no := v_document.picking_no;
  return next;
end;
$$;
