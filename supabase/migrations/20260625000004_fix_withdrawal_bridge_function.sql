-- Fix tgd_bridge_customer_withdrawal_to_internal to match actual table schemas.
-- The original function used wrong column names:
--   tgd_withdrawal_requests: 'withdrawal_no' doesn't exist → 'request_no'
--   tgd_withdrawal_requests: 'warehouse_id','withdrawal_type','request_source', etc. don't exist
--   tgd_withdrawal_request_lines: 'withdrawal_request_id' → 'request_id'
--   tgd_withdrawal_request_lines: 'requested_qty' → 'quantity', 'line_no'/'uom'/'customer_note' don't exist
--   tgd_lots: 'lot_no' → 'lot_number'
-- This caused every ACCEPT action to fail with a column-does-not-exist DB error.

CREATE OR REPLACE FUNCTION public.tgd_bridge_customer_withdrawal_to_internal(
  p_withdrawal_request_id uuid,
  p_actor_user_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
declare
  v_withdrawal record;
  v_internal_id uuid;
  v_line record;
  v_product_id uuid;
  v_lot_id uuid;
begin
  if p_withdrawal_request_id is null then
    raise exception 'withdrawal_request_id is required';
  end if;

  select w.id, w.withdrawal_no, w.customer_id, w.status
  into v_withdrawal
  from public.tgd_customer_withdrawal_requests w
  where w.id = p_withdrawal_request_id;

  if not found then
    raise exception 'Customer withdrawal request not found';
  end if;

  if v_withdrawal.status <> 'ADMIN_ACCEPTED' then
    raise exception 'Withdrawal request must be ADMIN_ACCEPTED before execution bridge';
  end if;

  -- Idempotency: return existing internal request if already bridged
  if exists (
    select 1
    from public.tgd_customer_withdrawal_execution_links l
    where l.customer_withdrawal_request_id = v_withdrawal.id
      and l.internal_withdrawal_request_id is not null
  ) then
    select l.internal_withdrawal_request_id
    into v_internal_id
    from public.tgd_customer_withdrawal_execution_links l
    where l.customer_withdrawal_request_id = v_withdrawal.id
    order by l.created_at
    limit 1;
    return v_internal_id;
  end if;

  -- Create internal withdrawal request using actual schema columns
  insert into public.tgd_withdrawal_requests (
    request_no,
    customer_id,
    status,
    requested_at,
    source_customer_withdrawal_request_id,
    source_customer_withdrawal_no
  ) values (
    v_withdrawal.withdrawal_no,
    v_withdrawal.customer_id,
    'DRAFT',
    now(),
    v_withdrawal.id,
    v_withdrawal.withdrawal_no
  )
  returning id into v_internal_id;

  -- Link header record
  insert into public.tgd_customer_withdrawal_execution_links (
    customer_withdrawal_request_id,
    internal_withdrawal_request_id,
    link_scope,
    created_by_user_id
  ) values (
    v_withdrawal.id,
    v_internal_id,
    'HEADER',
    p_actor_user_id
  );

  -- Bridge each line, skipping lines where product or lot cannot be resolved
  for v_line in
    select l.*
    from public.tgd_customer_withdrawal_request_lines l
    where l.withdrawal_request_id = v_withdrawal.id
    order by l.line_no
  loop
    v_product_id := v_line.product_id;

    if v_product_id is null and nullif(btrim(v_line.internal_product_code), '') is not null then
      select p.id into v_product_id
      from public.tgd_products p
      where lower(p.sku) = lower(btrim(v_line.internal_product_code))
      limit 1;
    end if;

    if v_product_id is null and nullif(btrim(v_line.customer_product_code), '') is not null then
      select cp.internal_product_id into v_product_id
      from public.tgd_customer_products cp
      where cp.customer_id = v_withdrawal.customer_id
        and lower(cp.customer_product_code) = lower(btrim(v_line.customer_product_code))
      limit 1;
    end if;

    if v_product_id is null then
      continue;
    end if;

    v_lot_id := null;
    if nullif(btrim(coalesce(v_line.source_lot_no, v_line.lot_no)), '') is not null then
      select lt.id into v_lot_id
      from public.tgd_lots lt
      where lt.product_id = v_product_id
        and lt.lot_number = btrim(coalesce(v_line.source_lot_no, v_line.lot_no))
      limit 1;
    end if;

    -- lot_id is NOT NULL in tgd_withdrawal_request_lines — skip if not found
    if v_lot_id is null then
      continue;
    end if;

    insert into public.tgd_withdrawal_request_lines (
      request_id,
      product_id,
      lot_id,
      quantity,
      weight
    ) values (
      v_internal_id,
      v_product_id,
      v_lot_id,
      coalesce(v_line.requested_qty, 0),
      v_line.requested_weight
    );

    insert into public.tgd_customer_withdrawal_execution_links (
      customer_withdrawal_request_id,
      customer_withdrawal_request_line_id,
      internal_withdrawal_request_id,
      link_scope,
      created_by_user_id
    ) values (
      v_withdrawal.id,
      v_line.id,
      v_internal_id,
      'LINE',
      p_actor_user_id
    );
  end loop;

  return v_internal_id;
end;
$$;
