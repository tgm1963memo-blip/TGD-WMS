create table if not exists tgd_handheld_putaway_sessions (
  id uuid primary key default gen_random_uuid(),
  session_no text not null unique,
  putaway_document_id uuid not null references tgd_putaway_documents(id),
  warehouse_id uuid not null references tgd_warehouses(id),
  status text not null default 'OPEN',
  device_id text,
  operator_id uuid references tgd_user_profiles(id),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  completed_by uuid references tgd_user_profiles(id),
  cancelled_at timestamptz,
  cancelled_by uuid references tgd_user_profiles(id),
  cancel_reason text,
  remark text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tgd_handheld_putaway_sessions_status_check check (
    status in ('OPEN', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED')
  )
);

create table if not exists tgd_handheld_putaway_scans (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references tgd_handheld_putaway_sessions(id) on delete cascade,
  putaway_document_id uuid not null references tgd_putaway_documents(id),
  putaway_line_id uuid references tgd_putaway_lines(id),
  scan_event_id uuid references tgd_barcode_scan_events(id),
  scan_step text not null,
  scan_value text not null,
  resolved_entity_type text,
  resolved_entity_id uuid,
  scan_result text not null default 'UNRESOLVED',
  validation_status text not null default 'PENDING',
  expected_entity_type text,
  expected_entity_id uuid,
  product_id uuid references tgd_products(id),
  lot_id uuid references tgd_lots(id),
  pallet_id uuid references tgd_pallets(id),
  from_location_id uuid references tgd_locations(id),
  to_location_id uuid references tgd_locations(id),
  scanned_qty numeric,
  uom text,
  device_id text,
  operator_id uuid references tgd_user_profiles(id),
  error_message text,
  metadata jsonb,
  scanned_at timestamptz not null default now(),
  constraint tgd_handheld_putaway_scans_step_check check (
    scan_step in ('DOCUMENT', 'LINE', 'PRODUCT', 'LOT', 'PALLET', 'FROM_LOCATION', 'TO_LOCATION', 'QTY', 'CONFIRM', 'OTHER')
  ),
  constraint tgd_handheld_putaway_scans_validation_status_check check (
    validation_status in ('PENDING', 'VALID', 'INVALID', 'WARNING', 'SKIPPED')
  ),
  constraint tgd_handheld_putaway_scans_result_check check (
    scan_result in ('RESOLVED', 'UNRESOLVED', 'AMBIGUOUS', 'ERROR', 'IGNORED')
  ),
  constraint tgd_handheld_putaway_scans_value_not_empty check (length(btrim(scan_value)) > 0),
  constraint tgd_handheld_putaway_scans_qty_nonnegative check (
    scanned_qty is null or scanned_qty >= 0
  )
);

create index if not exists tgd_handheld_putaway_sessions_session_no_idx
  on tgd_handheld_putaway_sessions (session_no);
create index if not exists tgd_handheld_putaway_sessions_document_id_idx
  on tgd_handheld_putaway_sessions (putaway_document_id);
create index if not exists tgd_handheld_putaway_sessions_warehouse_id_idx
  on tgd_handheld_putaway_sessions (warehouse_id);
create index if not exists tgd_handheld_putaway_sessions_status_idx
  on tgd_handheld_putaway_sessions (status);
create index if not exists tgd_handheld_putaway_sessions_device_id_idx
  on tgd_handheld_putaway_sessions (device_id);
create index if not exists tgd_handheld_putaway_sessions_operator_id_idx
  on tgd_handheld_putaway_sessions (operator_id);

create index if not exists tgd_handheld_putaway_scans_session_id_idx
  on tgd_handheld_putaway_scans (session_id);
create index if not exists tgd_handheld_putaway_scans_document_id_idx
  on tgd_handheld_putaway_scans (putaway_document_id);
create index if not exists tgd_handheld_putaway_scans_line_id_idx
  on tgd_handheld_putaway_scans (putaway_line_id);
create index if not exists tgd_handheld_putaway_scans_event_id_idx
  on tgd_handheld_putaway_scans (scan_event_id);
create index if not exists tgd_handheld_putaway_scans_step_idx
  on tgd_handheld_putaway_scans (scan_step);
create index if not exists tgd_handheld_putaway_scans_result_idx
  on tgd_handheld_putaway_scans (scan_result);
create index if not exists tgd_handheld_putaway_scans_validation_status_idx
  on tgd_handheld_putaway_scans (validation_status);
create index if not exists tgd_handheld_putaway_scans_product_id_idx
  on tgd_handheld_putaway_scans (product_id);
create index if not exists tgd_handheld_putaway_scans_lot_id_idx
  on tgd_handheld_putaway_scans (lot_id);
create index if not exists tgd_handheld_putaway_scans_pallet_id_idx
  on tgd_handheld_putaway_scans (pallet_id);
create index if not exists tgd_handheld_putaway_scans_from_location_id_idx
  on tgd_handheld_putaway_scans (from_location_id);
create index if not exists tgd_handheld_putaway_scans_to_location_id_idx
  on tgd_handheld_putaway_scans (to_location_id);
create index if not exists tgd_handheld_putaway_scans_scanned_at_idx
  on tgd_handheld_putaway_scans (scanned_at);

drop trigger if exists set_tgd_handheld_putaway_sessions_updated_at on tgd_handheld_putaway_sessions;
create trigger set_tgd_handheld_putaway_sessions_updated_at
before update on tgd_handheld_putaway_sessions
for each row execute function set_updated_at();

create or replace function tgd_record_handheld_putaway_scan(input jsonb)
returns table (
  putaway_scan_id uuid,
  scan_event_id uuid,
  scan_result text,
  validation_status text,
  resolved_entity_type text,
  resolved_entity_id uuid
)
language plpgsql
as $$
declare
  v_session tgd_handheld_putaway_sessions%rowtype;
  v_line tgd_putaway_lines%rowtype;
  v_session_id uuid := nullif(input->>'session_id', '')::uuid;
  v_putaway_document_id uuid := nullif(input->>'putaway_document_id', '')::uuid;
  v_putaway_line_id uuid := nullif(input->>'putaway_line_id', '')::uuid;
  v_scan_step text := nullif(input->>'scan_step', '');
  v_scan_value text := btrim(coalesce(input->>'scan_value', ''));
  v_expected_entity_type text := nullif(input->>'expected_entity_type', '');
  v_expected_entity_id uuid := nullif(input->>'expected_entity_id', '')::uuid;
  v_scanned_qty numeric := nullif(input->>'scanned_qty', '')::numeric;
  v_uom text := nullif(input->>'uom', '');
  v_device_id text := nullif(input->>'device_id', '');
  v_operator_id uuid := nullif(input->>'operator_id', '')::uuid;
  v_metadata jsonb := input->'metadata';
  v_product_id uuid;
  v_lot_id uuid;
  v_pallet_id uuid;
  v_from_location_id uuid;
  v_to_location_id uuid;
  v_scan_event_id uuid;
  v_scan_result text;
  v_resolved_entity_type text;
  v_resolved_entity_id uuid;
  v_validation_status text;
  v_error_message text;
begin
  if v_session_id is null then
    raise exception 'session_id is required';
  end if;

  if v_putaway_document_id is null then
    raise exception 'putaway_document_id is required';
  end if;

  if v_scan_step is null then
    raise exception 'scan_step is required';
  end if;

  if v_scan_value = '' then
    raise exception 'scan_value must not be empty';
  end if;

  select *
  into v_session
  from tgd_handheld_putaway_sessions
  where id = v_session_id
  for update;

  if v_session.id is null then
    raise exception 'handheld putaway session not found';
  end if;

  if v_session.status in ('COMPLETED', 'CANCELLED') then
    raise exception 'handheld putaway session status % cannot accept scans', v_session.status;
  end if;

  if v_session.putaway_document_id <> v_putaway_document_id then
    raise exception 'putaway_document_id does not match session putaway document';
  end if;

  if v_putaway_line_id is not null then
    select *
    into v_line
    from tgd_putaway_lines
    where id = v_putaway_line_id
      and putaway_document_id = v_putaway_document_id;

    if v_line.id is null then
      raise exception 'putaway_line_id does not belong to putaway document';
    end if;
  end if;

  select logged.scan_event_id,
         logged.scan_result,
         logged.resolved_entity_type,
         logged.resolved_entity_id
  into v_scan_event_id,
       v_scan_result,
       v_resolved_entity_type,
       v_resolved_entity_id
  from tgd_log_barcode_scan(
    jsonb_build_object(
      'scan_value', v_scan_value,
      'scan_context', 'PUTAWAY',
      'scan_source', 'HANDHELD',
      'device_id', v_device_id,
      'user_profile_id', v_operator_id,
      'related_document_type', 'PUTAWAY_DOCUMENT',
      'related_document_id', v_putaway_document_id,
      'related_line_id', v_putaway_line_id,
      'metadata', coalesce(v_metadata, '{}'::jsonb)
    )
  ) logged
  limit 1;

  if v_expected_entity_type is null and v_expected_entity_id is null and v_line.id is not null then
    if v_scan_step = 'PRODUCT' then
      v_expected_entity_type := 'PRODUCT';
      v_expected_entity_id := v_line.product_id;
    elsif v_scan_step = 'LOT' and v_line.lot_id is not null then
      v_expected_entity_type := 'LOT';
      v_expected_entity_id := v_line.lot_id;
    elsif v_scan_step = 'PALLET' then
      v_expected_entity_type := 'PALLET';
      v_expected_entity_id := coalesce(v_line.to_pallet_id, v_line.from_pallet_id);
    elsif v_scan_step = 'FROM_LOCATION' then
      v_expected_entity_type := 'LOCATION';
      v_expected_entity_id := v_line.from_location_id;
    elsif v_scan_step = 'TO_LOCATION' then
      v_expected_entity_type := 'LOCATION';
      v_expected_entity_id := v_line.to_location_id;
    end if;
  end if;

  if v_scan_result = 'RESOLVED'
     and v_expected_entity_type is not null
     and v_expected_entity_id is not null
     and v_resolved_entity_type = v_expected_entity_type
     and v_resolved_entity_id = v_expected_entity_id then
    v_validation_status := 'VALID';
  elsif v_scan_result = 'RESOLVED'
     and v_expected_entity_type is null
     and v_expected_entity_id is null then
    v_validation_status := 'VALID';
  elsif v_scan_result = 'UNRESOLVED' then
    v_validation_status := 'WARNING';
    v_error_message := 'barcode scan was unresolved';
  elsif v_scan_result in ('AMBIGUOUS', 'ERROR') then
    v_validation_status := 'INVALID';
    v_error_message := 'barcode scan result is ' || v_scan_result;
  else
    v_validation_status := 'INVALID';
    v_error_message := 'resolved entity does not match expected entity';
  end if;

  if v_resolved_entity_type = 'PRODUCT' then
    v_product_id := v_resolved_entity_id;
  elsif v_resolved_entity_type = 'LOT' then
    v_lot_id := v_resolved_entity_id;
  elsif v_resolved_entity_type = 'PALLET' then
    v_pallet_id := v_resolved_entity_id;
  elsif v_resolved_entity_type = 'LOCATION' then
    if v_scan_step = 'FROM_LOCATION' then
      v_from_location_id := v_resolved_entity_id;
    else
      v_to_location_id := v_resolved_entity_id;
    end if;
  end if;

  insert into tgd_handheld_putaway_scans (
    session_id,
    putaway_document_id,
    putaway_line_id,
    scan_event_id,
    scan_step,
    scan_value,
    resolved_entity_type,
    resolved_entity_id,
    scan_result,
    validation_status,
    expected_entity_type,
    expected_entity_id,
    product_id,
    lot_id,
    pallet_id,
    from_location_id,
    to_location_id,
    scanned_qty,
    uom,
    device_id,
    operator_id,
    error_message,
    metadata
  )
  values (
    v_session_id,
    v_putaway_document_id,
    v_putaway_line_id,
    v_scan_event_id,
    v_scan_step,
    v_scan_value,
    v_resolved_entity_type,
    v_resolved_entity_id,
    coalesce(v_scan_result, 'UNRESOLVED'),
    v_validation_status,
    v_expected_entity_type,
    v_expected_entity_id,
    v_product_id,
    v_lot_id,
    v_pallet_id,
    v_from_location_id,
    v_to_location_id,
    v_scanned_qty,
    v_uom,
    v_device_id,
    v_operator_id,
    v_error_message,
    v_metadata
  )
  returning id into putaway_scan_id;

  if v_session.status = 'OPEN' then
    update tgd_handheld_putaway_sessions
    set status = 'IN_PROGRESS'
    where id = v_session_id;
  end if;

  scan_event_id := v_scan_event_id;
  scan_result := coalesce(v_scan_result, 'UNRESOLVED');
  validation_status := v_validation_status;
  resolved_entity_type := v_resolved_entity_type;
  resolved_entity_id := v_resolved_entity_id;
  return next;
end;
$$;

create or replace function tgd_complete_handheld_putaway_session(
  p_session_id uuid,
  p_completed_by uuid default null
)
returns table (completed_session_id uuid, completed_session_no text)
language plpgsql
as $$
declare
  v_session tgd_handheld_putaway_sessions%rowtype;
  v_scan_count integer;
  v_invalid_count integer;
  v_audit_log_id uuid;
begin
  select *
  into v_session
  from tgd_handheld_putaway_sessions
  where id = p_session_id
  for update;

  if v_session.id is null then
    raise exception 'handheld putaway session not found';
  end if;

  if v_session.status in ('COMPLETED', 'CANCELLED') then
    raise exception 'handheld putaway session status % cannot be completed', v_session.status;
  end if;

  select count(*)
  into v_scan_count
  from tgd_handheld_putaway_scans
  where session_id = v_session.id;

  if v_scan_count = 0 then
    raise exception 'handheld putaway session has no scans';
  end if;

  select count(*)
  into v_invalid_count
  from tgd_handheld_putaway_scans
  where session_id = v_session.id
    and validation_status = 'INVALID';

  if v_invalid_count > 0 then
    raise exception 'handheld putaway session has invalid scans';
  end if;

  update tgd_handheld_putaway_sessions
  set status = 'COMPLETED',
      completed_at = now(),
      completed_by = p_completed_by
  where id = v_session.id;

  select tgd_write_audit_log(
    jsonb_build_object(
      'entity_type', 'tgd_handheld_putaway_sessions',
      'entity_id', v_session.id,
      'action', 'COMPLETE',
      'old_value', jsonb_build_object('status', v_session.status),
      'new_value', jsonb_build_object('status', 'COMPLETED'),
      'metadata', jsonb_build_object(
        'session_no', v_session.session_no,
        'putaway_document_id', v_session.putaway_document_id,
        'scan_count', v_scan_count
      ),
      'performed_by', p_completed_by,
      'request_id', v_session.session_no
    )
  ) into v_audit_log_id;

  completed_session_id := v_session.id;
  completed_session_no := v_session.session_no;
  return next;
end;
$$;
