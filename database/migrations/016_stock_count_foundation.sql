create table if not exists tgd_stock_count_documents (
  id uuid primary key default gen_random_uuid(),
  stock_count_no text not null unique,
  warehouse_id uuid not null references tgd_warehouses(id),
  count_type text not null default 'CYCLE_COUNT',
  status text not null default 'DRAFT',
  count_date date not null default current_date,
  started_at timestamptz,
  completed_at timestamptz,
  completed_by uuid references tgd_user_profiles(id),
  approved_at timestamptz,
  approved_by uuid references tgd_user_profiles(id),
  cancelled_at timestamptz,
  cancelled_by uuid references tgd_user_profiles(id),
  cancel_reason text,
  remark text,
  created_by uuid references tgd_user_profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tgd_stock_count_documents_status_check check (
    status in ('DRAFT', 'IN_PROGRESS', 'COUNTED', 'APPROVED', 'CANCELLED', 'ADJUSTMENT_CREATED')
  ),
  constraint tgd_stock_count_documents_type_check check (
    count_type in ('FULL_COUNT', 'CYCLE_COUNT', 'LOCATION_COUNT', 'PRODUCT_COUNT', 'LOT_COUNT', 'PALLET_COUNT', 'ADHOC')
  )
);

create table if not exists tgd_stock_count_lines (
  id uuid primary key default gen_random_uuid(),
  stock_count_document_id uuid not null references tgd_stock_count_documents(id) on delete cascade,
  line_no integer not null,
  customer_id uuid references tgd_customers(id),
  product_id uuid not null references tgd_products(id),
  lot_id uuid references tgd_lots(id),
  warehouse_id uuid not null references tgd_warehouses(id),
  location_id uuid references tgd_locations(id),
  pallet_id uuid references tgd_pallets(id),
  expected_qty numeric not null default 0,
  counted_qty numeric,
  variance_qty numeric,
  uom text not null,
  count_status text not null default 'PENDING',
  counted_by uuid references tgd_user_profiles(id),
  counted_at timestamptz,
  scan_event_id uuid references tgd_barcode_scan_events(id),
  variance_reason text,
  adjustment_line_id uuid references tgd_adjustment_lines(id),
  remark text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tgd_stock_count_lines_document_line_unique unique (stock_count_document_id, line_no),
  constraint tgd_stock_count_lines_expected_qty_nonnegative check (expected_qty >= 0),
  constraint tgd_stock_count_lines_counted_qty_nonnegative check (
    counted_qty is null or counted_qty >= 0
  ),
  constraint tgd_stock_count_lines_status_check check (
    count_status in ('PENDING', 'COUNTED', 'VARIANCE', 'ZERO_COUNT', 'SKIPPED')
  )
);

create index if not exists tgd_stock_count_documents_stock_count_no_idx
  on tgd_stock_count_documents (stock_count_no);
create index if not exists tgd_stock_count_documents_warehouse_id_idx
  on tgd_stock_count_documents (warehouse_id);
create index if not exists tgd_stock_count_documents_status_idx
  on tgd_stock_count_documents (status);
create index if not exists tgd_stock_count_documents_count_type_idx
  on tgd_stock_count_documents (count_type);
create index if not exists tgd_stock_count_documents_count_date_idx
  on tgd_stock_count_documents (count_date);

create index if not exists tgd_stock_count_lines_document_id_idx
  on tgd_stock_count_lines (stock_count_document_id);
create index if not exists tgd_stock_count_lines_customer_id_idx
  on tgd_stock_count_lines (customer_id);
create index if not exists tgd_stock_count_lines_product_id_idx
  on tgd_stock_count_lines (product_id);
create index if not exists tgd_stock_count_lines_lot_id_idx
  on tgd_stock_count_lines (lot_id);
create index if not exists tgd_stock_count_lines_warehouse_id_idx
  on tgd_stock_count_lines (warehouse_id);
create index if not exists tgd_stock_count_lines_location_id_idx
  on tgd_stock_count_lines (location_id);
create index if not exists tgd_stock_count_lines_pallet_id_idx
  on tgd_stock_count_lines (pallet_id);
create index if not exists tgd_stock_count_lines_count_status_idx
  on tgd_stock_count_lines (count_status);
create index if not exists tgd_stock_count_lines_scan_event_id_idx
  on tgd_stock_count_lines (scan_event_id);
create index if not exists tgd_stock_count_lines_adjustment_line_id_idx
  on tgd_stock_count_lines (adjustment_line_id);

drop trigger if exists set_tgd_stock_count_documents_updated_at on tgd_stock_count_documents;
create trigger set_tgd_stock_count_documents_updated_at
before update on tgd_stock_count_documents
for each row execute function set_updated_at();

