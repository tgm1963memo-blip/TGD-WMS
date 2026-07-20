-- Widen tgd_admin_add_customer_deposit_request_line's status guard: staff
-- asked to add an extra line while STILL reviewing the customer's initial
-- submission (status SUBMITTED_BY_CUSTOMER), before the work order is even
-- opened — not just later during physical receiving. Role-wise nothing
-- changes (warehouse_manager/warehouse_admin were already allowed); this
-- only widens WHEN the action is allowed, to every pre-confirmation status
-- (everything except the terminal/already-confirmed ones), matching the
-- same "not yet confirmed" boundary this page already uses for the
-- per-line recount button.

begin;

create or replace function public.tgd_admin_add_customer_deposit_request_line(
  p_deposit_request_id uuid,
  p_customer_product_code text,
  p_product_name text default null,
  p_lot_no text default null,
  p_actual_boxes numeric default null,
  p_actual_weight numeric default null,
  p_temperature_type text default null,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_auth_user_id uuid := auth.uid();
  v_profile record;
  v_document record;
  v_catalog record;
  v_new_line_no integer;
  v_new_line_id uuid;
  v_product_name text;
  v_temperature_type text;
begin
  if v_auth_user_id is null or not public.tgd_current_user_is_active() then
    raise exception 'Active authenticated user required';
  end if;

  select p.id, p.email, p.role, p.customer_id into v_profile
  from public.tgd_user_profiles p
  where p.auth_user_id = v_auth_user_id and p.is_active = true
  limit 1;
  if not found then
    raise exception 'User profile not found';
  end if;

  if v_profile.role not in ('admin', 'accounting', 'warehouse_manager', 'warehouse_admin', 'warehouse_staff') then
    raise exception 'Warehouse role required to add a deposit line';
  end if;

  if p_customer_product_code is null or btrim(p_customer_product_code) = '' then
    raise exception 'Customer product code is required';
  end if;

  select d.id, d.customer_id, d.status into v_document
  from public.tgd_customer_deposit_requests d
  where d.id = p_deposit_request_id
  for update;
  if not found then
    raise exception 'Deposit request not found';
  end if;

  if v_document.status in ('RECEIVED_CONFIRMED', 'CUSTOMER_NOTIFIED', 'COMPLETED', 'REJECTED', 'CANCELLED') then
    raise exception 'Request has already been confirmed/closed — cannot add a line';
  end if;

  select cp.product_name, cp.temperature_type into v_catalog
  from public.tgd_customer_products cp
  where cp.customer_id = v_document.customer_id
    and cp.customer_product_code = btrim(p_customer_product_code)
  limit 1;

  v_product_name := coalesce(nullif(btrim(p_product_name), ''), v_catalog.product_name, btrim(p_customer_product_code));
  v_temperature_type := coalesce(nullif(btrim(p_temperature_type), ''), v_catalog.temperature_type);

  select coalesce(max(line_no), 0) + 1 into v_new_line_no
  from public.tgd_customer_deposit_request_lines
  where deposit_request_id = v_document.id;

  insert into public.tgd_customer_deposit_request_lines (
    deposit_request_id, line_no, customer_product_code, product_name, lot_no,
    uom, temperature_type, expected_boxes, expected_weight,
    actual_boxes, actual_weight, actual_note
  ) values (
    v_document.id, v_new_line_no, btrim(p_customer_product_code), v_product_name,
    nullif(btrim(p_lot_no), ''), 'กล่อง', v_temperature_type,
    p_actual_boxes, p_actual_weight,
    p_actual_boxes, p_actual_weight, nullif(btrim(p_note), '')
  )
  returning id into v_new_line_id;

  update public.tgd_customer_deposit_requests
  set last_action_by_user_id = v_profile.id,
      last_action_by_email = v_profile.email,
      last_action_at = now()
  where id = v_document.id;

  insert into public.tgd_customer_document_timeline_events (
    document_type, document_id, customer_id, action, from_status, to_status,
    actor_user_id, actor_email, actor_role, actor_customer_id, comment, metadata_json
  ) values (
    'CUSTOMER_DEPOSIT_REQUEST', v_document.id, v_document.customer_id,
    'ADMIN_ADD_LINE', v_document.status, v_document.status,
    v_profile.id, v_profile.email, v_profile.role, v_profile.customer_id,
    nullif(btrim(p_note), ''),
    jsonb_build_object(
      'line_id', v_new_line_id, 'line_no', v_new_line_no,
      'customer_product_code', btrim(p_customer_product_code),
      'product_name', v_product_name,
      'actual_boxes', p_actual_boxes, 'actual_weight', p_actual_weight
    )
  );

  return jsonb_build_object(
    'line_id', v_new_line_id,
    'deposit_request_id', v_document.id,
    'line_no', v_new_line_no,
    'status', v_document.status
  );
end;
$$;

grant execute on function public.tgd_admin_add_customer_deposit_request_line(uuid, text, text, text, numeric, numeric, text, text) to authenticated;

commit;
