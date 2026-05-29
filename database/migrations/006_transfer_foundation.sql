create table if not exists tgd_transfer_documents (
  id uuid primary key default gen_random_uuid(),
  transfer_no text not null unique,
  customer_id uuid not null references tgd_customers(id),
  from_warehouse_id uuid not null references tgd_warehouses(id),
  to_warehouse_id uuid not null references tgd_warehouses(id),
  transfer_type text not null default 'INTERNAL',
  status text not null default 'DRAFT',
  source_type text,
  source_no text,
  source_id uuid,
  planned_transfer_date date,
  actual_transfer_at timestamptz,
  posted_at timestamptz,
  posted_by uuid references tgd_user_profiles(id),
  cancelled_at timestamptz,
  cancelled_by uuid references tgd_user_profiles(id),
  cancel_reason text,
  remark text,
  created_by uuid references tgd_user_profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tgd_transfer_documents_status_check check (
    status in ('DRAFT', 'CONFIRMED', 'POSTED', 'CANCELLED', 'REVERSED')
  ),
  constraint tgd_transfer_documents_type_check check (
    transfer_type in (
      'INTERNAL',
      'ROOM_TRANSFER',
      'PALLET_TRANSFER',
      'LOCATION_TRANSFER',
      'QUALITY_HOLD_TRANSFER'
    )
  )
);

create table if not exists tgd_transfer_lines (
  id uuid primary key default gen_random_uuid(),
  transfer_document_id uuid not null references tgd_transfer_documents(id) on delete cascade,
  line_no integer not null,
  product_id uuid not null references tgd_products(id),
  lot_id uuid references tgd_lots(id),
  from_location_id uuid not null references tgd_locations(id),
  from_pallet_id uuid references tgd_pallets(id),
  to_location_id uuid not null references tgd_locations(id),
  to_pallet_id uuid references tgd_pallets(id),
  planned_qty numeric,
  transfer_qty numeric not null default 0,
  uom text not null,
  reason_code text,
  movement_id uuid references tgd_inventory_movements(id),
  remark text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tgd_transfer_lines_document_line_unique unique (transfer_document_id, line_no),
  constraint tgd_transfer_lines_planned_qty_nonnegative check (
    planned_qty is null or planned_qty >= 0
  ),
  constraint tgd_transfer_lines_transfer_qty_nonnegative check (transfer_qty >= 0),
  constraint tgd_transfer_lines_source_target_change_check check (
    not (
      from_location_id = to_location_id
      and from_pallet_id is not distinct from to_pallet_id
    )
  )
);

create index if not exists tgd_transfer_documents_transfer_no_idx
  on tgd_transfer_documents (transfer_no);
create index if not exists tgd_transfer_documents_customer_id_idx
  on tgd_transfer_documents (customer_id);
create index if not exists tgd_transfer_documents_from_warehouse_id_idx
  on tgd_transfer_documents (from_warehouse_id);
create index if not exists tgd_transfer_documents_to_warehouse_id_idx
  on tgd_transfer_documents (to_warehouse_id);
create index if not exists tgd_transfer_documents_status_idx
  on tgd_transfer_documents (status);
create index if not exists tgd_transfer_documents_transfer_type_idx
  on tgd_transfer_documents (transfer_type);
create index if not exists tgd_transfer_documents_source_idx
  on tgd_transfer_documents (source_type, source_no);

create index if not exists tgd_transfer_lines_document_id_idx
  on tgd_transfer_lines (transfer_document_id);
create index if not exists tgd_transfer_lines_product_id_idx
  on tgd_transfer_lines (product_id);
create index if not exists tgd_transfer_lines_lot_id_idx
  on tgd_transfer_lines (lot_id);
create index if not exists tgd_transfer_lines_from_location_id_idx
  on tgd_transfer_lines (from_location_id);
create index if not exists tgd_transfer_lines_to_location_id_idx
  on tgd_transfer_lines (to_location_id);
create index if not exists tgd_transfer_lines_from_pallet_id_idx
  on tgd_transfer_lines (from_pallet_id);
create index if not exists tgd_transfer_lines_to_pallet_id_idx
  on tgd_transfer_lines (to_pallet_id);
