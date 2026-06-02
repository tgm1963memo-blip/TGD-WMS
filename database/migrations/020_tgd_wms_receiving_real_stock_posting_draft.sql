-- 020_tgd_wms_receiving_real_stock_posting_draft.sql
-- Sprint 13J-O: Receiving Real Stock Posting Migration Draft.
-- DRAFT ONLY. Do not apply without explicit Controller approval.
-- Staging apply requires Controller approval.
-- Production locked.
-- Receiving UI remains locked.
-- Frontend direct table insert/update/delete is prohibited.
-- No UI enable in this migration.
-- No production apply.
-- No direct frontend table writes.

-- ============================================================================
-- A. Schema additions
-- ============================================================================

-- A1. Add location_id to tgd_receiving_lines if not exists.
-- Design decision: Option A – store location_id on each receiving line.
-- The active receiving RPCs (018) use tgd_receiving_lines.document_id as FK.
-- Migration 004 defines a separate receiving_lines with to_location_id already.
-- This ALTER targets the 001 baseline schema which does not have location_id.
do $$
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'tgd_receiving_lines'
      and column_name = 'location_id'
  ) then
    alter table public.tgd_receiving_lines
      add column location_id uuid references public.tgd_locations(id);
    -- NOTE: location_id is nullable initially to avoid breaking existing rows.
    -- Future migration should backfill and add NOT NULL constraint after data is populated.
    raise notice 'Added location_id to tgd_receiving_lines';
  else
    raise notice 'location_id already exists on tgd_receiving_lines – skipping';
  end if;
end;
$$;

-- A2. Add source reference columns to tgd_stock_movements if not exists.
-- These columns enable the duplicate posting guard.
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'tgd_stock_movements'
      and column_name = 'source_module'
  ) then
    alter table public.tgd_stock_movements
      add column source_module text;
    raise notice 'Added source_module to tgd_stock_movements';
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'tgd_stock_movements'
      and column_name = 'source_document_id'
  ) then
    alter table public.tgd_stock_movements
      add column source_document_id uuid;
    raise notice 'Added source_document_id to tgd_stock_movements';
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'tgd_stock_movements'
      and column_name = 'source_line_id'
  ) then
    alter table public.tgd_stock_movements
      add column source_line_id uuid;
    raise notice 'Added source_line_id to tgd_stock_movements';
  end if;
end;
$$;

-- ============================================================================
-- B. Duplicate posting guard – partial unique index
-- ============================================================================

-- Only applies when all three source columns are populated.
-- This prevents a second posting of the same receiving line.
create unique index if not exists tgd_stock_movements_source_unique_idx
  on public.tgd_stock_movements (source_module, source_document_id, source_line_id)
  where source_module is not null
    and source_document_id is not null
    and source_line_id is not null;

-- ============================================================================
-- C. Dry-run RPC
-- ============================================================================

