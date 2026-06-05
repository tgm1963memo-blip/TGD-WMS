-- 030_tgd_wms_post_outbound_rpc_draft.sql
-- Sprint 14Z: Post Outbound RPC draft only.
-- Do NOT apply to Staging or Production without a separate Controller approval gate.
-- No UI Post Outbound button is added in this sprint.
-- Stock mutation logic exists only inside this draft RPC and is not applied in this sprint.

-- ============================================================================
-- A. Safe additive schema for future outbound posting audit/idempotency
-- ============================================================================

alter table public.tgd_outbound_documents
  add column if not exists post_reference text;

alter table public.tgd_outbound_documents
  add column if not exists post_note text;

alter table public.tgd_outbound_reservations
  add column if not exists posted_quantity numeric not null default 0
    check (posted_quantity >= 0);

alter table public.tgd_outbound_reservations
  add column if not exists posted_weight numeric not null default 0
    check (posted_weight >= 0);

alter table public.tgd_outbound_reservations
  add column if not exists posted_at timestamptz;

alter table public.tgd_outbound_reservations
  add column if not exists posted_by uuid references public.tgd_user_profiles(id);

alter table public.tgd_outbound_reservations
  add column if not exists post_reference text;

alter table public.tgd_outbound_reservations
  add column if not exists post_note text;

-- Add outbound source references to movement ledger. Existing receiving source
-- columns are preserved; outbound requires reservation-level idempotency because
-- one line may have multiple reservations/locations.
alter table public.tgd_stock_movements
  add column if not exists source_reservation_id uuid;

alter table public.tgd_stock_movements
  add column if not exists source_reference text;

-- Receiving's older source unique index used source_line_id for all modules.
-- Re-scope it to RECEIVING so outbound can use reservation-level uniqueness
-- without colliding when a single line has multiple reservations.
drop index if exists public.tgd_stock_movements_source_unique_idx;

create unique index if not exists tgd_stock_movements_receiving_source_unique_idx
  on public.tgd_stock_movements (source_module, source_document_id, source_line_id)
  where source_module = 'RECEIVING'
    and source_document_id is not null
    and source_line_id is not null;

create unique index if not exists uq_tgd_outbound_documents_post_reference
  on public.tgd_outbound_documents (id, post_reference)
  where post_reference is not null and btrim(post_reference) <> '';

create unique index if not exists uq_tgd_outbound_reservations_post_reference
  on public.tgd_outbound_reservations (id, post_reference)
  where post_reference is not null and btrim(post_reference) <> '';

create unique index if not exists uq_tgd_stock_movements_outbound_reservation_post_reference
  on public.tgd_stock_movements (
    source_module,
    source_document_id,
    source_reservation_id,
    source_reference
  )
  where source_module = 'OUTBOUND_POST'
    and source_document_id is not null
    and source_reservation_id is not null
    and source_reference is not null
    and btrim(source_reference) <> '';

-- ============================================================================
-- B. Future Post Outbound RPC draft
-- ============================================================================

