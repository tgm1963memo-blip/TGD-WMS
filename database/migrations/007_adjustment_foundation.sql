create table if not exists tgd_adjustment_documents (
  id uuid primary key default gen_random_uuid(),
  adjustment_no text not null unique,
  customer_id uuid not null references tgd_customers(id),
  warehouse_id uuid not null references tgd_warehouses(id),
  adjustment_type text not null,
  status text not null default 'DRAFT',
  source_type text,
  source_no text,
  source_id uuid,
  adjustment_date date,
  posted_at timestamptz,
  posted_by uuid references tgd_user_profiles(id),
  cancelled_at timestamptz,
  cancelled_by uuid references tgd_user_profiles(id),
  cancel_reason text,
  remark text,
  created_by uuid references tgd_user_profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tgd_adjustment_documents_status_check check (
    status in ('DRAFT', 'CONFIRMED', 'POSTED', 'CANCELLED', 'REVERSED')
  ),
  constraint tgd_adjustment_documents_type_check check (
    adjustment_type in (
      'STOCK_COUNT_GAIN',
      'STOCK_COUNT_LOSS',
      'DAMAGE',
      'EXPIRED',
      'QUALITY_HOLD',
      'QUALITY_RELEASE',
      'SYSTEM_CORRECTION',
      'OTHER'
    )
  )
);

create table if not exists tgd_adjustment_lines (
  id uuid primary key default gen_random_uuid(),
  adjustment_document_id uuid not null references tgd_adjustment_documents(id) on delete cascade,
  line_no integer not null,
  product_id uuid not null references tgd_products(id),
  lot_id uuid references tgd_lots(id),
  warehouse_id uuid not null references tgd_warehouses(id),
  location_id uuid not null references tgd_locations(id),
  pallet_id uuid references tgd_pallets(id),
  adjustment_direction text not null,
  adjustment_qty numeric not null default 0,
  uom text not null,
  reason_code text,
  condition_status text,
  movement_id uuid references tgd_inventory_movements(id),
  remark text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tgd_adjustment_lines_document_line_unique unique (adjustment_document_id, line_no),
  constraint tgd_adjustment_lines_qty_nonnegative check (adjustment_qty >= 0),
  constraint tgd_adjustment_lines_direction_check check (adjustment_direction in ('IN', 'OUT')),
  constraint tgd_adjustment_lines_condition_status_check check (
    condition_status is null
    or condition_status in ('GOOD', 'DAMAGED', 'HOLD', 'EXPIRED', 'REJECTED', 'RELEASED', 'UNKNOWN')
  )
);

create index if not exists tgd_adjustment_documents_adjustment_no_idx
  on tgd_adjustment_documents (adjustment_no);
create index if not exists tgd_adjustment_documents_customer_id_idx
  on tgd_adjustment_documents (customer_id);
create index if not exists tgd_adjustment_documents_warehouse_id_idx
  on tgd_adjustment_documents (warehouse_id);
create index if not exists tgd_adjustment_documents_status_idx
  on tgd_adjustment_documents (status);
create index if not exists tgd_adjustment_documents_adjustment_type_idx
  on tgd_adjustment_documents (adjustment_type);
create index if not exists tgd_adjustment_documents_source_idx
  on tgd_adjustment_documents (source_type, source_no);

create index if not exists tgd_adjustment_lines_document_id_idx
  on tgd_adjustment_lines (adjustment_document_id);
create index if not exists tgd_adjustment_lines_product_id_idx
  on tgd_adjustment_lines (product_id);
create index if not exists tgd_adjustment_lines_lot_id_idx
  on tgd_adjustment_lines (lot_id);
create index if not exists tgd_adjustment_lines_warehouse_id_idx
  on tgd_adjustment_lines (warehouse_id);
create index if not exists tgd_adjustment_lines_location_id_idx
  on tgd_adjustment_lines (location_id);
create index if not exists tgd_adjustment_lines_pallet_id_idx
  on tgd_adjustment_lines (pallet_id);
create index if not exists tgd_adjustment_lines_direction_idx
  on tgd_adjustment_lines (adjustment_direction);
create index if not exists tgd_adjustment_lines_movement_id_idx
  on tgd_adjustment_lines (movement_id);

drop trigger if exists set_tgd_adjustment_documents_updated_at on tgd_adjustment_documents;
create trigger set_tgd_adjustment_documents_updated_at
before update on tgd_adjustment_documents
for each row execute function set_updated_at();

