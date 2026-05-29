create table if not exists tgd_putaway_documents (
  id uuid primary key default gen_random_uuid(),
  putaway_no text not null unique,
  customer_id uuid not null references tgd_customers(id),
  warehouse_id uuid not null references tgd_warehouses(id),
  status text not null default 'DRAFT',
  source_type text,
  source_no text,
  source_id uuid,
  planned_putaway_date date,
  actual_putaway_at timestamptz,
  posted_at timestamptz,
  posted_by uuid references tgd_user_profiles(id),
  cancelled_at timestamptz,
  cancelled_by uuid references tgd_user_profiles(id),
  cancel_reason text,
  remark text,
  created_by uuid references tgd_user_profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tgd_putaway_documents_status_check check (
    status in ('DRAFT', 'CONFIRMED', 'POSTED', 'CANCELLED', 'REVERSED')
  )
);

create table if not exists tgd_putaway_lines (
  id uuid primary key default gen_random_uuid(),
  putaway_document_id uuid not null references tgd_putaway_documents(id) on delete cascade,
  line_no integer not null,
  product_id uuid not null references tgd_products(id),
  lot_id uuid references tgd_lots(id),
  from_location_id uuid not null references tgd_locations(id),
  from_pallet_id uuid references tgd_pallets(id),
  to_location_id uuid not null references tgd_locations(id),
  to_pallet_id uuid references tgd_pallets(id),
  planned_qty numeric,
  putaway_qty numeric not null default 0,
  uom text not null,
  source_receiving_line_id uuid references tgd_receiving_lines(id),
  movement_id uuid references tgd_inventory_movements(id),
  remark text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tgd_putaway_lines_document_line_unique unique (putaway_document_id, line_no),
  constraint tgd_putaway_lines_planned_qty_nonnegative check (
    planned_qty is null or planned_qty >= 0
  ),
  constraint tgd_putaway_lines_putaway_qty_nonnegative check (putaway_qty >= 0),
  constraint tgd_putaway_lines_location_change_check check (from_location_id <> to_location_id)
);

create index if not exists tgd_putaway_documents_putaway_no_idx
  on tgd_putaway_documents (putaway_no);
create index if not exists tgd_putaway_documents_customer_id_idx
  on tgd_putaway_documents (customer_id);
create index if not exists tgd_putaway_documents_warehouse_id_idx
  on tgd_putaway_documents (warehouse_id);
create index if not exists tgd_putaway_documents_status_idx
  on tgd_putaway_documents (status);
create index if not exists tgd_putaway_documents_source_idx
  on tgd_putaway_documents (source_type, source_no);

create index if not exists tgd_putaway_lines_document_id_idx
  on tgd_putaway_lines (putaway_document_id);
create index if not exists tgd_putaway_lines_product_id_idx
  on tgd_putaway_lines (product_id);
create index if not exists tgd_putaway_lines_lot_id_idx
  on tgd_putaway_lines (lot_id);
create index if not exists tgd_putaway_lines_from_location_id_idx
  on tgd_putaway_lines (from_location_id);
create index if not exists tgd_putaway_lines_to_location_id_idx
  on tgd_putaway_lines (to_location_id);
create index if not exists tgd_putaway_lines_from_pallet_id_idx
  on tgd_putaway_lines (from_pallet_id);
create index if not exists tgd_putaway_lines_to_pallet_id_idx
  on tgd_putaway_lines (to_pallet_id);
create index if not exists tgd_putaway_lines_source_receiving_line_id_idx
  on tgd_putaway_lines (source_receiving_line_id);
create index if not exists tgd_putaway_lines_movement_id_idx
  on tgd_putaway_lines (movement_id);

drop trigger if exists set_tgd_putaway_documents_updated_at on tgd_putaway_documents;
create trigger set_tgd_putaway_documents_updated_at
before update on tgd_putaway_documents
for each row execute function set_updated_at();

drop trigger if exists set_tgd_putaway_lines_updated_at on tgd_putaway_lines;
create trigger set_tgd_putaway_lines_updated_at
before update on tgd_putaway_lines
for each row execute function set_updated_at();

create or replace function tgd_post_putaway_document(
  p_putaway_document_id uuid,
  p_posted_by uuid default null
)
returns table (posted_putaway_document_id uuid, posted_putaway_no text)
language plpgsql
as $$
declare
  v_document tgd_putaway_documents%rowtype;
  v_line tgd_putaway_lines%rowtype;
  v_line_count integer;
  v_movement_id uuid;
  v_audit_log_id uuid;
begin
  select *
  into v_document
  from tgd_putaway_documents
  where id = p_putaway_document_id
  for update;

  if v_document.id is null then
    raise exception 'putaway document not found';
  end if;

  if v_document.status in ('POSTED', 'CANCELLED', 'REVERSED') then
    raise exception 'putaway document status % cannot be posted', v_document.status;
  end if;

  select count(*)
  into v_line_count
  from tgd_putaway_lines
  where putaway_document_id = v_document.id;

  if v_line_count = 0 then
    raise exception 'putaway document has no lines';
  end if;

  if exists (
    select 1
    from tgd_putaway_lines
    where putaway_document_id = v_document.id
      and putaway_qty <= 0
  ) then
    raise exception 'all putaway lines must have putaway_qty greater than zero';
  end if;

  if exists (
    select 1
    from tgd_putaway_lines
    where putaway_document_id = v_document.id
      and from_location_id = to_location_id
  ) then
    raise exception 'putaway from_location_id and to_location_id must be different';
  end if;

  for v_line in
    select *
    from tgd_putaway_lines
    where putaway_document_id = v_document.id
    order by line_no
    for update
  loop
    select posted.movement_id
    into v_movement_id
    from tgd_post_inventory_movement(
      jsonb_build_object(
        'movement_type', 'PUTAWAY',
        'customer_id', v_document.customer_id,
        'product_id', v_line.product_id,
        'lot_id', v_line.lot_id,
        'from_warehouse_id', v_document.warehouse_id,
        'from_location_id', v_line.from_location_id,
        'from_pallet_id', v_line.from_pallet_id,
        'to_warehouse_id', v_document.warehouse_id,
        'to_location_id', v_line.to_location_id,
        'to_pallet_id', v_line.to_pallet_id,
        'qty', v_line.putaway_qty,
        'uom', v_line.uom,
        'reference_type', 'PUTAWAY',
        'reference_no', v_document.putaway_no,
        'reference_id', v_document.id,
        'remark', v_line.remark,
        'created_by', p_posted_by
      )
    ) as posted
    limit 1;

    update tgd_putaway_lines
    set movement_id = v_movement_id
    where id = v_line.id;
  end loop;

  update tgd_putaway_documents
  set status = 'POSTED',
      posted_at = now(),
      posted_by = p_posted_by,
      actual_putaway_at = coalesce(actual_putaway_at, now())
  where id = v_document.id;

  select tgd_write_audit_log(
    jsonb_build_object(
      'entity_type', 'tgd_putaway_documents',
      'entity_id', v_document.id,
      'action', 'POST',
      'old_value', jsonb_build_object('status', v_document.status),
      'new_value', jsonb_build_object('status', 'POSTED'),
      'metadata', jsonb_build_object(
        'putaway_no', v_document.putaway_no,
        'line_count', v_line_count,
        'movement_type', 'PUTAWAY'
      ),
      'performed_by', p_posted_by,
      'request_id', v_document.putaway_no
    )
  ) into v_audit_log_id;

  posted_putaway_document_id := v_document.id;
  posted_putaway_no := v_document.putaway_no;
  return next;
end;
$$;

