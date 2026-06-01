-- 010_tgd_wms_rpc_profile_and_ledger_alignment.sql
-- Align stock movement RPC with current tgd_user_profiles and tgd_stock_movements schema.
-- Staging first. No production apply without approval.

create or replace function public.tgd_rpc_create_stock_movement(
  p_movement_type text,
  p_customer_id uuid,
  p_quantity numeric,
  p_source_location_id uuid,
  p_target_location_id uuid,
  p_reference text default null::text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_profile record;
  v_allowed_roles text[] := array['admin', 'warehouse_manager', 'warehouse_staff'];
  v_allowed_movements text[] := array[
    'RECEIVE_CONFIRM',
    'PUTAWAY_CONFIRM',
    'TRANSFER_CONFIRM',
    'ADJUSTMENT_CONFIRM',
    'PICK_ALLOCATE',
    'PICK_CONFIRM',
    'DISPATCH_CONFIRM'
  ];
  v_new_movement_id uuid := gen_random_uuid();
  v_product_id uuid;
  v_lot_id uuid;
  v_location_id uuid;
begin
  -- 1. Auth check
  if v_user_id is null then
    raise exception 'Unauthenticated call – auth.uid() is null';
  end if;

  -- 2. Active profile check
  select
    p.id,
    p.auth_user_id,
    p.email,
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

  -- 3. Role check
  if not v_profile.role = any(v_allowed_roles) then
    raise exception 'User role % not authorized for stock movement', v_profile.role;
  end if;

  -- 4. Movement type validation
  if not p_movement_type = any(v_allowed_movements) then
    raise exception 'Invalid movement_type %', p_movement_type;
  end if;

  -- 5. Quantity validation
  if p_quantity is null or p_quantity <= 0 then
    raise exception 'Quantity must be positive';
  end if;

  -- 6. Customer isolation check
  if v_profile.customer_id is not null then
    if p_customer_id is null or p_customer_id <> v_profile.customer_id then
      raise exception 'Customer isolation violation – movement customer_id must match profile customer_id';
    end if;
  end if;

  -- 7. Pick a real seeded product/lot from current balance.
  -- Current RPC signature does not accept product_id / lot_id yet, so dry run derives them
  -- from existing seeded stock for the same customer.
  v_location_id := coalesce(p_source_location_id, p_target_location_id);

  select
    sb.product_id,
    sb.lot_id
  into
    v_product_id,
    v_lot_id
  from public.tgd_stock_balances sb
  where sb.customer_id = p_customer_id
    and (
      v_location_id is null
      or sb.location_id = v_location_id
    )
  order by sb.updated_at desc, sb.created_at desc
  limit 1;

  if v_product_id is null or v_lot_id is null then
    select
      sb.product_id,
      sb.lot_id
    into
      v_product_id,
      v_lot_id
    from public.tgd_stock_balances sb
    where sb.customer_id = p_customer_id
    order by sb.updated_at desc, sb.created_at desc
    limit 1;
  end if;

  if v_product_id is null or v_lot_id is null then
    raise exception 'No seeded stock balance found for customer_id % to derive product_id and lot_id', p_customer_id;
  end if;

  -- 8. Insert movement ledger using current schema.
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
    movement_date
  ) values (
    v_new_movement_id,
    p_customer_id,
    v_product_id,
    v_lot_id,
    p_source_location_id,
    p_target_location_id,
    p_quantity,
    0,
    p_movement_type,
    now()
  );

  return v_new_movement_id;
end;
$$;

grant execute on function public.tgd_rpc_create_stock_movement(text, uuid, numeric, uuid, uuid, text) to authenticated;