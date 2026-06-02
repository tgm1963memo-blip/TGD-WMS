-- Add missing audit columns if they do not exist due to 001/004 IF NOT EXISTS conflict
alter table public.tgd_receiving_documents add column if not exists created_by uuid references public.tgd_user_profiles(id);
alter table public.tgd_receiving_documents add column if not exists posted_by uuid references public.tgd_user_profiles(id);
alter table public.tgd_receiving_documents add column if not exists posted_at timestamptz;
alter table public.tgd_stock_movements add column if not exists created_by uuid references public.tgd_user_profiles(id);
-- 024_tgd_wms_receiving_audit_rpc_patch.sql
-- Sprint 13J-AQ Receiving Audit RPC Patch Draft.
-- Staging review required. Production locked until Controller approval.
-- Do not apply this migration to production without explicit approval.
-- Patches receiving RPCs to properly populate audit user tracking fields.

-- ============================================================================
-- A. Create Draft RPC Patch
-- ============================================================================

create or replace function public.tgd_rpc_create_receiving_draft(
  p_customer_id uuid,
  p_document_no text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_profile record;
  v_new_document_id uuid;
begin
  if v_user_id is null then
    raise exception 'Authentication required for receiving draft creation';
  end if;

  select
    p.id,
    p.auth_user_id,
    p.role,
    p.customer_id,
    p.is_active
  into v_profile
  from public.tgd_user_profiles p
  where p.auth_user_id = v_user_id
    and p.is_active = true
  limit 1;

  if not found then
    raise exception 'Active user profile required for receiving draft creation';
  end if;

  if v_profile.role not in ('admin', 'warehouse_manager', 'warehouse_staff') then
    raise exception 'Role % is not allowed to create receiving drafts', v_profile.role;
  end if;

  if p_customer_id is null then
    raise exception 'customer_id is required for receiving draft creation';
  end if;

  if v_profile.role = 'warehouse_staff'
    and v_profile.customer_id is not null
    and v_profile.customer_id <> p_customer_id then
    raise exception 'Customer isolation violation for receiving draft creation';
  end if;

  if nullif(btrim(p_document_no), '') is null then
    raise exception 'document_no is required for receiving draft creation';
  end if;

  insert into public.tgd_receiving_documents (
    customer_id,
    document_no,
    status,
    created_by
  ) values (
    p_customer_id,
    btrim(p_document_no),
    'DRAFT',
    v_profile.id
  )
  returning id into v_new_document_id;

  return v_new_document_id;
end;
$$;

-- ============================================================================
-- B. Post Document RPC Patch
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
      created_by,
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
      v_profile.id,
      now(),
      now()
    );
  end loop;

  -- 12. Update receiving document status ONLY AFTER all movement inserts succeed.
  update public.tgd_receiving_documents
  set status = 'CONFIRMED',
      posted_by = v_profile.id,
      posted_at = now(),
      updated_at = now()
  where id = p_document_id;

  return p_document_id;
end;
$$;

