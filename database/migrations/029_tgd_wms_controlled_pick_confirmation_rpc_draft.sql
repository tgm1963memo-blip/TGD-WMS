-- 029_tgd_wms_controlled_pick_confirmation_rpc_draft.sql
-- Sprint 14T: Controlled Pick Confirmation RPC draft only.
-- Staging review required. Do NOT apply to Staging or Production without Controller approval.
-- Production is not touched by this draft.
-- No stock_movement OUT. No stock_balance update. No post outbound RPC.

-- ============================================================================
-- A. Reservation pick audit columns (safe additive schema)
--    tgd_outbound_lines already has picked_quantity / picked_weight (025).
-- ============================================================================

alter table public.tgd_outbound_reservations
  add column if not exists picked_quantity numeric not null default 0
    check (picked_quantity >= 0);

alter table public.tgd_outbound_reservations
  add column if not exists picked_weight numeric not null default 0
    check (picked_weight >= 0);

alter table public.tgd_outbound_reservations
  add column if not exists picked_at timestamptz;

alter table public.tgd_outbound_reservations
  add column if not exists picked_by uuid;

alter table public.tgd_outbound_reservations
  add column if not exists pick_reference text;

alter table public.tgd_outbound_reservations
  add column if not exists pick_note text;

-- Idempotency guard when pick_reference is supplied.
create unique index if not exists uq_outbound_reservation_pick_reference
  on public.tgd_outbound_reservations (id, pick_reference)
  where pick_reference is not null and btrim(pick_reference) <> '';

-- Future enum expansion (PICKING, PICKED_PARTIAL) is intentionally deferred.
-- This draft uses existing status values: ACTIVE, CONSUMED, RELEASED, CANCELLED.

-- ============================================================================
-- B. Controlled Confirm Pick RPC (outbound metadata only)
-- ============================================================================

