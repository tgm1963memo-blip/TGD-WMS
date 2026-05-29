create table if not exists tgd_barcode_aliases (
  id uuid primary key default gen_random_uuid(),
  barcode_value text not null,
  entity_type text not null,
  entity_id uuid not null,
  barcode_type text not null default 'PRIMARY',
  label text,
  is_active boolean not null default true,
  created_by uuid references tgd_user_profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tgd_barcode_aliases_entity_type_check check (
    entity_type in (
      'PRODUCT',
      'LOCATION',
      'PALLET',
      'LOT',
      'RECEIVING_DOCUMENT',
      'RECEIVING_LINE',
      'PUTAWAY_DOCUMENT',
      'PUTAWAY_LINE',
      'TRANSFER_DOCUMENT',
      'TRANSFER_LINE',
      'ADJUSTMENT_DOCUMENT',
      'ADJUSTMENT_LINE',
      'WITHDRAWAL_REQUEST',
      'WITHDRAWAL_REQUEST_LINE',
      'WITHDRAWAL_ALLOCATION',
      'WITHDRAWAL_ALLOCATION_LINE',
      'PICKING_DOCUMENT',
      'PICKING_LINE',
      'DISPATCH_DOCUMENT',
      'DISPATCH_LINE',
      'USER',
      'OTHER'
    )
  ),
  constraint tgd_barcode_aliases_barcode_type_check check (
    barcode_type in (
      'PRIMARY',
      'ALIAS',
      'SUPPLIER',
      'CUSTOMER',
      'INTERNAL',
      'HANDHELD_LABEL',
      'OTHER'
    )
  ),
  constraint tgd_barcode_aliases_value_not_empty check (length(btrim(barcode_value)) > 0),
  constraint tgd_barcode_aliases_value_entity_unique unique (barcode_value, entity_type, entity_id)
);

create table if not exists tgd_barcode_scan_events (
  id uuid primary key default gen_random_uuid(),
  scan_value text not null,
  resolved_entity_type text,
  resolved_entity_id uuid,
  scan_context text not null default 'GENERAL',
  scan_result text not null default 'UNRESOLVED',
  scan_source text not null default 'WEB',
  device_id text,
  user_profile_id uuid references tgd_user_profiles(id),
  auth_user_id uuid,
  related_document_type text,
  related_document_id uuid,
  related_line_id uuid,
  metadata jsonb,
  error_message text,
  scanned_at timestamptz not null default now(),
  constraint tgd_barcode_scan_events_context_check check (
    scan_context in (
      'GENERAL',
      'RECEIVING',
      'PUTAWAY',
      'TRANSFER',
      'ADJUSTMENT',
      'WITHDRAWAL',
      'ALLOCATION',
      'PICKING',
      'DISPATCH',
      'STOCK_COUNT',
      'LOGIN',
      'OTHER'
    )
  ),
  constraint tgd_barcode_scan_events_result_check check (
    scan_result in ('RESOLVED', 'UNRESOLVED', 'AMBIGUOUS', 'ERROR', 'IGNORED')
  ),
  constraint tgd_barcode_scan_events_source_check check (
    scan_source in ('WEB', 'HANDHELD', 'MOBILE', 'API', 'SYSTEM', 'OTHER')
  )
);

create index if not exists tgd_barcode_aliases_barcode_value_idx
  on tgd_barcode_aliases (barcode_value);
create index if not exists tgd_barcode_aliases_entity_idx
  on tgd_barcode_aliases (entity_type, entity_id);
create index if not exists tgd_barcode_aliases_is_active_idx
  on tgd_barcode_aliases (is_active);

create index if not exists tgd_barcode_scan_events_scan_value_idx
  on tgd_barcode_scan_events (scan_value);
create index if not exists tgd_barcode_scan_events_resolved_entity_idx
  on tgd_barcode_scan_events (resolved_entity_type, resolved_entity_id);
create index if not exists tgd_barcode_scan_events_context_idx
  on tgd_barcode_scan_events (scan_context);
create index if not exists tgd_barcode_scan_events_result_idx
  on tgd_barcode_scan_events (scan_result);
create index if not exists tgd_barcode_scan_events_source_idx
  on tgd_barcode_scan_events (scan_source);
create index if not exists tgd_barcode_scan_events_user_profile_id_idx
  on tgd_barcode_scan_events (user_profile_id);
create index if not exists tgd_barcode_scan_events_auth_user_id_idx
  on tgd_barcode_scan_events (auth_user_id);
create index if not exists tgd_barcode_scan_events_related_document_idx
  on tgd_barcode_scan_events (related_document_type, related_document_id);
create index if not exists tgd_barcode_scan_events_scanned_at_idx
  on tgd_barcode_scan_events (scanned_at);

drop trigger if exists set_tgd_barcode_aliases_updated_at on tgd_barcode_aliases;
create trigger set_tgd_barcode_aliases_updated_at
before update on tgd_barcode_aliases
for each row execute function set_updated_at();

create or replace function tgd_resolve_barcode(p_scan_value text)
returns table (
  scan_result text,
  entity_type text,
  entity_id uuid,
  source text,
  matches jsonb
)
language plpgsql
stable
as $$
declare
  v_scan_value text := btrim(coalesce(p_scan_value, ''));
  v_match_count integer;
