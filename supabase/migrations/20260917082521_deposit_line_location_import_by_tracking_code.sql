-- Replaces the previous "default location per catalog product" feature
-- (20260916220003) with a per-LOT (tracking_code) location assignment
-- import. A catalog product_code can have many tracking_codes (received
-- across many shipments over time), each potentially sitting in a
-- different real location -- a single default_location_id on
-- tgd_customer_products never made sense once that's accounted for.
-- Confirmed zero rows had it set, so dropping it loses nothing.

begin;

drop function if exists public.tgd_import_product_location_assignments(jsonb);

drop index if exists public.idx_tgd_customer_products_default_location_id;

alter table public.tgd_customer_products
  drop column if exists default_location_id;

-- Per-row bulk import keyed by (customer_code, tracking_code): resolves to
-- one tgd_customer_deposit_request_lines row (must belong to a
-- RECEIVED_CONFIRMED/CUSTOMER_NOTIFIED request -- only "live in the
-- warehouse" lots are addressable here), then edits its
-- tgd_customer_deposit_line_locations allocation(s):
--   0 allocations + location given -> create one (pallet_no 1, full
--     actual_boxes/actual_weight of the line)
--   1+ allocations + location given -> move ALL of them to the new location
--     (UPDATE location_id only, on every allocation row for this line) --
--     never deletes/reinserts, so pallet_no/boxes/weight and any pick
--     history (tgd_customer_withdrawal_line_pallet_picks references these
--     rows by id) stay completely intact even for a lot that was already
--     split across several pallets/locations. Per explicit user request,
--     ANY lot is editable this way, including ones that already have a
--     location -- a split lot just ends up with every one of its pallets
--     re-pointed at the single new location.
--   location_code blank -> no-op (skipped, not an error) -- leaving the
--     cell blank means "don't touch this lot's location", not "clear it";
--     clearing a real physical allocation is a bigger, separate action
-- A row that doesn't resolve is skipped entirely (no partial save) and
-- reported back with its row index, same {processed, errors} shape as the
-- other bulk-import RPCs in this system.
create or replace function public.tgd_import_deposit_line_location_assignments(p_rows jsonb)
returns jsonb
language plpgsql security definer set search_path to 'public'
as $$
declare
  v_auth_user_id uuid := auth.uid();
  v_profile record;
  v_row jsonb;
  v_idx int := 0;
  v_customer_code text;
  v_tracking_code text;
  v_location_code text;
  v_customer_id uuid;
  v_line record;
  v_location_id uuid;
  v_allocation_count int;
  v_processed int := 0;
  v_errors jsonb := '[]'::jsonb;
begin
  if v_auth_user_id is null or not public.tgd_current_user_is_active() then
    raise exception 'Active authenticated user required';
  end if;

  select p.id, p.role into v_profile
  from public.tgd_user_profiles p
  where p.auth_user_id = v_auth_user_id and p.is_active = true
  limit 1;
  if not found then raise exception 'User profile not found'; end if;

  if v_profile.role not in ('admin','accounting','warehouse_admin','warehouse_manager','warehouse_staff') then
    raise exception 'Insufficient role to import location assignments';
  end if;

  for v_row in select * from jsonb_array_elements(p_rows)
  loop
    v_idx := v_idx + 1;
    v_customer_code := nullif(trim(v_row->>'customer_code'), '');
    v_tracking_code := nullif(trim(v_row->>'tracking_code'), '');
    v_location_code := nullif(trim(v_row->>'location_code'), '');

    if v_customer_code is null then
      v_errors := v_errors || jsonb_build_object('row', coalesce((v_row->>'__row')::int, v_idx + 1), 'reason', 'customer_code ไม่ระบุ');
      continue;
    end if;
    if v_tracking_code is null then
      v_errors := v_errors || jsonb_build_object('row', coalesce((v_row->>'__row')::int, v_idx + 1), 'reason', 'tracking_code ไม่ระบุ');
      continue;
    end if;

    -- Blank location_code is a deliberate no-op, not skipped-as-error --
    -- don't even look the row up, so it never shows in the error list.
    if v_location_code is null then
      continue;
    end if;

    select id into v_customer_id from public.tgd_customers where customer_code = v_customer_code limit 1;
    if v_customer_id is null then
      v_errors := v_errors || jsonb_build_object('row', coalesce((v_row->>'__row')::int, v_idx + 1), 'reason', 'ไม่พบลูกค้ารหัส: ' || v_customer_code);
      continue;
    end if;

    select dl.id, dl.actual_boxes, dl.actual_weight
    into v_line
    from public.tgd_customer_deposit_request_lines dl
    join public.tgd_customer_deposit_requests dr on dr.id = dl.deposit_request_id
    where dr.customer_id = v_customer_id
      and dl.tracking_code = v_tracking_code
      and dr.status in ('RECEIVED_CONFIRMED', 'CUSTOMER_NOTIFIED')
    limit 1
    for update of dl;

    if not found then
      v_errors := v_errors || jsonb_build_object('row', coalesce((v_row->>'__row')::int, v_idx + 1), 'reason',
        'ไม่พบรหัสติดตาม: ' || v_tracking_code || ' ของลูกค้า ' || v_customer_code || ' (ต้องเป็นล็อตที่รับเข้าแล้ว)');
      continue;
    end if;

    select id into v_location_id from public.tgd_locations where location_code = v_location_code limit 1;
    if v_location_id is null then
      v_errors := v_errors || jsonb_build_object('row', coalesce((v_row->>'__row')::int, v_idx + 1), 'reason', 'ไม่พบ location_code: ' || v_location_code);
      continue;
    end if;

    select count(*) into v_allocation_count
    from public.tgd_customer_deposit_line_locations
    where line_id = v_line.id;

    if v_allocation_count = 0 then
      insert into public.tgd_customer_deposit_line_locations (line_id, location_id, pallet_no, boxes, weight)
      values (v_line.id, v_location_id, 1, v_line.actual_boxes, v_line.actual_weight);
    else
      update public.tgd_customer_deposit_line_locations
      set location_id = v_location_id
      where line_id = v_line.id;
    end if;

    update public.tgd_customer_deposit_request_lines set location_id = v_location_id where id = v_line.id;
    v_processed := v_processed + 1;
  end loop;

  return jsonb_build_object('processed', v_processed, 'errors', v_errors);
end;
$$;

notify pgrst, 'reload schema';
commit;
