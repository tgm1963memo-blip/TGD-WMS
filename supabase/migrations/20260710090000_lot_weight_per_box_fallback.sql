-- When a product has no standard weight defined on the master catalog
-- (tgd_customer_products.pack_weight_kg), every withdrawal touchpoint today
-- requires typing box count AND weight independently, with nothing tying
-- them together. Real box weights vary lot to lot, so these independently
-- typed weights drift from the lot's true average — this is what caused
-- LOT 097 (RPC032, tracking XX260630137) and LOT 100 (XX260630139) to show
-- 0 kg remaining while boxes were still left: withdrawal weights summed to
-- the full received weight well before all boxes were withdrawn.
--
-- Fix: derive a fallback weight/box per deposit line (per tracking code, not
-- pooled across a LOT's sibling lines — see migration 20260708100019 on why
-- pooling is unsafe) from what was actually received: actual_weight /
-- actual_boxes. Never overwrites an existing weight_per_box (master-derived
-- or customer-declared) — only fills lines that are currently NULL.

begin;

-- 1. Auto-fill going forward: extend the receiving RPC so weight_per_box
--    gets computed the moment actual_boxes/actual_weight are recorded, if
--    it isn't already set.
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
      location_id   = coalesce(p_location_id, location_id),
      weight_per_box = coalesce(
        weight_per_box,
        case
          when coalesce(p_actual_boxes, actual_boxes) > 0
           and coalesce(p_actual_weight, actual_weight) is not null
          then coalesce(p_actual_weight, actual_weight) / coalesce(p_actual_boxes, actual_boxes)
          else null
        end
      )
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

-- 2. One-time backfill for existing lines: fill weight_per_box only where
--    it is currently NULL, the product has no master pack_weight_kg, and
--    actual receiving figures exist to compute an average from.
update public.tgd_customer_deposit_request_lines dl
set weight_per_box = dl.actual_weight / dl.actual_boxes
from public.tgd_customer_deposit_requests dr
where dl.deposit_request_id = dr.id
  and dl.weight_per_box is null
  and dl.actual_boxes > 0
  and dl.actual_weight is not null
  and not exists (
    select 1 from public.tgd_customer_products cp
    where cp.customer_id = dr.customer_id
      and cp.customer_product_code = dl.customer_product_code
      and cp.pack_weight_kg is not null
  );

commit;