drop trigger if exists set_tgd_stock_count_lines_updated_at on tgd_stock_count_lines;
create trigger set_tgd_stock_count_lines_updated_at
before update on tgd_stock_count_lines
for each row execute function set_updated_at();

create or replace function tgd_complete_stock_count_document(
  p_stock_count_document_id uuid,
  p_completed_by uuid default null
)
returns table (completed_stock_count_document_id uuid, completed_stock_count_no text)
language plpgsql
as $$
declare
  v_document tgd_stock_count_documents%rowtype;
  v_line_count integer;
  v_audit_log_id uuid;
begin
  select *
  into v_document
  from tgd_stock_count_documents
  where id = p_stock_count_document_id
  for update;

  if v_document.id is null then
    raise exception 'stock count document not found';
  end if;

  if v_document.status in ('CANCELLED', 'APPROVED', 'ADJUSTMENT_CREATED') then
    raise exception 'stock count document status % cannot be completed', v_document.status;
  end if;

  select count(*)
  into v_line_count
  from tgd_stock_count_lines
  where stock_count_document_id = v_document.id;

  if v_line_count = 0 then
    raise exception 'stock count document has no lines';
  end if;

  if exists (
    select 1
    from tgd_stock_count_lines
    where stock_count_document_id = v_document.id
      and counted_qty is null
      and count_status <> 'SKIPPED'
  ) then
    raise exception 'all non-skipped stock count lines must have counted_qty';
  end if;

  update tgd_stock_count_lines count_line
  set expected_qty = coalesce(balance.qty_on_hand, count_line.expected_qty)
  from tgd_stock_balances balance
  where count_line.stock_count_document_id = v_document.id
    and count_line.customer_id = balance.customer_id
    and count_line.product_id = balance.product_id
    and coalesce(count_line.lot_id, '00000000-0000-0000-0000-000000000000'::uuid)
      = coalesce(balance.lot_id, '00000000-0000-0000-0000-000000000000'::uuid)
    and count_line.warehouse_id = balance.warehouse_id
    and count_line.location_id = balance.location_id
    and coalesce(count_line.pallet_id, '00000000-0000-0000-0000-000000000000'::uuid)
      = coalesce(balance.pallet_id, '00000000-0000-0000-0000-000000000000'::uuid);

  update tgd_stock_count_lines
  set variance_qty = counted_qty - expected_qty,
      count_status = case
        when count_status = 'SKIPPED' then 'SKIPPED'
        when counted_qty = 0 and expected_qty > 0 then 'ZERO_COUNT'
        when counted_qty - expected_qty = 0 then 'COUNTED'
        else 'VARIANCE'
      end,
      counted_at = case
        when counted_at is null and count_status <> 'SKIPPED' then now()
        else counted_at
      end,
      counted_by = case
        when counted_by is null and count_status <> 'SKIPPED' and p_completed_by is not null then p_completed_by
        else counted_by
      end
  where stock_count_document_id = v_document.id;

  update tgd_stock_count_documents
  set status = 'COUNTED',
      completed_at = now(),
      completed_by = p_completed_by
  where id = v_document.id;

  select tgd_write_audit_log(
    jsonb_build_object(
      'entity_type', 'tgd_stock_count_documents',
      'entity_id', v_document.id,
      'action', 'COMPLETE',
      'old_value', jsonb_build_object('status', v_document.status),
      'new_value', jsonb_build_object('status', 'COUNTED'),
      'metadata', jsonb_build_object(
        'stock_count_no', v_document.stock_count_no,
        'warehouse_id', v_document.warehouse_id,
        'line_count', v_line_count,
        'count_type', v_document.count_type
      ),
      'performed_by', p_completed_by,
      'request_id', v_document.stock_count_no
    )
  ) into v_audit_log_id;

  completed_stock_count_document_id := v_document.id;
  completed_stock_count_no := v_document.stock_count_no;
  return next;
end;
$$;

create or replace function tgd_create_adjustment_from_stock_count(
  p_stock_count_document_id uuid,
  p_created_by uuid default null
)
returns uuid
language plpgsql
as $$
declare
  v_document tgd_stock_count_documents%rowtype;
  v_line tgd_stock_count_lines%rowtype;
  v_adjustment_document_id uuid;
  v_adjustment_line_id uuid;
  v_adjustment_no text;
  v_adjustment_type text;
  v_customer_id uuid;
  v_variance_count integer;
  v_line_no integer := 0;
  v_audit_log_id uuid;