create or replace function public.tgd_rpc_post_outbound_document(
  p_outbound_document_id uuid,
  p_post_reference text,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_profile record;
  v_document public.tgd_outbound_documents%rowtype;
  v_post_reference text := nullif(btrim(p_post_reference), '');
  v_line_count integer;
  v_picked_reservation_count integer;
  v_existing_movement_count integer;
  v_reservation record;
  v_balance record;
  v_movement_id uuid;
  v_inserted_movement_count integer := 0;
  v_total_posted_quantity numeric := 0;
  v_total_posted_weight numeric := 0;
begin
  -- Authenticated active user required.
  if v_user_id is null then
    raise exception 'Authentication required (auth.uid() is null)';
  end if;

  select p.id, p.auth_user_id, p.role, p.customer_id, p.is_active
  into v_profile
  from public.tgd_user_profiles p
  where p.auth_user_id = v_user_id
    and p.is_active = true
  limit 1;

  if not found then
    raise exception 'Active user profile required for post outbound';
  end if;

  -- Authorized warehouse role required.
  if v_profile.role not in ('admin', 'warehouse_manager') then
    raise exception 'Role % is not authorized to post outbound documents', v_profile.role;
  end if;

  if p_outbound_document_id is null then
    raise exception 'outbound_document_id is required';
  end if;

  if v_post_reference is null then
    raise exception 'post_reference is required';
  end if;

  perform pg_advisory_xact_lock(hashtext('OUTBOUND_POST:' || p_outbound_document_id::text));

  select *
  into v_document
  from public.tgd_outbound_documents
  where id = p_outbound_document_id
  for update;

  if not found then
    raise exception 'Outbound document not found';
  end if;

  if v_profile.customer_id is not null and v_profile.customer_id <> v_document.customer_id then
    raise exception 'Customer isolation violation for outbound post';
  end if;

  -- Idempotent replay: already posted with same post_reference returns safe result.
  if v_document.status = 'CONFIRMED' then
    if v_document.post_reference = v_post_reference then
      select count(*)
      into v_existing_movement_count
      from public.tgd_stock_movements m
      where m.source_module = 'OUTBOUND_POST'
        and m.source_document_id = p_outbound_document_id
        and m.source_reference = v_post_reference;

      return jsonb_build_object(
        'status', 'CONFIRMED',
        'outbound_document_id', v_document.id,
        'post_reference', v_document.post_reference,
        'posted_at', v_document.posted_at,
        'posted_by', v_document.posted_by,
        'movement_count', v_existing_movement_count,
        'idempotent', true
      );
    end if;

    raise exception 'Outbound document already posted with a different post_reference';
  end if;

  if v_document.status <> 'PICKED' then
    raise exception 'Outbound document must be PICKED before posting';
  end if;

  select count(*)
  into v_line_count
  from public.tgd_outbound_lines l
  where l.document_id = p_outbound_document_id;

  if v_line_count = 0 then
    raise exception 'Outbound document has no lines';
  end if;

  -- Fully picked rule: every non-cancelled line must satisfy picked >= requested.
  if exists (
    select 1
    from public.tgd_outbound_lines l
    where l.document_id = p_outbound_document_id
      and l.status <> 'CANCELLED'
      and (
        l.picked_quantity is null
        or l.requested_quantity is null
        or l.picked_quantity < l.requested_quantity
      )
  ) then
    raise exception 'Outbound document is not fully picked';
  end if;

  select count(*)
  into v_picked_reservation_count
  from public.tgd_outbound_reservations r
  where r.outbound_document_id = p_outbound_document_id
    and r.status = 'CONSUMED'
    and coalesce(r.picked_quantity, 0) > 0;

  if v_picked_reservation_count = 0 then
    raise exception 'Outbound document has no picked reservations';
  end if;

  if exists (
    select 1
    from public.tgd_outbound_reservations r
    where r.outbound_document_id = p_outbound_document_id
      and r.status = 'CONSUMED'
      and coalesce(r.picked_quantity, 0) > 0
      and (
        r.product_id is null
        or r.lot_id is null
        or r.location_id is null
      )
  ) then
    raise exception 'Picked reservations require product_id, lot_id, and location_id before posting';
  end if;

  select count(*)
  into v_existing_movement_count
  from public.tgd_stock_movements m
  where m.source_module = 'OUTBOUND_POST'
    and m.source_document_id = p_outbound_document_id;

  if v_existing_movement_count > 0 then
    raise exception 'Outbound post movements already exist for document % with a different post state', p_outbound_document_id;
  end if;

  -- Validate every balance before any movement insert. The movement insert below
  -- is the only stock mutation path; tgd_stock_balances is updated by the
  -- existing tgd_trigger_update_stock_balance trigger.
  for v_reservation in
    select
      r.id as reservation_id,
      r.outbound_line_id,
      r.customer_id,
      r.product_id,
      r.lot_id,
      r.location_id,
      r.picked_quantity,
      coalesce(r.picked_weight, 0) as picked_weight
    from public.tgd_outbound_reservations r
    where r.outbound_document_id = p_outbound_document_id
      and r.status = 'CONSUMED'
      and coalesce(r.picked_quantity, 0) > 0
    order by r.id
  loop
    if exists (
      select 1
      from public.tgd_stock_movements m
      where m.source_module = 'OUTBOUND_POST'
        and m.source_document_id = p_outbound_document_id
        and m.source_reservation_id = v_reservation.reservation_id
        and m.source_reference = v_post_reference
    ) then
      raise exception 'Duplicate stock movement detected for reservation % and post_reference %',
        v_reservation.reservation_id,
        v_post_reference;
    end if;

    select sb.id, sb.quantity
    into v_balance
    from public.tgd_stock_balances sb
    where sb.customer_id = v_document.customer_id
      and sb.product_id = v_reservation.product_id
      and sb.lot_id = v_reservation.lot_id
      and sb.location_id = v_reservation.location_id
    for update;

    if not found then
      raise exception 'Stock balance not found for reservation %', v_reservation.reservation_id;
    end if;

    if coalesce(v_balance.quantity, 0) < v_reservation.picked_quantity then
      raise exception 'Insufficient stock_balance for reservation %. Current balance %, requested %',
        v_reservation.reservation_id,
        coalesce(v_balance.quantity, 0),
        v_reservation.picked_quantity;
    end if;
  end loop;

  -- Insert one controlled OUT movement per picked reservation.
  for v_reservation in
    select
      r.id as reservation_id,
      r.outbound_line_id,
      r.customer_id,
      r.product_id,
      r.lot_id,
      r.location_id,
      r.picked_quantity,
      coalesce(r.picked_weight, 0) as picked_weight
    from public.tgd_outbound_reservations r
    where r.outbound_document_id = p_outbound_document_id
      and r.status = 'CONSUMED'
      and coalesce(r.picked_quantity, 0) > 0
    order by r.id
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
      source_reservation_id,
      source_reference,
      created_by,
      created_at,
      updated_at
    ) values (
      gen_random_uuid(),
      v_document.customer_id,
      v_reservation.product_id,
      v_reservation.lot_id,
      v_reservation.location_id,
      null,
      v_reservation.picked_quantity,
      v_reservation.picked_weight,
      'PICK_CONFIRM',
      now(),
      p_outbound_document_id,
      'OUTBOUND_POST',
      p_outbound_document_id,
      v_reservation.outbound_line_id,
      v_reservation.reservation_id,
      v_post_reference,
      v_profile.id,
      now(),
      now()
    )
    returning id into v_movement_id;

    update public.tgd_outbound_reservations
    set posted_quantity = picked_quantity,
        posted_weight = coalesce(picked_weight, 0),
        posted_by = v_profile.id,
        posted_at = now(),
        post_reference = v_post_reference,
        post_note = coalesce(p_note, post_note),
        updated_at = now()
    where id = v_reservation.reservation_id;

    v_inserted_movement_count := v_inserted_movement_count + 1;
    v_total_posted_quantity := v_total_posted_quantity + v_reservation.picked_quantity;
    v_total_posted_weight := v_total_posted_weight + v_reservation.picked_weight;
  end loop;

  update public.tgd_outbound_documents
  set status = 'CONFIRMED',
      posted_by = v_profile.id,
      posted_at = now(),
      post_reference = v_post_reference,
      post_note = coalesce(p_note, post_note),
      updated_at = now()
  where id = p_outbound_document_id
  returning * into v_document;

  if to_regclass('public.tgd_audit_logs') is not null then
    insert into public.tgd_audit_logs (
      action,
      entity_type,
      entity_id,
      performed_by,
      performed_at
    ) values (
      'OUTBOUND_POST',
      'tgd_outbound_documents',
      p_outbound_document_id,
      v_profile.id,
      now()
    );
  end if;

  return jsonb_build_object(
    'status', 'CONFIRMED',
    'outbound_document_id', v_document.id,
    'post_reference', v_post_reference,
    'posted_at', v_document.posted_at,
    'posted_by', v_document.posted_by,
    'movement_count', v_inserted_movement_count,
    'total_posted_quantity', v_total_posted_quantity,
    'total_posted_weight', v_total_posted_weight,
    'idempotent', false
  );
end;
$$;

revoke execute on function public.tgd_rpc_post_outbound_document(uuid, text, text) from public;
revoke execute on function public.tgd_rpc_post_outbound_document(uuid, text, text) from anon;
grant execute on function public.tgd_rpc_post_outbound_document(uuid, text, text) to authenticated;

comment on function public.tgd_rpc_post_outbound_document(uuid, text, text)
is 'Sprint 14Z draft only. Future Post Outbound RPC. Inserts PICK_CONFIRM movements and relies on stock balance trigger only after separate apply approval. No UI button in this sprint.';

-- ============================================================================
-- C. Explicit non-goals
-- ============================================================================
-- No Staging apply in sprint 14Z.
-- No Production touch.
-- No UI Post Outbound button.
-- No Confirm Stock Out button.
-- No direct update to tgd_stock_balances; the existing movement trigger owns it.
-- No reversal RPC; reversal/rollback remains a separate controlled future sprint.
