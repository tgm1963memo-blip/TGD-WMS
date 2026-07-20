-- Lets warehouse/admin staff add a brand-new line to an already-submitted
-- customer deposit request, for when the customer's physical delivery
-- included an item that wasn't on their original declared list
-- ("ลูกค้าฝากสินค้าเข้ามาผิดรายการ"). Every existing INSERT path into
-- tgd_customer_deposit_request_lines (tgd_upsert_customer_deposit_request_line)
-- only works while status = 'DRAFT' (the customer's own pre-submission
-- editing), so there was no way to add a line once a request had already
-- been submitted and staff started receiving it.
--
-- Scoped to the receiving-phase statuses BEFORE receipt is confirmed
-- (mirrors tgd_record_deposit_line_actual_receipt's status set, minus
-- RECEIVED_CONFIRMED) so the new line's actual_boxes/actual_weight are
-- already populated by the time tgd_create_stock_movements_from_deposit
-- runs its once-only sweep over all lines at CONFIRM_RECEIPT — that
-- existing, idempotent-per-line loop picks the new line up naturally,
-- with no separate stock-movement/balance logic needed here.

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

  if v_document.status not in ('WAREHOUSE_RECEIVING', 'PALLETIZING', 'COUNT_VARIANCE_REVIEW', 'ADMIN_RECOUNT_REQUESTED') then
    raise exception 'Request must be in receiving state (before receipt is confirmed) to add a line';
  end if;

  -- Auto-fill name/temperature from the customer's own catalog when staff
  -- only typed the code, same lookup the customer's own creation form uses.
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
