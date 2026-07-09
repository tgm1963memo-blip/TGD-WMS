-- Fix tgd_record_deposit_line_actual_receipt() unconditionally overwriting
-- actual_boxes / actual_weight with NULL.
--
-- Bug: every other field in this function (lot_no, mfg_date, exp_date,
-- location_id) uses COALESCE(new_value, old_value) so a caller that omits a
-- field preserves what was already saved. actual_boxes / actual_weight did
-- not follow that pattern — if a caller (handheld receiving, admin recount
-- modal) posts a box count but leaves the weight field blank, p_actual_weight
-- arrives as NULL and wipes out a previously recorded actual_weight.
--
-- Fix: apply the same COALESCE(new, old) pattern already used for the other
-- fields in this function.

create or replace function public.tgd_record_deposit_line_actual_receipt(
  p_line_id uuid,
  p_actual_boxes integer,
  p_actual_weight numeric,
  p_note text default null,
  p_lot_no text default null,
  p_mfg_date date default null,
  p_exp_date date default null,
  p_location_id uuid default null
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

  select l.id, l.deposit_request_id, l.actual_boxes, l.actual_weight
  into v_line
  from public.tgd_customer_deposit_request_lines l
  where l.id = p_line_id;

  if not found then
    raise exception 'Deposit request line not found';
  end if;

  update public.tgd_customer_deposit_request_lines
  set actual_boxes  = coalesce(p_actual_boxes, actual_boxes),
      actual_weight = coalesce(p_actual_weight, actual_weight),
      actual_note   = nullif(btrim(coalesce(p_note, '')), ''),
      lot_no        = coalesce(nullif(btrim(coalesce(p_lot_no, '')), ''), lot_no),
      mfg_date      = coalesce(p_mfg_date, mfg_date),
      exp_date      = coalesce(p_exp_date, exp_date),
      location_id   = coalesce(p_location_id, location_id)
  where id = p_line_id;

  return jsonb_build_object(
    'id', v_line.id,
    'deposit_request_id', v_line.deposit_request_id,
    'actual_boxes', coalesce(p_actual_boxes, v_line.actual_boxes),
    'actual_weight', coalesce(p_actual_weight, v_line.actual_weight),
    'lot_no', p_lot_no,
    'location_id', p_location_id
  );
end;
$$;

grant execute on function public.tgd_record_deposit_line_actual_receipt(uuid, integer, numeric, text, text, date, date, uuid)
  to authenticated;
