-- 055_tgd_wms_customer_request_execution_bridge.sql
-- Bridge admin-accepted customer deposit/withdrawal requests to internal execution documents.

begin;

create or replace function public.tgd_bridge_customer_deposit_to_receiving(
  p_deposit_request_id uuid,
  p_actor_user_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deposit record;
  v_receiving_id uuid;
  v_document_no text;
begin
  if p_deposit_request_id is null then
    raise exception 'deposit_request_id is required';
  end if;

  select d.id, d.request_no, d.customer_id, d.status
  into v_deposit
  from public.tgd_customer_deposit_requests d
  where d.id = p_deposit_request_id;

  if not found then
    raise exception 'Customer deposit request not found';
  end if;

  if v_deposit.status <> 'ADMIN_ACCEPTED' then
    raise exception 'Deposit request must be ADMIN_ACCEPTED before receiving bridge';
  end if;

  if exists (
    select 1
    from public.tgd_customer_deposit_receiving_links l
    where l.customer_deposit_request_id = v_deposit.id
  ) then
    select l.receiving_document_id
    into v_receiving_id
    from public.tgd_customer_deposit_receiving_links l
    where l.customer_deposit_request_id = v_deposit.id
    order by l.created_at
    limit 1;
    return v_receiving_id;
  end if;

  v_document_no := 'RCV-' || v_deposit.request_no;

  if exists (
    select 1 from public.tgd_receiving_documents rd where rd.document_no = v_document_no
  ) then
    v_document_no := v_document_no || '-' || to_char(now(), 'YYYYMMDDHH24MISS');
  end if;

  insert into public.tgd_receiving_documents (
    customer_id,
    document_no,
    status,
    created_by,
    source_customer_deposit_request_id,
    source_customer_deposit_request_no
  ) values (
    v_deposit.customer_id,
    v_document_no,
    'DRAFT',
    p_actor_user_id,
    v_deposit.id,
    v_deposit.request_no
  )
  returning id into v_receiving_id;

  insert into public.tgd_customer_deposit_receiving_links (
    customer_deposit_request_id,
    receiving_document_id,
    link_scope,
    created_by_user_id
  ) values (
    v_deposit.id,
    v_receiving_id,
    'HEADER',
    p_actor_user_id
  );

  update public.tgd_customer_deposit_requests
  set status = 'WAREHOUSE_RECEIVING',
      last_action_at = now()
  where id = v_deposit.id
    and status = 'ADMIN_ACCEPTED';

  return v_receiving_id;
end;
$$;

create or replace function public.tgd_bridge_customer_withdrawal_to_internal(
  p_withdrawal_request_id uuid,
  p_actor_user_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_withdrawal record;
  v_internal_id uuid;
  v_warehouse_id uuid;
  v_line record;
  v_product_id uuid;
  v_lot_id uuid;
begin
  if p_withdrawal_request_id is null then
    raise exception 'withdrawal_request_id is required';
  end if;

  select w.id, w.withdrawal_no, w.customer_id, w.status, w.requested_dispatch_date,
         w.delivery_type, w.pickup_contact, w.destination, w.note
  into v_withdrawal
  from public.tgd_customer_withdrawal_requests w
  where w.id = p_withdrawal_request_id;

  if not found then
    raise exception 'Customer withdrawal request not found';
  end if;

  if v_withdrawal.status <> 'ADMIN_ACCEPTED' then
    raise exception 'Withdrawal request must be ADMIN_ACCEPTED before execution bridge';
  end if;

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

  select w.id
  into v_warehouse_id
  from public.tgd_warehouses w
  order by w.code
  limit 1;

  if v_warehouse_id is null then
    raise exception 'No warehouse configured for withdrawal bridge';
  end if;

  insert into public.tgd_withdrawal_requests (
    withdrawal_no,
    customer_id,
    warehouse_id,
    withdrawal_type,
    status,
    request_source,
    request_reference_no,
    request_reference_id,
    requested_dispatch_date,
    requested_by_name,
    delivery_to_address,
    remark,
    created_by,
    source_customer_withdrawal_request_id,
    source_customer_withdrawal_no
  ) values (
    v_withdrawal.withdrawal_no,
    v_withdrawal.customer_id,
    v_warehouse_id,
    case when upper(coalesce(v_withdrawal.delivery_type, 'PICKUP')) = 'DELIVERY' then 'DELIVERY' else 'CUSTOMER_PICKUP' end,
    'DRAFT',
    'CUSTOMER_PORTAL',
    v_withdrawal.withdrawal_no,
    v_withdrawal.id,
    v_withdrawal.requested_dispatch_date,
    v_withdrawal.pickup_contact,
    v_withdrawal.destination,
    v_withdrawal.note,
    p_actor_user_id,
    v_withdrawal.id,
    v_withdrawal.withdrawal_no
  )
  returning id into v_internal_id;

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
        and lt.lot_no = btrim(coalesce(v_line.source_lot_no, v_line.lot_no))
      limit 1;
    end if;

    insert into public.tgd_withdrawal_request_lines (
      withdrawal_request_id,
      line_no,
      product_id,
      lot_id,
      requested_lot_no,
      requested_exp_date,
      requested_qty,
      uom,
      customer_note
    ) values (
      v_internal_id,
      v_line.line_no,
      v_product_id,
      v_lot_id,
      nullif(btrim(coalesce(v_line.source_lot_no, v_line.lot_no)), ''),
      v_line.exp_date,
      coalesce(v_line.requested_qty, 0),
      coalesce(nullif(btrim(v_line.uom), ''), 'KG'),
      v_line.note
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

create or replace function public.tgd_review_customer_deposit_request(
  p_request_id uuid,
  p_decision text,
  p_comment text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_auth_user_id uuid := auth.uid();
  v_profile record;
  v_document record;
  v_decision text := upper(nullif(btrim(p_decision), ''));
  v_to_status text;
  v_receiving_id uuid;
begin
  if v_auth_user_id is null or not public.tgd_current_user_is_active() then
    raise exception 'Active authenticated user required';
  end if;

  select p.id, p.email, p.role, p.customer_id
  into v_profile
  from public.tgd_user_profiles p
  where p.auth_user_id = v_auth_user_id
    and p.is_active = true
  limit 1;

  if not found or v_profile.role not in ('admin', 'accounting') then
    raise exception 'Admin or accounting role required to review a deposit request';
  end if;
  if v_decision not in ('ACCEPT', 'REJECT', 'REVIEWING') then
    raise exception 'Decision must be ACCEPT, REJECT, or REVIEWING';
  end if;

  select d.id, d.customer_id, d.status
  into v_document
  from public.tgd_customer_deposit_requests d
  where d.id = p_request_id
  for update;

  if not found then
    raise exception 'Customer deposit request not found';
  end if;

  if v_decision = 'REVIEWING' and v_document.status = 'SUBMITTED_BY_CUSTOMER' then
    v_to_status := 'ADMIN_REVIEWING';
  elsif v_decision = 'ACCEPT' and v_document.status = 'ADMIN_REVIEWING' then
    v_to_status := 'ADMIN_ACCEPTED';
  elsif v_decision = 'REJECT' and v_document.status = 'ADMIN_REVIEWING' then
    v_to_status := 'ADMIN_REJECTED';
  else
    raise exception 'Invalid deposit review transition from % using %',
      v_document.status, v_decision;
  end if;

  update public.tgd_customer_deposit_requests
  set status = v_to_status,
      reviewed_by_user_id = case when v_decision in ('ACCEPT', 'REJECT') then v_profile.id else reviewed_by_user_id end,
      reviewed_by_email = case when v_decision in ('ACCEPT', 'REJECT') then v_profile.email else reviewed_by_email end,
      reviewed_at = case when v_decision in ('ACCEPT', 'REJECT') then now() else reviewed_at end,
      review_comment = nullif(btrim(p_comment), ''),
      last_action_by_user_id = v_profile.id,
      last_action_by_email = v_profile.email,
      last_action_at = now()
  where id = v_document.id;

  if v_decision = 'ACCEPT' then
    v_receiving_id := public.tgd_bridge_customer_deposit_to_receiving(v_document.id, v_profile.id);
  end if;

  insert into public.tgd_customer_document_timeline_events (
    document_type, document_id, customer_id, action, from_status, to_status,
    actor_user_id, actor_email, actor_role, actor_customer_id, comment
  ) values (
    'CUSTOMER_DEPOSIT_REQUEST', v_document.id, v_document.customer_id,
    'REVIEW_' || v_decision, v_document.status, case when v_decision = 'ACCEPT' then 'WAREHOUSE_RECEIVING' else v_to_status end,
    v_profile.id, v_profile.email, v_profile.role, v_profile.customer_id,
    nullif(btrim(p_comment), '')
  );

  return jsonb_build_object(
    'id', v_document.id,
    'customer_id', v_document.customer_id,
    'status', case when v_decision = 'ACCEPT' then 'WAREHOUSE_RECEIVING' else v_to_status end,
    'action', 'REVIEW_' || v_decision,
    'receiving_document_id', v_receiving_id
  );
end;
$$;

create or replace function public.tgd_review_customer_withdrawal_request(
  p_request_id uuid,
  p_decision text,
  p_comment text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_auth_user_id uuid := auth.uid();
  v_profile record;
  v_document record;
  v_decision text := upper(nullif(btrim(p_decision), ''));
  v_to_status text;
  v_internal_id uuid;
begin
  if v_auth_user_id is null or not public.tgd_current_user_is_active() then
    raise exception 'Active authenticated user required';
  end if;

  select p.id, p.email, p.role, p.customer_id
  into v_profile
  from public.tgd_user_profiles p
  where p.auth_user_id = v_auth_user_id
    and p.is_active = true
  limit 1;

  if not found or v_profile.role not in ('admin', 'accounting') then
    raise exception 'Admin or accounting role required to review a withdrawal request';
  end if;
  if v_decision not in ('ACCEPT', 'REJECT', 'REVIEWING') then
    raise exception 'Decision must be ACCEPT, REJECT, or REVIEWING';
  end if;

  select w.id, w.customer_id, w.status
  into v_document
  from public.tgd_customer_withdrawal_requests w
  where w.id = p_request_id
  for update;

  if not found then
    raise exception 'Customer withdrawal request not found';
  end if;

  if v_decision = 'REVIEWING' and v_document.status = 'SUBMITTED_BY_CUSTOMER' then
    v_to_status := 'ADMIN_REVIEWING';
  elsif v_decision = 'ACCEPT' and v_document.status = 'ADMIN_REVIEWING' then
    v_to_status := 'ADMIN_ACCEPTED';
  elsif v_decision = 'REJECT' and v_document.status = 'ADMIN_REVIEWING' then
    v_to_status := 'ADMIN_REJECTED';
  else
    raise exception 'Invalid withdrawal review transition from % using %',
      v_document.status, v_decision;
  end if;

  update public.tgd_customer_withdrawal_requests
  set status = v_to_status,
      reviewed_by_user_id = case when v_decision in ('ACCEPT', 'REJECT') then v_profile.id else reviewed_by_user_id end,
      reviewed_by_email = case when v_decision in ('ACCEPT', 'REJECT') then v_profile.email else reviewed_by_email end,
      reviewed_at = case when v_decision in ('ACCEPT', 'REJECT') then now() else reviewed_at end,
      review_comment = nullif(btrim(p_comment), ''),
      last_action_by_user_id = v_profile.id,
      last_action_by_email = v_profile.email,
      last_action_at = now()
  where id = v_document.id;

  if v_decision = 'ACCEPT' then
    v_internal_id := public.tgd_bridge_customer_withdrawal_to_internal(v_document.id, v_profile.id);
  end if;

  insert into public.tgd_customer_document_timeline_events (
    document_type, document_id, customer_id, action, from_status, to_status,
    actor_user_id, actor_email, actor_role, actor_customer_id, comment
  ) values (
    'CUSTOMER_WITHDRAWAL_REQUEST', v_document.id, v_document.customer_id,
    'REVIEW_' || v_decision, v_document.status, v_to_status,
    v_profile.id, v_profile.email, v_profile.role, v_profile.customer_id,
    nullif(btrim(p_comment), '')
  );

  return jsonb_build_object(
    'id', v_document.id,
    'customer_id', v_document.customer_id,
    'status', v_to_status,
    'action', 'REVIEW_' || v_decision,
    'internal_withdrawal_request_id', v_internal_id
  );
end;
$$;

revoke all on function public.tgd_bridge_customer_deposit_to_receiving(uuid, uuid) from public, anon;
revoke all on function public.tgd_bridge_customer_withdrawal_to_internal(uuid, uuid) from public, anon;
grant execute on function public.tgd_bridge_customer_deposit_to_receiving(uuid, uuid) to authenticated;
grant execute on function public.tgd_bridge_customer_withdrawal_to_internal(uuid, uuid) to authenticated;

commit;