begin
  if v_scan_value = '' then
    raise exception 'scan value must not be empty';
  end if;

  select count(*)
  into v_match_count
  from tgd_barcode_aliases alias
  where alias.is_active = true
    and alias.barcode_value = v_scan_value;

  if v_match_count = 1 then
    return query
    select
      'RESOLVED'::text,
      alias.entity_type,
      alias.entity_id,
      'ALIAS'::text,
      jsonb_build_array(
        jsonb_build_object(
          'entity_type', alias.entity_type,
          'entity_id', alias.entity_id,
          'barcode_type', alias.barcode_type,
          'label', alias.label
        )
      )
    from tgd_barcode_aliases alias
    where alias.is_active = true
      and alias.barcode_value = v_scan_value
    limit 1;
    return;
  end if;

  if v_match_count > 1 then
    return query
    select
      'AMBIGUOUS'::text,
      null::text,
      null::uuid,
      'ALIAS'::text,
      jsonb_agg(
        jsonb_build_object(
          'entity_type', alias.entity_type,
          'entity_id', alias.entity_id,
          'barcode_type', alias.barcode_type,
          'label', alias.label
        )
        order by alias.entity_type, alias.entity_id
      )
    from tgd_barcode_aliases alias
    where alias.is_active = true
      and alias.barcode_value = v_scan_value;
    return;
  end if;

  with master_matches as (
    select 'PRODUCT'::text as entity_type, product.id as entity_id
    from tgd_products product
    where product.barcode = v_scan_value
    union all
    select 'LOCATION'::text as entity_type, location.id as entity_id
    from tgd_locations location
    where location.barcode = v_scan_value
    union all
    select 'PALLET'::text as entity_type, pallet.id as entity_id
    from tgd_pallets pallet
    where pallet.barcode = v_scan_value
  )
  select count(*)
  into v_match_count
  from master_matches;

  if v_match_count = 1 then
    return query
    with master_matches as (
      select 'PRODUCT'::text as entity_type, product.id as entity_id
      from tgd_products product
      where product.barcode = v_scan_value
      union all
      select 'LOCATION'::text as entity_type, location.id as entity_id
      from tgd_locations location
      where location.barcode = v_scan_value
      union all
      select 'PALLET'::text as entity_type, pallet.id as entity_id
      from tgd_pallets pallet
      where pallet.barcode = v_scan_value
    )
    select
      'RESOLVED'::text,
      master_matches.entity_type,
      master_matches.entity_id,
      'MASTER'::text,
      jsonb_build_array(
        jsonb_build_object(
          'entity_type', master_matches.entity_type,
          'entity_id', master_matches.entity_id
        )
      )
    from master_matches
    limit 1;
    return;
  end if;

  if v_match_count > 1 then
    return query
    with master_matches as (
      select 'PRODUCT'::text as entity_type, product.id as entity_id
      from tgd_products product
      where product.barcode = v_scan_value
      union all
      select 'LOCATION'::text as entity_type, location.id as entity_id
      from tgd_locations location
      where location.barcode = v_scan_value
      union all
      select 'PALLET'::text as entity_type, pallet.id as entity_id
      from tgd_pallets pallet
      where pallet.barcode = v_scan_value
    )
    select
      'AMBIGUOUS'::text,
      null::text,
      null::uuid,
      'MASTER'::text,
      jsonb_agg(
        jsonb_build_object(
          'entity_type', master_matches.entity_type,
          'entity_id', master_matches.entity_id
        )
        order by master_matches.entity_type, master_matches.entity_id
      )
    from master_matches;
    return;
  end if;

  scan_result := 'UNRESOLVED';
  entity_type := null;
  entity_id := null;
  source := null;
  matches := '[]'::jsonb;
  return next;
end;
$$;

create or replace function tgd_log_barcode_scan(input jsonb)
returns table (
  scan_event_id uuid,
  scan_result text,
  resolved_entity_type text,
  resolved_entity_id uuid
)
language plpgsql
as $$
declare
  v_scan_value text := coalesce(input->>'scan_value', '');
  v_scan_result text := 'UNRESOLVED';
  v_entity_type text;
  v_entity_id uuid;
  v_error_message text;
begin
  begin
    select resolved.scan_result, resolved.entity_type, resolved.entity_id
    into v_scan_result, v_entity_type, v_entity_id
    from tgd_resolve_barcode(v_scan_value) resolved
    limit 1;
  exception
    when others then
      v_error_message := sqlerrm;
      v_scan_result := 'ERROR';
      v_entity_type := null;
      v_entity_id := null;
  end;

  insert into tgd_barcode_scan_events (
    scan_value,
    resolved_entity_type,
    resolved_entity_id,
    scan_context,
    scan_result,
    scan_source,
    device_id,
    user_profile_id,
    auth_user_id,
    related_document_type,
    related_document_id,
    related_line_id,
    metadata,
    error_message
  )
  values (
    v_scan_value,
    v_entity_type,
    v_entity_id,
    coalesce(nullif(input->>'scan_context', ''), 'GENERAL'),
    coalesce(v_scan_result, 'UNRESOLVED'),
    coalesce(nullif(input->>'scan_source', ''), 'WEB'),
    input->>'device_id',
    nullif(input->>'user_profile_id', '')::uuid,
    nullif(input->>'auth_user_id', '')::uuid,
    input->>'related_document_type',
    nullif(input->>'related_document_id', '')::uuid,
    nullif(input->>'related_line_id', '')::uuid,
    input->'metadata',
    v_error_message
  )
  returning id into scan_event_id;

  scan_result := coalesce(v_scan_result, 'UNRESOLVED');
  resolved_entity_type := v_entity_type;
  resolved_entity_id := v_entity_id;
  return next;
end;
$$;