create or replace function public.tgd_rpc_post_receiving_document_dry(
  p_document_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_profile record;
  v_document record;
  v_line_count integer;
  v_invalid_lines jsonb := '[]'::jsonb;
  v_line record;
  v_existing_count integer;
  v_result jsonb;
begin
  -- 1. Auth check
  if v_user_id is null then
    return jsonb_build_object(
      'valid', false,
      'error', 'Authentication required (auth.uid() is null)'
    );
  end if;

  -- 2. Active profile check
  select p.id, p.auth_user_id, p.role, p.customer_id, p.is_active
  into v_profile
  from public.tgd_user_profiles p
  where p.auth_user_id = v_user_id
    and p.is_active = true
  limit 1;

  if not found then
    return jsonb_build_object(
      'valid', false,
      'error', 'Active user profile not found'
    );
  end if;

  -- 3. Role check – admin / warehouse_manager only
  if v_profile.role not in ('admin', 'warehouse_manager') then
    return jsonb_build_object(
      'valid', false,
      'error', format('Role %s is not allowed to post receiving documents', v_profile.role)
    );
  end if;

  -- 4. Load receiving document (read only – no FOR UPDATE in dry run)
  select d.id, d.customer_id, d.status
  into v_document
  from public.tgd_receiving_documents d
  where d.id = p_document_id;

  if not found then
    return jsonb_build_object(
      'valid', false,
      'error', 'Receiving document not found'
    );
  end if;

  -- 5. Status check
  if v_document.status <> 'DRAFT' then
    return jsonb_build_object(
      'valid', false,
      'error', format('Document status is %s – only DRAFT can be posted', v_document.status)
    );
  end if;

  -- 6. Customer isolation
  if v_profile.customer_id is not null and v_profile.customer_id <> v_document.customer_id then
    return jsonb_build_object(
      'valid', false,
      'error', 'Customer isolation violation'
    );
  end if;

  -- 7. Line count
  select count(*)
  into v_line_count
  from public.tgd_receiving_lines l
  where l.document_id = v_document.id;

  if v_line_count = 0 then
    return jsonb_build_object(
      'valid', false,
      'error', 'Receiving document has no lines'
    );
  end if;

  -- 8. Validate each line
  for v_line in
    select l.id, l.product_id, l.lot_id, l.location_id, l.quantity
    from public.tgd_receiving_lines l
    where l.document_id = v_document.id
  loop
    if v_line.product_id is null then
      v_invalid_lines := v_invalid_lines || jsonb_build_object('line_id', v_line.id, 'issue', 'missing product_id');
    end if;
    if v_line.lot_id is null then
      v_invalid_lines := v_invalid_lines || jsonb_build_object('line_id', v_line.id, 'issue', 'missing lot_id');
    end if;
    if v_line.location_id is null then
      v_invalid_lines := v_invalid_lines || jsonb_build_object('line_id', v_line.id, 'issue', 'missing location_id');
    end if;
    if v_line.quantity is null or v_line.quantity <= 0 then
      v_invalid_lines := v_invalid_lines || jsonb_build_object('line_id', v_line.id, 'issue', 'quantity must be greater than zero');
    end if;
  end loop;

  if jsonb_array_length(v_invalid_lines) > 0 then
    return jsonb_build_object(
      'valid', false,
      'error', 'Line validation failures',
      'invalid_lines', v_invalid_lines
    );
  end if;

  -- 9. Duplicate posting guard check
  select count(*)
  into v_existing_count
  from public.tgd_stock_movements m
  where m.source_module = 'RECEIVING'
    and m.source_document_id = p_document_id;

  if v_existing_count > 0 then
    return jsonb_build_object(
      'valid', false,
      'error', format('Duplicate posting detected: %s movements already exist for this document', v_existing_count)
    );
  end if;

  -- 10. All checks passed – dry run does NOT insert, update, or delete anything.
  -- No insert into tgd_stock_movements.
  -- No update to tgd_receiving_documents.
  -- No delete from any table.
  return jsonb_build_object(
    'valid', true,
    'document_id', p_document_id,
    'line_count', v_line_count,
    'message', 'Dry run passed – document is ready for posting'
  );
end;
$$;

-- ============================================================================
-- D. Post RPC
-- ============================================================================

create or replace function public.tgd_rpc_post_receiving_document(
  p_document_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_profile record;
  v_document record;
  v_line_count integer;
  v_line record;
  v_existing_count integer;
begin
  -- 1. Auth check
  if v_user_id is null then
    raise exception 'Authentication required (auth.uid() is null)';
  end if;

  -- 2. Active profile check
  select p.id, p.auth_user_id, p.role, p.customer_id, p.is_active
  into v_profile
  from public.tgd_user_profiles p
  where p.auth_user_id = v_user_id
    and p.is_active = true
  limit 1;

  if not found then
    raise exception 'Active user profile not found';
  end if;

  -- 3. Role check – admin / warehouse_manager only
  if v_profile.role not in ('admin', 'warehouse_manager') then
    raise exception 'Role % is not allowed to post receiving documents', v_profile.role;
  end if;

  -- 4. Load and lock document row FOR UPDATE
  select d.id, d.customer_id, d.status
  into v_document
  from public.tgd_receiving_documents d
  where d.id = p_document_id
  for update;

  if not found then
    raise exception 'Receiving document not found';
  end if;

  -- 5. Status check
  if v_document.status <> 'DRAFT' then
    raise exception 'Document status is % – only DRAFT can be posted', v_document.status;
  end if;

  -- 6. Customer isolation
  if v_profile.customer_id is not null and v_profile.customer_id <> v_document.customer_id then
    raise exception 'Customer isolation violation';
  end if;

  -- 7. Advisory lock to serialize per-document
  perform pg_advisory_xact_lock(hashtext(p_document_id::text));

  -- 8. Line count validation
  select count(*)
  into v_line_count
  from public.tgd_receiving_lines l
  where l.document_id = v_document.id;

  if v_line_count = 0 then
    raise exception 'Receiving document has no lines';
  end if;

  -- 9. Validate ALL lines before inserting any stock movement
  if exists (
    select 1
    from public.tgd_receiving_lines l
    where l.document_id = v_document.id
      and (
        l.product_id is null
        or l.lot_id is null
        or l.location_id is null
        or l.quantity is null
        or l.quantity <= 0
      )
  ) then
    raise exception 'One or more receiving lines are missing product_id, lot_id, location_id, or have invalid quantity';
  end if;

  -- 10. Duplicate posting guard – check before inserting any movement
  select count(*)
  into v_existing_count
  from public.tgd_stock_movements m
  where m.source_module = 'RECEIVING'
    and m.source_document_id = p_document_id;

  if v_existing_count > 0 then
    raise exception 'Duplicate posting detected: movements already exist for document %', p_document_id;
  end if;

  -- 11. Insert one tgd_stock_movements row per receiving line
  for v_line in
    select l.id, l.product_id, l.lot_id, l.location_id, l.quantity, l.weight
    from public.tgd_receiving_lines l
    where l.document_id = v_document.id
  loop
    insert into public.tgd_stock_movements (
      id,
      customer_id,
      product_id,
      lot_id,
      from_location_id,
      to_location_id,
      quantity,
      weight,
      movement_type,
      movement_date,
      related_document_id,
      source_module,
      source_document_id,
      source_line_id,
      created_at,
      updated_at
    ) values (
      gen_random_uuid(),
      v_document.customer_id,
      v_line.product_id,
      v_line.lot_id,
      null,                     -- from_location_id is null for inbound
      v_line.location_id,       -- to_location_id = line.location_id
      v_line.quantity,
      v_line.weight,
      'RECEIVE_CONFIRM',
      now(),
      p_document_id,
      'RECEIVING',
      p_document_id,
      v_line.id,
      now(),
      now()
    );
  end loop;

  -- 12. Update receiving document status ONLY AFTER all movement inserts succeed.
  -- No direct update to tgd_stock_balances – balance is maintained by the existing
  -- trigger (tgd_trigger_update_stock_balance) on tgd_stock_movements insert.
  update public.tgd_receiving_documents
  set status = 'CONFIRMED',
      updated_at = now()
  where id = p_document_id;

  return p_document_id;
end;
$$;

-- ============================================================================
-- E. Grants
-- ============================================================================

-- Revoke from public and anon to ensure only authenticated users can call.
revoke execute on function public.tgd_rpc_post_receiving_document_dry(uuid) from public;
revoke execute on function public.tgd_rpc_post_receiving_document(uuid) from public;
revoke execute on function public.tgd_rpc_post_receiving_document_dry(uuid) from anon;
revoke execute on function public.tgd_rpc_post_receiving_document(uuid) from anon;

-- Grant to authenticated only.
grant execute on function public.tgd_rpc_post_receiving_document_dry(uuid) to authenticated;
grant execute on function public.tgd_rpc_post_receiving_document(uuid) to authenticated;

-- ============================================================================
-- F. Comments
-- ============================================================================

comment on function public.tgd_rpc_post_receiving_document_dry(uuid)
is 'Sprint 13J-O draft. Dry-run validation for receiving stock posting. Returns jsonb report. Does not insert/update/delete. Production locked.';

comment on function public.tgd_rpc_post_receiving_document(uuid)
is 'Sprint 13J-O draft. Posts receiving document by inserting stock movements and updating document status. Production locked. Receiving UI remains locked.';

-- ============================================================================
-- G. Explicit non-goals
-- ============================================================================
-- No UI enable – Receiving page remains locked.
-- No production apply – this migration is a draft only.
-- No direct frontend table writes – all writes go through RPCs only.
-- Stock balance is NOT directly updated by this RPC; the existing trigger handles it.
