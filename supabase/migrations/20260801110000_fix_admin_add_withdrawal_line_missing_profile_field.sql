-- tgd_admin_add_customer_withdrawal_request_line (migration 20260801100000)
-- selected only p.id, p.email, p.role into v_profile, but its own
-- timeline-event insert references v_profile.customer_id — a field that
-- was never selected, so every call failed with `record "v_profile" has
-- no field "customer_id"` before it could insert anything. Add
-- customer_id to the select (NULL for staff, same as every other
-- withdrawal RPC that logs actor_customer_id — e.g.
-- tgd_admin_update_withdrawal_line_source, tgd_recall_confirmed_deposit_request).

begin;

create or replace function public.tgd_admin_add_customer_withdrawal_request_line(
  p_withdrawal_request_id uuid,
  p_customer_product_code text,
  p_tracking_code text default null,
  p_lot_no text default null,
  p_product_name text default null,
  p_requested_boxes numeric default null,
  p_requested_weight numeric default null,
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
  v_deposit_line record;
  v_max_boxes numeric;
  v_max_weight numeric;
  v_claimed_boxes numeric;
  v_claimed_weight numeric;
  v_new_line_no integer;
  v_new_line_id uuid;
  v_product_name text;
  v_internal_product_code text;
  v_tracking_code text := nullif(btrim(p_tracking_code), '');
  v_lot_no text := nullif(btrim(p_lot_no), '');
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
    raise exception 'Warehouse role required to add a withdrawal line';
  end if;

  if p_customer_product_code is null or btrim(p_customer_product_code) = '' then
    raise exception 'Customer product code is required';
  end if;

  select w.id, w.customer_id, w.status
  into v_document
  from public.tgd_customer_withdrawal_requests w
  where w.id = p_withdrawal_request_id
  for update;
  if not found then
    raise exception 'Customer withdrawal request not found';
  end if;

  if v_document.status not in ('ADMIN_ACCEPTED', 'WAREHOUSE_PICKING') then
    raise exception 'Withdrawal request must be ADMIN_ACCEPTED or WAREHOUSE_PICKING to add a line (current status: %)', v_document.status;
  end if;

  select cp.product_name, cp.internal_product_code into v_catalog
  from public.tgd_customer_products cp
  where cp.customer_id = v_document.customer_id
    and cp.customer_product_code = btrim(p_customer_product_code)
  limit 1;

  v_product_name := coalesce(nullif(btrim(p_product_name), ''), v_catalog.product_name, btrim(p_customer_product_code));
  v_internal_product_code := v_catalog.internal_product_code;

  if v_tracking_code is not null then
    select dl.id, dl.lot_no, dl.actual_boxes, dl.actual_weight, dl.expected_boxes, dl.expected_weight
    into v_deposit_line
    from public.tgd_customer_deposit_request_lines dl
    join public.tgd_customer_deposit_requests dr on dr.id = dl.deposit_request_id
    where dr.customer_id = v_document.customer_id
      and dr.status in ('RECEIVED_CONFIRMED', 'CUSTOMER_NOTIFIED')
      and dl.tracking_code = v_tracking_code
    limit 1
    for update of dl;

    if not found then
      raise exception 'No confirmed deposit lot found with tracking code %', v_tracking_code;
    end if;

    v_lot_no := coalesce(v_lot_no, v_deposit_line.lot_no);

    v_max_boxes := coalesce(v_deposit_line.actual_boxes, v_deposit_line.expected_boxes, 0);
    v_max_weight := coalesce(v_deposit_line.actual_weight, v_deposit_line.expected_weight, 0);

    select coalesce(sum(coalesce(wl.picked_boxes, wl.requested_boxes)), 0),
           coalesce(sum(coalesce(wl.picked_weight, wl.requested_weight)), 0)
    into v_claimed_boxes, v_claimed_weight
    from public.tgd_customer_withdrawal_request_lines wl
    join public.tgd_customer_withdrawal_requests wr on wr.id = wl.withdrawal_request_id
    where wr.status <> 'CANCELLED'
      and (
        wl.source_customer_deposit_request_line_id = v_deposit_line.id
        or wl.tracking_code = v_tracking_code
      );

    if v_max_boxes > 0 and p_requested_boxes is not null
       and p_requested_boxes > (v_max_boxes - v_claimed_boxes) then
      raise exception 'Requested boxes (%) exceed remaining balance (%) for tracking code %',
        p_requested_boxes, greatest(0, v_max_boxes - v_claimed_boxes), v_tracking_code;
    end if;

    if v_max_weight > 0 and p_requested_weight is not null
       and p_requested_weight > (v_max_weight - v_claimed_weight) then
      raise exception 'Requested weight (%) exceeds remaining balance (%) for tracking code %',
        p_requested_weight, greatest(0, v_max_weight - v_claimed_weight), v_tracking_code;
    end if;
  end if;

  select coalesce(max(line_no), 0) + 1 into v_new_line_no
  from public.tgd_customer_withdrawal_request_lines
  where withdrawal_request_id = v_document.id;

  insert into public.tgd_customer_withdrawal_request_lines (
    withdrawal_request_id, line_no,
    source_customer_deposit_request_line_id,
    customer_product_code, internal_product_code, product_name,
    lot_no, tracking_code,
    requested_boxes, requested_weight,
    picking_rule, note
  ) values (
    v_document.id, v_new_line_no,
    v_deposit_line.id,
    btrim(p_customer_product_code), v_internal_product_code, v_product_name,
    v_lot_no, v_tracking_code,
    p_requested_boxes, p_requested_weight,
    case when v_tracking_code is not null then 'SPECIFIC_DEPOSIT' else 'FEFO' end,
    nullif(btrim(p_note), '')
  )
  returning id into v_new_line_id;

  update public.tgd_customer_withdrawal_requests
  set last_action_by_user_id = v_profile.id,
      last_action_by_email = v_profile.email,
      last_action_at = now()
  where id = v_document.id;

  insert into public.tgd_customer_document_timeline_events (
    document_type, document_id, customer_id, action, from_status, to_status,
    actor_user_id, actor_email, actor_role, actor_customer_id, comment, metadata_json
  ) values (
    'CUSTOMER_WITHDRAWAL_REQUEST', v_document.id, v_document.customer_id,
    'ADMIN_ADD_LINE', v_document.status, v_document.status,
    v_profile.id, v_profile.email, v_profile.role, v_profile.customer_id,
    nullif(btrim(p_note), ''),
    jsonb_build_object(
      'line_id', v_new_line_id, 'line_no', v_new_line_no,
      'customer_product_code', btrim(p_customer_product_code),
      'tracking_code', v_tracking_code,
      'requested_boxes', p_requested_boxes, 'requested_weight', p_requested_weight
    )
  );

  return jsonb_build_object(
    'line_id', v_new_line_id,
    'withdrawal_request_id', v_document.id,
    'line_no', v_new_line_no,
    'status', v_document.status,
    'tracking_code', v_tracking_code
  );
end;
$$;

commit;
