-- Lets the admin-only "แก้ไขรายละเอียด LOT (Admin)" modal
-- (CustomerDepositDetailModal.jsx) also recode a deposit line's
-- customer_product_code, instead of that only being possible via a
-- one-off hand-written migration each time staff catch a wrong code
-- (see the several 2026072x "recode_cdr..." migrations this same week).
--
-- When a new code is given, resolve product_name/internal_product_code/
-- temperature_type from the customer's catalog (tgd_customer_products) by
-- that new code, same "prefer catalog, fall back to existing" rule
-- tgd_get_customer_stock_balance already uses (20260720100000) — so
-- recoding to a code the catalog recognizes updates the displayed name to
-- match, while recoding to a code with no catalog entry leaves the
-- existing name alone rather than blanking it.

begin;

-- Adding a trailing parameter changes the signature/arity, so PostgREST
-- would otherwise see this as a second, ambiguous overload alongside the
-- existing 8-arg version rather than a replacement of it (same pattern as
-- 20260708100011's tgd_get_customer_stock_balance drop, or 20260712090000's
-- tgd_upsert_product_service_rate drop) — drop the old signature first.
drop function if exists public.tgd_record_deposit_line_actual_receipt(uuid, integer, numeric, text, text, date, date, uuid);

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

  select l.id, l.deposit_request_id, l.actual_boxes, l.actual_weight, dr.customer_id
  into v_line
  from public.tgd_customer_deposit_request_lines l
  join public.tgd_customer_deposit_requests dr on dr.id = l.deposit_request_id
  where l.id = p_line_id;

  if not found then
    raise exception 'Deposit request line not found';
  end if;

  if v_new_code is not null then
    select cp.product_name, cp.internal_product_code, cp.temperature_type
    into v_catalog
    from public.tgd_customer_products cp
    where cp.customer_id = v_line.customer_id
      and cp.customer_product_code = v_new_code
    limit 1;
  end if;

  update public.tgd_customer_deposit_request_lines
  set actual_boxes  = coalesce(p_actual_boxes, actual_boxes),
      actual_weight = coalesce(p_actual_weight, actual_weight),
      actual_note   = nullif(btrim(coalesce(p_note, '')), ''),
      lot_no        = coalesce(nullif(btrim(coalesce(p_lot_no, '')), ''), lot_no),
      mfg_date      = coalesce(p_mfg_date, mfg_date),
      exp_date      = coalesce(p_exp_date, exp_date),
      location_id   = coalesce(p_location_id, location_id),
      weight_per_box = coalesce(
        weight_per_box,
        case
          when coalesce(p_actual_boxes, actual_boxes) > 0
           and coalesce(p_actual_weight, actual_weight) is not null
          then coalesce(p_actual_weight, actual_weight) / coalesce(p_actual_boxes, actual_boxes)
          else null
        end
      ),
      customer_product_code = coalesce(v_new_code, customer_product_code),
      internal_product_code = case when v_new_code is not null
                                 then coalesce(v_catalog.internal_product_code, v_new_code)
                                 else internal_product_code end,
      product_name = case when v_new_code is not null
                        then coalesce(v_catalog.product_name, product_name)
                        else product_name end,
      temperature_type = case when v_new_code is not null
                           then coalesce(v_catalog.temperature_type, temperature_type)
                           else temperature_type end
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
      'temperature_type', l.temperature_type
    )
    from public.tgd_customer_deposit_request_lines l
    where l.id = p_line_id
  );
end;
$$;

grant execute on function public.tgd_record_deposit_line_actual_receipt(uuid, integer, numeric, text, text, date, date, uuid, text)
  to authenticated;

commit;
