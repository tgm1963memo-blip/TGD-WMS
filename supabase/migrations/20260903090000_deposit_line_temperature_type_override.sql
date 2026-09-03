-- tgd_record_deposit_line_actual_receipt only ever derived temperature_type
-- from the customer product catalog (tgd_customer_products) when a product
-- code was (re-)supplied. That's correct for the normal case (a mis-scanned
-- product code), but gives no way to correct a specific physical lot's
-- storage classification when it genuinely differs from the catalog's
-- default for that SKU (e.g. this lot needs Freeze & Frozen storage even
-- though the SKU's catalog default is Frozen). Add an optional direct
-- override param that takes precedence over both the existing value and the
-- catalog re-derivation, and record it in the audit trail.

begin;

create or replace function public.tgd_record_deposit_line_actual_receipt(
  p_line_id uuid,
  p_actual_boxes integer,
  p_actual_weight numeric,
  p_note text default null,
  p_lot_no text default null,
  p_mfg_date date default null,
  p_exp_date date default null,
  p_location_id uuid default null,
  p_customer_product_code text default null,
  p_temperature_type text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_auth_user_id uuid := auth.uid();
  v_profile      record;
  v_line         record;
  v_new_code     text := nullif(btrim(coalesce(p_customer_product_code, '')), '');
  v_new_temperature_type text := nullif(btrim(coalesce(p_temperature_type, '')), '');
  v_catalog      record;
  v_internal_product_code text;
  v_product_name text;
  v_temperature_type text;
  v_withdrawn_boxes  numeric := 0;
  v_withdrawn_weight numeric := 0;
  v_new_boxes  integer;
  v_new_weight numeric;
  v_new_lot_no text;
begin
  if v_auth_user_id is null or not public.tgd_current_user_is_active() then
    raise exception 'Active authenticated user required';
  end if;

  if v_new_temperature_type is not null
     and v_new_temperature_type not in ('FROZEN', 'FREEZE', 'CHILLED', 'FREEZE_FROZEN', 'AMBIENT') then
    raise exception 'Invalid temperature_type: %', v_new_temperature_type;
  end if;

  select p.id, p.email, p.role, p.customer_id
  into v_profile
  from public.tgd_user_profiles p
  where p.auth_user_id = v_auth_user_id
    and p.is_active = true
  limit 1;

  if not found then
    raise exception 'User profile not found';
  end if;

  if v_profile.role not in ('admin', 'accounting', 'warehouse_manager', 'warehouse_admin', 'warehouse_staff') then
    raise exception 'Warehouse or admin role required to record actual receipt';
  end if;

  select l.id, l.deposit_request_id, l.actual_boxes, l.actual_weight, l.lot_no, l.tracking_code,
         l.internal_product_code, l.product_name, l.temperature_type,
         dr.customer_id, dr.status as document_status
  into v_line
  from public.tgd_customer_deposit_request_lines l
  join public.tgd_customer_deposit_requests dr on dr.id = l.deposit_request_id
  where l.id = p_line_id
  for update of l;

  if not found then
    raise exception 'Deposit request line not found';
  end if;

  v_new_boxes  := coalesce(p_actual_boxes, v_line.actual_boxes);
  v_new_weight := coalesce(p_actual_weight, v_line.actual_weight);
  v_new_lot_no := coalesce(nullif(btrim(coalesce(p_lot_no, '')), ''), v_line.lot_no);

  -- Sum this line's withdrawal claims the same way getDepositInventoryLines
  -- does: a claim carries this line's id directly once it exists, older
  -- rows only carry the matching tracking_code — never both counted for
  -- the same withdrawal line, so attribute by id first and only fall back
  -- to tracking_code for rows that have no direct id at all.
  select coalesce(sum(coalesce(wl.picked_boxes, wl.requested_boxes, 0)), 0),
         coalesce(sum(coalesce(wl.picked_weight, wl.requested_weight, 0)), 0)
  into v_withdrawn_boxes, v_withdrawn_weight
  from public.tgd_customer_withdrawal_request_lines wl
  join public.tgd_customer_withdrawal_requests wr on wr.id = wl.withdrawal_request_id
  where wr.status <> 'CANCELLED'
    and (
      wl.source_customer_deposit_request_line_id = p_line_id
      or (wl.source_customer_deposit_request_line_id is null
          and v_line.tracking_code is not null
          and wl.tracking_code = v_line.tracking_code)
    );

  if v_new_boxes is not null and v_new_boxes < v_withdrawn_boxes then
    raise exception 'ไม่สามารถแก้ไขจำนวนกล่องให้น้อยกว่าที่เบิกไปแล้วได้ (เบิกไปแล้ว % กล่อง แต่พยายามแก้ไขเป็น % กล่อง)',
      v_withdrawn_boxes, v_new_boxes;
  end if;

  if v_new_weight is not null and v_new_weight < v_withdrawn_weight then
    raise exception 'ไม่สามารถแก้ไขน้ำหนักให้น้อยกว่าที่เบิกไปแล้วได้ (เบิกไปแล้ว % กก. แต่พยายามแก้ไขเป็น % กก.)',
      v_withdrawn_weight, v_new_weight;
  end if;

  -- Defaults: no recode requested, keep the line's existing values.
  v_internal_product_code := v_line.internal_product_code;
  v_product_name := v_line.product_name;
  v_temperature_type := v_line.temperature_type;

  if v_new_code is not null then
    select cp.product_name, cp.internal_product_code, cp.temperature_type
    into v_catalog
    from public.tgd_customer_products cp
    where cp.customer_id = v_line.customer_id
      and cp.customer_product_code = v_new_code
    limit 1;

    v_internal_product_code := coalesce(v_catalog.internal_product_code, v_new_code);
    v_product_name := coalesce(v_catalog.product_name, v_line.product_name);
    v_temperature_type := coalesce(v_catalog.temperature_type, v_line.temperature_type);
  end if;

  -- A direct override always wins, even over a freshly re-derived catalog
  -- value — this is how one specific physical lot's storage classification
  -- is corrected without touching the SKU's catalog default.
  if v_new_temperature_type is not null then
    v_temperature_type := v_new_temperature_type;
  end if;

  update public.tgd_customer_deposit_request_lines
  set actual_boxes  = v_new_boxes,
      actual_weight = v_new_weight,
      actual_note   = nullif(btrim(coalesce(p_note, '')), ''),
      lot_no        = v_new_lot_no,
      mfg_date      = coalesce(p_mfg_date, mfg_date),
      exp_date      = coalesce(p_exp_date, exp_date),
      location_id   = coalesce(p_location_id, location_id),
      weight_per_box = case
        when v_new_boxes > 0 and v_new_weight is not null
        then v_new_weight / v_new_boxes
        else weight_per_box
      end,
      customer_product_code = coalesce(v_new_code, customer_product_code),
      internal_product_code = v_internal_product_code,
      product_name = v_product_name,
      temperature_type = v_temperature_type
  where id = p_line_id;

  insert into public.tgd_customer_document_timeline_events (
    document_type, document_id, customer_id, action, from_status, to_status,
    actor_user_id, actor_email, actor_role, actor_customer_id, comment, metadata_json
  ) values (
    'CUSTOMER_DEPOSIT_REQUEST', v_line.deposit_request_id, v_line.customer_id,
    'EDIT_LINE_ACTUAL_RECEIPT', v_line.document_status, v_line.document_status,
    v_profile.id, v_profile.email, v_profile.role, v_profile.customer_id,
    nullif(btrim(coalesce(p_note, '')), ''),
    jsonb_build_object(
      'line_id', p_line_id,
      'actual_boxes_before', v_line.actual_boxes, 'actual_boxes_after', v_new_boxes,
      'actual_weight_before', v_line.actual_weight, 'actual_weight_after', v_new_weight,
      'lot_no_before', v_line.lot_no, 'lot_no_after', v_new_lot_no,
      'temperature_type_before', v_line.temperature_type, 'temperature_type_after', v_temperature_type,
      'withdrawn_boxes', v_withdrawn_boxes, 'withdrawn_weight', v_withdrawn_weight
    )
  );

  return (
    select jsonb_build_object(
      'id', l.id,
      'deposit_request_id', l.deposit_request_id,
      'actual_boxes', l.actual_boxes,
      'actual_weight', l.actual_weight,
      'lot_no', l.lot_no,
      'location_id', l.location_id,
      'customer_product_code', l.customer_product_code,
      'internal_product_code', l.internal_product_code,
      'product_name', l.product_name,
      'temperature_type', l.temperature_type,
      'weight_per_box', l.weight_per_box
    )
    from public.tgd_customer_deposit_request_lines l
    where l.id = p_line_id
  );
end;
$$;

grant execute on function public.tgd_record_deposit_line_actual_receipt(uuid, integer, numeric, text, text, date, date, uuid, text, text)
  to authenticated;

drop function if exists public.tgd_record_deposit_line_actual_receipt(uuid, integer, numeric, text, text, date, date, uuid, text);

commit;