begin
  select *
  into v_document
  from tgd_stock_count_documents
  where id = p_stock_count_document_id
  for update;

  if v_document.id is null then
    raise exception 'stock count document not found';
  end if;

  if v_document.status not in ('COUNTED', 'APPROVED') then
    raise exception 'stock count document status % cannot create adjustment', v_document.status;
  end if;

  select count(*)
  into v_variance_count
  from tgd_stock_count_lines
  where stock_count_document_id = v_document.id
    and count_status <> 'SKIPPED'
    and coalesce(variance_qty, 0) <> 0;

  if v_variance_count = 0 then
    raise exception 'stock count document has no variance lines';
  end if;

  if exists (
    select 1
    from tgd_stock_count_lines
    where stock_count_document_id = v_document.id
      and count_status <> 'SKIPPED'
      and coalesce(variance_qty, 0) <> 0
      and (customer_id is null or location_id is null)
  ) then
    raise exception 'variance lines require customer_id and location_id to create adjustment';
  end if;

  select min(customer_id)
  into v_customer_id
  from tgd_stock_count_lines
  where stock_count_document_id = v_document.id
    and count_status <> 'SKIPPED'
    and coalesce(variance_qty, 0) <> 0;

  v_adjustment_type := case
    when exists (
      select 1 from tgd_stock_count_lines
      where stock_count_document_id = v_document.id
        and count_status <> 'SKIPPED'
        and coalesce(variance_qty, 0) > 0
    )
    and not exists (
      select 1 from tgd_stock_count_lines
      where stock_count_document_id = v_document.id
        and count_status <> 'SKIPPED'
        and coalesce(variance_qty, 0) < 0
    ) then 'STOCK_COUNT_GAIN'
    when exists (
      select 1 from tgd_stock_count_lines
      where stock_count_document_id = v_document.id
        and count_status <> 'SKIPPED'
        and coalesce(variance_qty, 0) < 0
    )
    and not exists (
      select 1 from tgd_stock_count_lines
      where stock_count_document_id = v_document.id
        and count_status <> 'SKIPPED'
        and coalesce(variance_qty, 0) > 0
    ) then 'STOCK_COUNT_LOSS'
    else 'SYSTEM_CORRECTION'
  end;

  v_adjustment_no := 'ADJ-' || v_document.stock_count_no;

  insert into tgd_adjustment_documents (
    adjustment_no,
    customer_id,
    warehouse_id,
    adjustment_type,
    status,
    source_type,
    source_no,
    source_id,
    adjustment_date,
    remark,
    created_by
  )
  values (
    v_adjustment_no,
    v_customer_id,
    v_document.warehouse_id,
    v_adjustment_type,
    'DRAFT',
    'STOCK_COUNT',
    v_document.stock_count_no,
    v_document.id,
    current_date,
    'Draft adjustment generated from stock count ' || v_document.stock_count_no,
    p_created_by
  )
  returning id into v_adjustment_document_id;

  for v_line in
    select *
    from tgd_stock_count_lines
    where stock_count_document_id = v_document.id
      and count_status <> 'SKIPPED'
      and coalesce(variance_qty, 0) <> 0
    order by line_no
  loop
    v_line_no := v_line_no + 1;

    insert into tgd_adjustment_lines (
      adjustment_document_id,
      line_no,
      product_id,
      lot_id,
      warehouse_id,
      location_id,
      pallet_id,
      adjustment_direction,
      adjustment_qty,
      uom,
      reason_code,
      remark
    )
    values (
      v_adjustment_document_id,
      v_line_no,
      v_line.product_id,
      v_line.lot_id,
      v_line.warehouse_id,
      v_line.location_id,
      v_line.pallet_id,
      case when v_line.variance_qty > 0 then 'IN' else 'OUT' end,
      abs(v_line.variance_qty),
      v_line.uom,
      coalesce(v_line.variance_reason, v_adjustment_type),
      'Stock count line ' || v_line.line_no || ' from ' || v_document.stock_count_no
    )
    returning id into v_adjustment_line_id;

    update tgd_stock_count_lines
    set adjustment_line_id = v_adjustment_line_id
    where id = v_line.id;
  end loop;

  update tgd_stock_count_documents
  set status = 'ADJUSTMENT_CREATED'
  where id = v_document.id;

  select tgd_write_audit_log(
    jsonb_build_object(
      'entity_type', 'tgd_stock_count_documents',
      'entity_id', v_document.id,
      'action', 'CREATE_ADJUSTMENT_DRAFT',
      'old_value', jsonb_build_object('status', v_document.status),
      'new_value', jsonb_build_object(
        'status', 'ADJUSTMENT_CREATED',
        'adjustment_document_id', v_adjustment_document_id
      ),
      'metadata', jsonb_build_object(
        'stock_count_no', v_document.stock_count_no,
        'adjustment_no', v_adjustment_no,
        'variance_count', v_variance_count,
        'adjustment_type', v_adjustment_type
      ),
      'performed_by', p_created_by,
      'request_id', v_document.stock_count_no
    )
  ) into v_audit_log_id;

  return v_adjustment_document_id;
end;
$$;