create or replace function public.tgd_rpc_confirm_outbound_pick_draft(
  p_outbound_document_id uuid,
  p_outbound_line_id uuid,
  p_reservation_id uuid,
  p_picked_quantity numeric,
  p_picked_weight numeric default 0,
  p_pick_reference text default null,
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
  v_line public.tgd_outbound_lines%rowtype;
  v_reservation public.tgd_outbound_reservations%rowtype;
  v_reservation_picked_qty numeric;
  v_reservation_picked_weight numeric;
  v_new_line_picked_qty numeric;
  v_new_line_picked_weight numeric;
  v_new_reservation_picked_qty numeric;
  v_new_reservation_picked_weight numeric;
  v_reservation_status text;
  v_line_status text;
  v_document_status text;
  v_pick_status text;
  v_idempotent boolean := false;
begin
  if v_user_id is null then
    raise exception 'Authentication required (auth.uid() is null)';
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
    raise exception 'Active user profile not found for auth.uid() %', v_user_id;
  end if;

  if v_profile.role not in ('admin', 'warehouse_manager', 'warehouse_staff') then
    raise exception 'User role % not authorized for outbound pick confirmation', v_profile.role;
  end if;

  if p_outbound_document_id is null then
    raise exception 'outbound_document_id is required';
  end if;

  if p_outbound_line_id is null then
    raise exception 'outbound_line_id is required';
  end if;

  if p_reservation_id is null then
    raise exception 'reservation_id is required';
  end if;

  if p_picked_quantity is null or p_picked_quantity <= 0 then
    raise exception 'picked_quantity must be greater than zero';
  end if;

  if p_picked_weight is null or p_picked_weight < 0 then
    raise exception 'picked_weight must be zero or greater';
  end if;

  select *
  into v_document
  from public.tgd_outbound_documents
  where id = p_outbound_document_id;

  if not found then
    raise exception 'outbound document not found';
  end if;

  if v_document.status not in ('DRAFT', 'RESERVED') then
    raise exception 'outbound document must be DRAFT or RESERVED to confirm pick';
  end if;

  if v_document.status = 'CANCELLED' then
    raise exception 'CANCELLED outbound document cannot be picked';
  end if;

  if v_profile.customer_id is not null and v_document.customer_id <> v_profile.customer_id then
    raise exception 'Customer isolation violation for outbound document';
  end if;

  select *
  into v_line
  from public.tgd_outbound_lines
  where id = p_outbound_line_id
    and document_id = p_outbound_document_id;

  if not found then
    raise exception 'outbound line not found for document';
  end if;

  if v_line.status = 'CANCELLED' then
    raise exception 'CANCELLED outbound line cannot be picked';
  end if;

  select *
  into v_reservation
  from public.tgd_outbound_reservations
  where id = p_reservation_id
    and outbound_document_id = p_outbound_document_id
    and outbound_line_id = p_outbound_line_id;

  if not found then
    raise exception 'outbound reservation not found for document and line';
  end if;

  if v_reservation.status = 'RELEASED' then
    raise exception 'RELEASED reservation cannot be picked';
  end if;

  if v_reservation.status = 'CANCELLED' then
    raise exception 'CANCELLED reservation cannot be picked';
  end if;

  -- Idempotent replay when reservation already consumed with matching reference/qty.
  if v_reservation.status = 'CONSUMED' then
    if p_pick_reference is not null
      and btrim(p_pick_reference) <> ''
      and v_reservation.pick_reference = btrim(p_pick_reference)
      and v_reservation.picked_quantity = p_picked_quantity
      and coalesce(v_reservation.picked_weight, 0) = coalesce(p_picked_weight, 0) then
      v_idempotent := true;

      return jsonb_build_object(
        'status', 'PICKED',
        'outbound_document_id', v_document.id,
        'outbound_line_id', v_line.id,
        'reservation_id', v_reservation.id,
        'picked_quantity', v_reservation.picked_quantity,
        'picked_weight', coalesce(v_reservation.picked_weight, 0),
        'line_picked_quantity', v_line.picked_quantity,
        'line_picked_weight', coalesce(v_line.picked_weight, 0),
        'reservation_status', v_reservation.status,
        'document_status', v_document.status,
        'line_status', v_line.status,
        'idempotent', true
      );
    end if;

    raise exception 'CONSUMED reservation cannot be picked again';
  end if;

  if v_reservation.status <> 'ACTIVE' then
    raise exception 'reservation status must be ACTIVE to confirm pick';
  end if;

  v_reservation_picked_qty := coalesce(v_reservation.picked_quantity, 0);
  v_reservation_picked_weight := coalesce(v_reservation.picked_weight, 0);
  v_new_reservation_picked_qty := v_reservation_picked_qty + p_picked_quantity;
  v_new_reservation_picked_weight := v_reservation_picked_weight + coalesce(p_picked_weight, 0);

  if v_new_reservation_picked_qty > v_reservation.reserved_quantity then
    raise exception 'picked_quantity must not exceed reserved_quantity';
  end if;

  if v_reservation.reserved_weight > 0
    and v_new_reservation_picked_weight > v_reservation.reserved_weight then
    raise exception 'picked_weight must not exceed reserved_weight';
  end if;

  v_new_line_picked_qty := coalesce(v_line.picked_quantity, 0) + p_picked_quantity;
  v_new_line_picked_weight := coalesce(v_line.picked_weight, 0) + coalesce(p_picked_weight, 0);

  if v_new_line_picked_qty > v_line.requested_quantity then
    raise exception 'line picked_quantity must not exceed requested_quantity';
  end if;

  if v_line.requested_weight > 0 and v_new_line_picked_weight > v_line.requested_weight then
    raise exception 'line picked_weight must not exceed requested_weight';
  end if;

  if v_new_reservation_picked_qty >= v_reservation.reserved_quantity then
    v_reservation_status := 'CONSUMED';
    v_pick_status := 'PICKED';
  else
    v_reservation_status := 'ACTIVE';
    v_pick_status := 'PICKED_PARTIAL';
  end if;

  if v_new_line_picked_qty >= v_line.requested_quantity then
    v_line_status := 'PICKED';
  elsif v_line.status in ('OPEN', 'RESERVED') then
    v_line_status := 'RESERVED';
  else
    v_line_status := v_line.status;
  end if;

  update public.tgd_outbound_reservations
  set picked_quantity = v_new_reservation_picked_qty,
      picked_weight = v_new_reservation_picked_weight,
      picked_by = v_user_id,
      picked_at = now(),
      pick_reference = coalesce(nullif(btrim(p_pick_reference), ''), pick_reference),
      pick_note = coalesce(p_note, pick_note),
      status = v_reservation_status,
      updated_at = now()
  where id = p_reservation_id
  returning * into v_reservation;

  update public.tgd_outbound_lines
  set picked_quantity = v_new_line_picked_qty,
      picked_weight = v_new_line_picked_weight,
      status = v_line_status,
      updated_at = now()
  where id = p_outbound_line_id
  returning * into v_line;

  if exists (
    select 1
    from public.tgd_outbound_lines ol
    where ol.document_id = p_outbound_document_id
      and ol.status <> 'PICKED'
      and ol.status <> 'CANCELLED'
  ) then
    v_document_status := case
      when v_document.status = 'DRAFT' then 'RESERVED'
      else v_document.status
    end;
  else
    v_document_status := 'PICKED';
  end if;

  update public.tgd_outbound_documents
  set status = v_document_status,
      updated_at = now()
  where id = p_outbound_document_id
  returning * into v_document;

  return jsonb_build_object(
    'status', v_pick_status,
    'outbound_document_id', v_document.id,
    'outbound_line_id', v_line.id,
    'reservation_id', v_reservation.id,
    'picked_quantity', p_picked_quantity,
    'picked_weight', coalesce(p_picked_weight, 0),
    'line_picked_quantity', v_line.picked_quantity,
    'line_picked_weight', coalesce(v_line.picked_weight, 0),
    'reservation_status', v_reservation.status,
    'document_status', v_document.status,
    'line_status', v_line.status,
    'idempotent', v_idempotent
  );
end;
$$;

grant execute on function public.tgd_rpc_confirm_outbound_pick_draft(
  uuid,
  uuid,
  uuid,
  numeric,
  numeric,
  text,
  text
) to authenticated;

-- Hard safety reminder for reviewers:
-- This RPC updates outbound metadata tables only (documents, lines, reservations).
-- Physical stock issue and balance mutation remain out of scope for sprint 14T.
