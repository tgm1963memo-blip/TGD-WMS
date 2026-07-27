-- Recalculates weight_per_box every time actual receiving figures are
-- recorded or corrected, instead of freezing it at whatever was first saved.
--
-- Root cause: 20260710090000 made tgd_record_deposit_line_actual_receipt
-- fill weight_per_box with actual_weight/actual_boxes only when it was
-- still NULL ("never overwrite an existing value" — meant to protect a
-- master-catalog/customer-declared per-box weight from drifting). But for
-- lines with no master/customer value, weight_per_box is itself DERIVED
-- from actual receiving figures — so when a later recount corrects
-- actual_boxes/actual_weight (e.g. via the admin recount modal), the
-- derived weight_per_box was never recomputed and stayed stuck at the
-- first-ever actual figures. That's what showed as a wrong "น้ำหนักต่อหน่วย"
-- on CDR-20260724-0001 lines 3/4/5 (all three had a recount correction
-- after their first actual entry) while uncorrected lines looked fine.
--
-- Fix: recompute weight_per_box = actual_weight / actual_boxes on every
-- call that has both figures available, so it always reflects the most
-- recently recorded actual receipt — the printed document's actual_boxes/
-- actual_weight and its weight-per-unit column now always agree.

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
  p_customer_product_code text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_auth_user_id uuid := auth.uid();
  v_profile record;
  v_line record;
  v_new_code text := nullif(btrim(coalesce(p_customer_product_code, '')), '');
  v_catalog record;
  v_internal_product_code text;
  v_product_name text;
  v_temperature_type text;
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

  if not found then
    raise exception 'User profile not found';
  end if;

  if v_profile.role not in ('admin', 'accounting', 'warehouse_manager', 'warehouse_admin', 'warehouse_staff') then
    raise exception 'Warehouse or admin role required to record actual receipt';
  end if;

  select l.id, l.deposit_request_id, l.actual_boxes, l.actual_weight,
         l.internal_product_code, l.product_name, l.temperature_type,
         dr.customer_id
  into v_line
  from public.tgd_customer_deposit_request_lines l
  join public.tgd_customer_deposit_requests dr on dr.id = l.deposit_request_id
  where l.id = p_line_id;

  if not found then
    raise exception 'Deposit request line not found';
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

  update public.tgd_customer_deposit_request_lines
  set actual_boxes  = coalesce(p_actual_boxes, actual_boxes),
      actual_weight = coalesce(p_actual_weight, actual_weight),
      actual_note   = nullif(btrim(coalesce(p_note, '')), ''),
      lot_no        = coalesce(nullif(btrim(coalesce(p_lot_no, '')), ''), lot_no),
      mfg_date      = coalesce(p_mfg_date, mfg_date),
      exp_date      = coalesce(p_exp_date, exp_date),
      location_id   = coalesce(p_location_id, location_id),
      weight_per_box = case
        when coalesce(p_actual_boxes, actual_boxes) > 0
         and coalesce(p_actual_weight, actual_weight) is not null
        then coalesce(p_actual_weight, actual_weight) / coalesce(p_actual_boxes, actual_boxes)
        else weight_per_box
      end,
      customer_product_code = coalesce(v_new_code, customer_product_code),
      internal_product_code = v_internal_product_code,
      product_name = v_product_name,
      temperature_type = v_temperature_type
  where id = p_line_id;

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

grant execute on function public.tgd_record_deposit_line_actual_receipt(uuid, integer, numeric, text, text, date, date, uuid, text)
  to authenticated;

-- One-time backfill: recompute weight_per_box for every existing line that
-- already has actual receiving figures on file, so lines that were already
-- corrected before this fix (e.g. CDR-20260724-0001 lines 3/4/5) show the
-- right value immediately instead of waiting for another recount.
update public.tgd_customer_deposit_request_lines
set weight_per_box = actual_weight / actual_boxes
where actual_boxes > 0
  and actual_weight is not null
  and weight_per_box is distinct from (actual_weight / actual_boxes);

commit;