drop trigger if exists set_tgd_adjustment_lines_updated_at on tgd_adjustment_lines;
create trigger set_tgd_adjustment_lines_updated_at
before update on tgd_adjustment_lines
for each row execute function set_updated_at();

create or replace function tgd_post_adjustment_document(
  p_adjustment_document_id uuid,
  p_posted_by uuid default null
)
returns table (posted_adjustment_document_id uuid, posted_adjustment_no text)
language plpgsql
as $$
declare
  v_document tgd_adjustment_documents%rowtype;
  v_line tgd_adjustment_lines%rowtype;
  v_line_count integer;
  v_movement_id uuid;
  v_movement_type text;
  v_audit_log_id uuid;
begin
  select *
  into v_document
  from tgd_adjustment_documents
  where id = p_adjustment_document_id
  for update;

  if v_document.id is null then
    raise exception 'adjustment document not found';
  end if;

  if v_document.status in ('POSTED', 'CANCELLED', 'REVERSED') then
    raise exception 'adjustment document status % cannot be posted', v_document.status;
  end if;

  select count(*)
  into v_line_count
  from tgd_adjustment_lines
  where adjustment_document_id = v_document.id;

  if v_line_count = 0 then
    raise exception 'adjustment document has no lines';
  end if;

  if exists (
    select 1
    from tgd_adjustment_lines
    where adjustment_document_id = v_document.id
      and adjustment_qty <= 0
  ) then
    raise exception 'all adjustment lines must have adjustment_qty greater than zero';
  end if;

  for v_line in
    select *
    from tgd_adjustment_lines
    where adjustment_document_id = v_document.id
    order by line_no
    for update
  loop
    v_movement_type := case v_line.adjustment_direction
      when 'IN' then 'ADJUST_IN'
      when 'OUT' then 'ADJUST_OUT'
      else null
    end;

    if v_movement_type is null then
      raise exception 'unsupported adjustment_direction: %', v_line.adjustment_direction;
    end if;

    select posted.movement_id
    into v_movement_id
    from tgd_post_inventory_movement(
      jsonb_build_object(
        'movement_type', v_movement_type,
        'customer_id', v_document.customer_id,
        'product_id', v_line.product_id,
        'lot_id', v_line.lot_id,
        'from_warehouse_id', case when v_line.adjustment_direction = 'OUT' then v_line.warehouse_id else null end,
        'from_location_id', case when v_line.adjustment_direction = 'OUT' then v_line.location_id else null end,
        'from_pallet_id', case when v_line.adjustment_direction = 'OUT' then v_line.pallet_id else null end,
        'to_warehouse_id', case when v_line.adjustment_direction = 'IN' then v_line.warehouse_id else null end,
        'to_location_id', case when v_line.adjustment_direction = 'IN' then v_line.location_id else null end,
        'to_pallet_id', case when v_line.adjustment_direction = 'IN' then v_line.pallet_id else null end,
        'qty', v_line.adjustment_qty,
        'uom', v_line.uom,
        'reference_type', 'ADJUSTMENT',
        'reference_no', v_document.adjustment_no,
        'reference_id', v_document.id,
        'reason_code', coalesce(v_line.reason_code, v_document.adjustment_type),
        'remark', v_line.remark,
        'created_by', p_posted_by
      )
    ) as posted
    limit 1;

    update tgd_adjustment_lines
    set movement_id = v_movement_id
    where id = v_line.id;
  end loop;

  update tgd_adjustment_documents
  set status = 'POSTED',
      posted_at = now(),
      posted_by = p_posted_by
  where id = v_document.id;

  select tgd_write_audit_log(
    jsonb_build_object(
      'entity_type', 'tgd_adjustment_documents',
      'entity_id', v_document.id,
      'action', 'POST',
      'old_value', jsonb_build_object('status', v_document.status),
      'new_value', jsonb_build_object('status', 'POSTED'),
      'metadata', jsonb_build_object(
        'adjustment_no', v_document.adjustment_no,
        'line_count', v_line_count,
        'adjustment_type', v_document.adjustment_type
      ),
      'performed_by', p_posted_by,
      'request_id', v_document.adjustment_no
    )
  ) into v_audit_log_id;

  posted_adjustment_document_id := v_document.id;
  posted_adjustment_no := v_document.adjustment_no;
  return next;
end;
$$;

