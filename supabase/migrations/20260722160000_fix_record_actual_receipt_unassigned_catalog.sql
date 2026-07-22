-- Fixes a regression introduced by 20260722140000: tgd_record_deposit_line_actual_receipt
-- declared `v_catalog record` and only populated it inside
-- `if v_new_code is not null then select ... into v_catalog end if`, but the
-- UPDATE statement's SET clause referenced v_catalog.internal_product_code /
-- v_catalog.product_name / v_catalog.temperature_type unconditionally inside
-- CASE expressions. PL/pgSQL must resolve every variable reference appearing
-- in a SQL statement's text before running it, regardless of which CASE
-- branch ultimately applies — so whenever v_new_code was null (i.e. every
-- normal "record actual receipt" save that isn't also recoding the product,
-- which is nearly all of them), v_catalog was never assigned at all and the
-- reference raised "record \"v_catalog\" is not assigned yet", breaking
-- weight/box entry for every deposit line.
--
-- Fix: resolve the three catalog-derived values into plain scalar variables
-- BEFORE the UPDATE (defaulting to the line's existing values when no recode
-- was requested), and reference only those scalars in the UPDATE — never a
-- possibly-unassigned record field.

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
