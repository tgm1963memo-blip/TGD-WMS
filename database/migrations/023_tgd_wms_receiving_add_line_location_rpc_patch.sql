-- 023_tgd_wms_receiving_add_line_location_rpc_patch.sql
-- Sprint 13J-AE: Receiving RPC contract patch.
-- Draft only. Do not apply without explicit Controller approval.
-- Production locked.
-- Receiving UI remains locked.
-- RPC-only write contract.

-- Remove the old add-line overload that did not require p_location_id.
-- Leaving this overload active would allow receiving lines without location
-- traceability, which violates the 13J-AE RPC contract.
revoke execute on function public.tgd_rpc_add_receiving_line(uuid, uuid, uuid, numeric, numeric) from public;
revoke execute on function public.tgd_rpc_add_receiving_line(uuid, uuid, uuid, numeric, numeric) from anon;
revoke execute on function public.tgd_rpc_add_receiving_line(uuid, uuid, uuid, numeric, numeric) from authenticated;
drop function if exists public.tgd_rpc_add_receiving_line(uuid, uuid, uuid, numeric, numeric);

create or replace function public.tgd_rpc_add_receiving_line(
  p_document_id uuid,
  p_product_id uuid,
  p_lot_id uuid,
  p_location_id uuid,
  p_quantity numeric,
  p_weight numeric default null
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
  v_new_id uuid;
begin
  if v_user_id is null then
    raise exception 'authentication required';
  end if;

  select p.id, p.auth_user_id, p.role, p.customer_id, p.is_active
  into v_profile
  from public.tgd_user_profiles p
  where p.auth_user_id = v_user_id
    and p.is_active = true
  limit 1;

  if not found then
    raise exception 'active user profile required';
  end if;

  if v_profile.role not in ('admin', 'warehouse_manager', 'warehouse_staff') then
    raise exception 'insufficient privileges';
  end if;

  select d.id, d.customer_id, d.status
  into v_document
  from public.tgd_receiving_documents d
  where d.id = p_document_id
  for update;

  if not found then
    raise exception 'document not found';
  end if;

  if v_document.status <> 'DRAFT' then
    raise exception 'document must be in DRAFT status';
  end if;

  if v_profile.customer_id is not null and v_profile.customer_id <> v_document.customer_id then
    raise exception 'customer isolation violation';
  end if;

  -- basic validations
  if p_product_id is null then
    raise exception 'product_id is required';
  end if;

  if p_lot_id is null then
    raise exception 'lot_id is required';
  end if;

  if p_location_id is null then
    raise exception 'location_id is required';
  end if;

  if p_quantity is null or p_quantity <= 0 then
    raise exception 'quantity must be > 0';
  end if;

  if p_weight is not null and p_weight < 0 then
    raise exception 'weight must be null or >= 0';
  end if;

  insert into public.tgd_receiving_lines (
    document_id,
    product_id,
    lot_id,
    location_id,
    quantity,
    weight,
    created_at,
    updated_at
  ) values (
    p_document_id,
    p_product_id,
    p_lot_id,
    p_location_id,
    p_quantity,
    p_weight,
    now(),
    now()
  ) returning id into v_new_id;

  return v_new_id;
end;
$$;

-- Grant and revoke
revoke execute on function public.tgd_rpc_add_receiving_line(uuid, uuid, uuid, uuid, numeric, numeric) from public;
revoke execute on function public.tgd_rpc_add_receiving_line(uuid, uuid, uuid, uuid, numeric, numeric) from anon;
grant execute on function public.tgd_rpc_add_receiving_line(uuid, uuid, uuid, uuid, numeric, numeric) to authenticated;

comment on function public.tgd_rpc_add_receiving_line is 'Draft: Adds receiving line with explicit location_id for traceability. Controller approval required before applying to production.';