create index if not exists tgd_transfer_lines_movement_id_idx
  on tgd_transfer_lines (movement_id);

drop trigger if exists set_tgd_transfer_documents_updated_at on tgd_transfer_documents;
create trigger set_tgd_transfer_documents_updated_at
before update on tgd_transfer_documents
for each row execute function set_updated_at();

drop trigger if exists set_tgd_transfer_lines_updated_at on tgd_transfer_lines;
create trigger set_tgd_transfer_lines_updated_at
before update on tgd_transfer_lines
for each row execute function set_updated_at();

create or replace function tgd_post_transfer_document(
  p_transfer_document_id uuid,
  p_posted_by uuid default null
)
returns table (posted_transfer_document_id uuid, posted_transfer_no text)
language plpgsql
as $$
declare
  v_document tgd_transfer_documents%rowtype;
  v_line tgd_transfer_lines%rowtype;
  v_line_count integer;
  v_movement_id uuid;
  v_audit_log_id uuid;
begin
  select *
  into v_document
  from tgd_transfer_documents
  where id = p_transfer_document_id
  for update;

  if v_document.id is null then
    raise exception 'transfer document not found';
  end if;

  if v_document.status in ('POSTED', 'CANCELLED', 'REVERSED') then
    raise exception 'transfer document status % cannot be posted', v_document.status;
  end if;

  select count(*)
  into v_line_count
  from tgd_transfer_lines
  where transfer_document_id = v_document.id;

  if v_line_count = 0 then
    raise exception 'transfer document has no lines';
  end if;

  if exists (
    select 1
    from tgd_transfer_lines
    where transfer_document_id = v_document.id
      and transfer_qty <= 0
  ) then
    raise exception 'all transfer lines must have transfer_qty greater than zero';
  end if;

  if exists (
    select 1
    from tgd_transfer_lines
    where transfer_document_id = v_document.id
      and from_location_id = to_location_id
      and from_pallet_id is not distinct from to_pallet_id
  ) then
    raise exception 'transfer source and target cannot be the same location and same pallet';
  end if;

  for v_line in
    select *
    from tgd_transfer_lines
    where transfer_document_id = v_document.id
    order by line_no
    for update
  loop
    select posted.movement_id
    into v_movement_id
    from tgd_post_inventory_movement(
      jsonb_build_object(
        'movement_type', 'TRANSFER',
        'customer_id', v_document.customer_id,
        'product_id', v_line.product_id,
        'lot_id', v_line.lot_id,
        'from_warehouse_id', v_document.from_warehouse_id,
        'from_location_id', v_line.from_location_id,
        'from_pallet_id', v_line.from_pallet_id,
        'to_warehouse_id', v_document.to_warehouse_id,
        'to_location_id', v_line.to_location_id,
        'to_pallet_id', v_line.to_pallet_id,
        'qty', v_line.transfer_qty,
        'uom', v_line.uom,
        'reference_type', 'TRANSFER',
        'reference_no', v_document.transfer_no,
        'reference_id', v_document.id,
        'reason_code', v_line.reason_code,
        'remark', v_line.remark,
        'created_by', p_posted_by
      )
    ) as posted
    limit 1;

    update tgd_transfer_lines
    set movement_id = v_movement_id
    where id = v_line.id;
  end loop;

  update tgd_transfer_documents
  set status = 'POSTED',
      posted_at = now(),
      posted_by = p_posted_by,
      actual_transfer_at = coalesce(actual_transfer_at, now())
  where id = v_document.id;

  select tgd_write_audit_log(
    jsonb_build_object(
      'entity_type', 'tgd_transfer_documents',
      'entity_id', v_document.id,
      'action', 'POST',
      'old_value', jsonb_build_object('status', v_document.status),
      'new_value', jsonb_build_object('status', 'POSTED'),
      'metadata', jsonb_build_object(
        'transfer_no', v_document.transfer_no,
        'line_count', v_line_count,
        'movement_type', 'TRANSFER',
        'transfer_type', v_document.transfer_type
      ),
      'performed_by', p_posted_by,
      'request_id', v_document.transfer_no
    )
  ) into v_audit_log_id;

  posted_transfer_document_id := v_document.id;
  posted_transfer_no := v_document.transfer_no;
  return next;
end;
$$;

