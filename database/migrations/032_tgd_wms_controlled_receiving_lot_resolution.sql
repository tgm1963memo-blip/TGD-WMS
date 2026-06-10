-- 032_tgd_wms_controlled_receiving_lot_resolution.sql
-- Phase 23M: Controlled Receiving Lot Resolution
-- Safely resolves or creates a lot ID for inbound receiving.

create or replace function public.tgd_rpc_resolve_or_create_lot(
  p_product_id uuid,
  p_lot_no text
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lot_id uuid;
  v_user_id uuid := auth.uid();
  v_profile record;
begin
  if v_user_id is null then
    raise exception 'authentication required';
  end if;

  select p.id, p.role
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

  if p_product_id is null then
    raise exception 'product_id is required';
  end if;

  if p_lot_no is null or trim(p_lot_no) = '' then
    raise exception 'lot_no is required';
  end if;

  -- Verify product exists
  if not exists (select 1 from public.tgd_products where id = p_product_id) then
    raise exception 'product not found';
  end if;

  -- Try to find existing lot
  select id into v_lot_id
  from public.tgd_lots
  where product_id = p_product_id
    and lot_no = p_lot_no;

  -- If not found, create it safely without updating stock or bypassing ledger
  if v_lot_id is null then
    insert into public.tgd_lots (product_id, lot_no, created_at, updated_at)
    values (p_product_id, p_lot_no, now(), now())
    returning id into v_lot_id;
  end if;

  return v_lot_id;
end;
$$;

revoke execute on function public.tgd_rpc_resolve_or_create_lot(uuid, text) from public;
revoke execute on function public.tgd_rpc_resolve_or_create_lot(uuid, text) from anon;
grant execute on function public.tgd_rpc_resolve_or_create_lot(uuid, text) to authenticated;
