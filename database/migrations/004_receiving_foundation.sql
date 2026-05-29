create table if not exists tgd_receiving_documents (
  id uuid primary key default gen_random_uuid(),
  receiving_no text not null unique,
  customer_id uuid not null references tgd_customers(id),
  warehouse_id uuid not null references tgd_warehouses(id),
  receiving_type text not null default 'NORMAL',
  status text not null default 'DRAFT',
  source_type text,
  source_no text,
  supplier_name text,
  expected_receive_date date,
  actual_receive_at timestamptz,
  posted_at timestamptz,
  posted_by uuid references tgd_user_profiles(id),
  cancelled_at timestamptz,
  cancelled_by uuid references tgd_user_profiles(id),
  cancel_reason text,
  remark text,
  created_by uuid references tgd_user_profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tgd_receiving_documents_status_check check (
    status in ('DRAFT', 'CONFIRMED', 'POSTED', 'CANCELLED', 'REVERSED')
  ),
  constraint tgd_receiving_documents_type_check check (
    receiving_type in ('NORMAL', 'RETURN', 'OPENING_BALANCE', 'ADJUSTMENT_IN')
  )
);

create table if not exists tgd_receiving_lines (
  id uuid primary key default gen_random_uuid(),
  receiving_document_id uuid not null references tgd_receiving_documents(id) on delete cascade,
  line_no integer not null,
  product_id uuid not null references tgd_products(id),
  lot_id uuid references tgd_lots(id),
  lot_no text,
  mfg_date date,
  exp_date date,
  to_location_id uuid not null references tgd_locations(id),
  to_pallet_id uuid references tgd_pallets(id),
  expected_qty numeric,
  received_qty numeric not null default 0,
  uom text not null,
  condition_status text not null default 'GOOD',
  temperature_at_receive numeric,
  remark text,
  movement_id uuid references tgd_inventory_movements(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tgd_receiving_lines_document_line_unique unique (receiving_document_id, line_no),
  constraint tgd_receiving_lines_expected_qty_nonnegative check (
    expected_qty is null or expected_qty >= 0
  ),
  constraint tgd_receiving_lines_received_qty_nonnegative check (received_qty >= 0),
  constraint tgd_receiving_lines_condition_status_check check (
    condition_status in ('GOOD', 'DAMAGED', 'HOLD', 'REJECTED')
  )
);

create index if not exists tgd_receiving_documents_receiving_no_idx
  on tgd_receiving_documents (receiving_no);
create index if not exists tgd_receiving_documents_customer_id_idx
  on tgd_receiving_documents (customer_id);
create index if not exists tgd_receiving_documents_warehouse_id_idx
  on tgd_receiving_documents (warehouse_id);
create index if not exists tgd_receiving_documents_status_idx
  on tgd_receiving_documents (status);
create index if not exists tgd_receiving_documents_expected_receive_date_idx
  on tgd_receiving_documents (expected_receive_date);

create index if not exists tgd_receiving_lines_document_id_idx
  on tgd_receiving_lines (receiving_document_id);
create index if not exists tgd_receiving_lines_product_id_idx
  on tgd_receiving_lines (product_id);
create index if not exists tgd_receiving_lines_lot_id_idx
  on tgd_receiving_lines (lot_id);
create index if not exists tgd_receiving_lines_to_location_id_idx
  on tgd_receiving_lines (to_location_id);
create index if not exists tgd_receiving_lines_to_pallet_id_idx
  on tgd_receiving_lines (to_pallet_id);
create index if not exists tgd_receiving_lines_movement_id_idx
  on tgd_receiving_lines (movement_id);

drop trigger if exists set_tgd_receiving_documents_updated_at on tgd_receiving_documents;
create trigger set_tgd_receiving_documents_updated_at
before update on tgd_receiving_documents
for each row execute function set_updated_at();

drop trigger if exists set_tgd_receiving_lines_updated_at on tgd_receiving_lines;
create trigger set_tgd_receiving_lines_updated_at
before update on tgd_receiving_lines
for each row execute function set_updated_at();

create or replace function tgd_post_receiving_document(
  p_receiving_document_id uuid,
  p_posted_by uuid default null
)
returns table (posted_receiving_document_id uuid, posted_receiving_no text)
language plpgsql
as $$
declare
  v_document tgd_receiving_documents%rowtype;
  v_line tgd_receiving_lines%rowtype;
  v_line_count integer;
  v_lot_id uuid;
  v_movement_id uuid;
  v_movement_type text;
  v_audit_log_id uuid;
begin
  select *
  into v_document
  from tgd_receiving_documents
  where id = p_receiving_document_id
  for update;

  if v_document.id is null then
    raise exception 'receiving document not found';
  end if;

  if v_document.status in ('POSTED', 'CANCELLED', 'REVERSED') then
    raise exception 'receiving document status % cannot be posted', v_document.status;
  end if;

  select count(*)
  into v_line_count
  from tgd_receiving_lines
  where receiving_document_id = v_document.id;

  if v_line_count = 0 then
    raise exception 'receiving document has no lines';
  end if;

  if exists (
    select 1
    from tgd_receiving_lines
    where receiving_document_id = v_document.id
      and received_qty <= 0
  ) then
    raise exception 'all receiving lines must have received_qty greater than zero';
  end if;

  v_movement_type := case v_document.receiving_type
    when 'NORMAL' then 'RECEIVE'
    when 'RETURN' then 'RETURN_IN'
    when 'OPENING_BALANCE' then 'OPENING_BALANCE'
    when 'ADJUSTMENT_IN' then 'ADJUST_IN'
    else null
  end;

  if v_movement_type is null then
    raise exception 'unsupported receiving_type: %', v_document.receiving_type;
  end if;

  for v_line in
    select *
    from tgd_receiving_lines
    where receiving_document_id = v_document.id
    order by line_no
    for update
  loop
    v_lot_id := v_line.lot_id;

    if v_lot_id is null and nullif(v_line.lot_no, '') is not null then
      select id
      into v_lot_id
      from tgd_lots
      where product_id = v_line.product_id
        and lot_no = v_line.lot_no;

      if v_lot_id is null then
        insert into tgd_lots (
          product_id,
          lot_no,
          mfg_date,
          exp_date,
          received_date
        )
        values (
          v_line.product_id,
          v_line.lot_no,
          v_line.mfg_date,
          v_line.exp_date,
          current_date
        )
        returning id into v_lot_id;
      end if;
    end if;

    select posted.movement_id
    into v_movement_id
    from tgd_post_inventory_movement(
      jsonb_build_object(
        'movement_type', v_movement_type,
        'customer_id', v_document.customer_id,
        'product_id', v_line.product_id,
        'lot_id', v_lot_id,
        'to_warehouse_id', v_document.warehouse_id,
        'to_location_id', v_line.to_location_id,
        'to_pallet_id', v_line.to_pallet_id,
        'qty', v_line.received_qty,
        'uom', v_line.uom,
        'reference_type', 'RECEIVING',
        'reference_no', v_document.receiving_no,
        'reference_id', v_document.id,
        'remark', v_line.remark,
        'created_by', p_posted_by
      )
    ) as posted
    limit 1;

    update tgd_receiving_lines
    set lot_id = v_lot_id,
        movement_id = v_movement_id
    where id = v_line.id;
  end loop;

  update tgd_receiving_documents
  set status = 'POSTED',
      posted_at = now(),
      posted_by = p_posted_by,
      actual_receive_at = coalesce(actual_receive_at, now())
  where id = v_document.id;

  select tgd_write_audit_log(
    jsonb_build_object(
      'entity_type', 'tgd_receiving_documents',
      'entity_id', v_document.id,
      'action', 'POST',
      'old_value', jsonb_build_object('status', v_document.status),
      'new_value', jsonb_build_object('status', 'POSTED'),
      'metadata', jsonb_build_object(
        'receiving_no', v_document.receiving_no,
        'line_count', v_line_count,
        'movement_type', v_movement_type
      ),
      'performed_by', p_posted_by,
      'request_id', v_document.receiving_no
    )
  ) into v_audit_log_id;

  posted_receiving_document_id := v_document.id;
  posted_receiving_no := v_document.receiving_no;
  return next;
end;
$$;

