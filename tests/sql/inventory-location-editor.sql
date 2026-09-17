-- Integration checks against received stock. All changes are rolled back.
-- Run explicitly: npx supabase db query --linked -f tests/sql/inventory-location-editor.sql
begin;

create function pg_temp.expect_inventory_error(p_sql text, p_message text) returns void
language plpgsql as $$
declare v_failed boolean := false;
begin
  begin execute p_sql;
  exception when others then
    if position(p_message in sqlerrm) = 0 then raise; end if;
    v_failed := true;
  end;
  if not v_failed then raise exception 'Expected rejection: %', p_message; end if;
end;
$$;

do $$
declare
  v_profile record;
  v_source record;
  v_empty record;
  v_unassigned record;
  v_dest record;
  v_after record;
  v_before jsonb;
  v_picks jsonb;
  v_added jsonb;
  v_role text;
begin
  select * into strict v_profile from public.tgd_user_profiles
    where role = 'admin' and is_active = true and auth_user_id is not null limit 1;
  perform set_config('request.jwt.claim.sub', v_profile.auth_user_id::text, true);
  select a.* into strict v_source from public.tgd_customer_deposit_line_locations a
    join public.tgd_customer_deposit_request_lines dl on dl.id = a.line_id
    join public.tgd_customer_deposit_requests dr on dr.id = dl.deposit_request_id
    where dr.status in ('RECEIVED_CONFIRMED', 'CUSTOMER_NOTIFIED')
      and a.boxes > coalesce((select sum(boxes) from public.tgd_customer_withdrawal_line_pallet_picks where deposit_line_location_id = a.id), 0)
    order by exists(select 1 from public.tgd_customer_withdrawal_line_pallet_picks where deposit_line_location_id = a.id) desc, a.id limit 1;
  select l.id, l.capacity, min(n) as slot into strict v_dest from public.tgd_locations l
    join public.tgd_rooms r on r.id = l.room_id join public.tgd_zones z on z.id = r.zone_id
    cross join lateral generate_series(1, l.capacity) n
    where z.is_active = true and l.id <> v_source.location_id and not exists (
      select 1 from public.tgd_customer_deposit_line_locations a where a.location_id = l.id and a.pallet_no = n
      and (a.boxes is null or a.boxes > coalesce((select sum(boxes) from public.tgd_customer_withdrawal_line_pallet_picks where deposit_line_location_id = a.id), 0)))
    group by l.id, l.capacity having count(*) >= 3 order by l.id limit 1;
  select coalesce(jsonb_agg(to_jsonb(a) order by a.id), '[]'::jsonb) into v_before
    from public.tgd_customer_deposit_line_locations a where a.line_id = v_source.line_id and a.id <> v_source.id;
  select coalesce(jsonb_agg(to_jsonb(p) order by p.id), '[]'::jsonb) into v_picks
    from public.tgd_customer_withdrawal_line_pallet_picks p where p.deposit_line_location_id = v_source.id;

  perform public.tgd_move_inventory_pallet(v_source.id, v_dest.id, v_dest.slot, v_source.location_id, v_source.pallet_no);
  select * into strict v_after from public.tgd_customer_deposit_line_locations where id = v_source.id;
  if (to_jsonb(v_source) - 'location_id' - 'pallet_no') is distinct from (to_jsonb(v_after) - 'location_id' - 'pallet_no') then
    raise exception 'Move changed allocation quantities or identity';
  end if;
  if v_before is distinct from (select coalesce(jsonb_agg(to_jsonb(a) order by a.id), '[]'::jsonb)
    from public.tgd_customer_deposit_line_locations a where a.line_id = v_source.line_id and a.id <> v_source.id) then
    raise exception 'Move changed another pallet';
  end if;
  if v_picks is distinct from (select coalesce(jsonb_agg(to_jsonb(p) order by p.id), '[]'::jsonb)
    from public.tgd_customer_withdrawal_line_pallet_picks p where p.deposit_line_location_id = v_source.id) then
    raise exception 'Move changed pick history';
  end if;
  perform pg_temp.expect_inventory_error(format('select public.tgd_move_inventory_pallet(%L,%L,%s,%L,%s)',
    v_source.id, v_dest.id, v_dest.slot, v_source.location_id, v_source.pallet_no), 'ตำแหน่งถูกแก้ไขแล้ว');
  perform pg_temp.expect_inventory_error(format('select public.tgd_move_inventory_pallet(%L,%L,%s,%L,%s)',
    v_source.id, v_dest.id, v_dest.capacity + 1, v_dest.id, v_dest.slot), 'เกินความจุ');

  -- Role changes exist only inside this rolled-back transaction.
  foreach v_role in array array['warehouse_admin', 'warehouse_manager', 'admin'] loop
    update public.tgd_user_profiles set role = v_role where id = v_profile.id;
    perform public.tgd_move_inventory_pallet(v_source.id, v_dest.id, v_dest.slot, v_dest.id, v_dest.slot);
  end loop;
  foreach v_role in array array['warehouse_staff', 'accounting', 'viewer'] loop
    update public.tgd_user_profiles set role = v_role where id = v_profile.id;
    perform pg_temp.expect_inventory_error(format('select public.tgd_move_inventory_pallet(%L,%L,%s,%L,%s)',
      v_source.id, v_dest.id, v_dest.slot, v_dest.id, v_dest.slot), 'ไม่มีสิทธิ์');
    perform pg_temp.expect_inventory_error(format('select public.tgd_add_inventory_pallet(%L,%L,%s,1,1)',
      v_source.line_id, v_dest.id, v_dest.slot), 'ไม่มีสิทธิ์');
  end loop;
  update public.tgd_user_profiles set role = v_profile.role where id = v_profile.id;

  select a.* into strict v_empty from public.tgd_customer_deposit_line_locations a
    join public.tgd_customer_deposit_request_lines dl on dl.id = a.line_id
    join public.tgd_customer_deposit_requests dr on dr.id = dl.deposit_request_id
    where dr.status in ('RECEIVED_CONFIRMED', 'CUSTOMER_NOTIFIED') and a.boxes is not null
      and a.boxes <= coalesce((select sum(boxes) from public.tgd_customer_withdrawal_line_pallet_picks where deposit_line_location_id = a.id), 0) limit 1;
  perform pg_temp.expect_inventory_error(format('select public.tgd_move_inventory_pallet(%L,%L,%s,%L,%s)',
    v_empty.id, v_dest.id, v_dest.slot, v_empty.location_id, v_empty.pallet_no), 'ไม่มีสินค้าคงเหลือ');

  select dl.* into strict v_unassigned from public.tgd_customer_deposit_request_lines dl
    join public.tgd_customer_deposit_requests dr on dr.id = dl.deposit_request_id
    where dr.status in ('RECEIVED_CONFIRMED', 'CUSTOMER_NOTIFIED') and dl.actual_boxes > 1 and dl.actual_weight > 1
    and not exists(select 1 from public.tgd_customer_deposit_line_locations where line_id = dl.id) limit 1;
  perform pg_temp.expect_inventory_error(format('select public.tgd_add_inventory_pallet(%L,%L,%s,1,1)',
    v_unassigned.id, v_dest.id, v_dest.slot), 'มีสินค้าอยู่แล้ว');
  select min(n) into v_dest.slot from generate_series(1, v_dest.capacity) n where not exists (
    select 1 from public.tgd_customer_deposit_line_locations a where a.location_id = v_dest.id and a.pallet_no = n
      and (a.boxes is null or a.boxes > coalesce((select sum(boxes) from public.tgd_customer_withdrawal_line_pallet_picks where deposit_line_location_id = a.id), 0)));
  perform pg_temp.expect_inventory_error(format('select public.tgd_add_inventory_pallet(%L,%L,%s,%s,%s)',
    v_unassigned.id, v_dest.id, v_dest.slot, v_unassigned.actual_boxes + 1, v_unassigned.actual_weight), 'exceed');
  v_added := public.tgd_add_inventory_pallet(v_unassigned.id, v_dest.id, v_dest.slot, 1, 1);
  perform pg_temp.expect_inventory_error(format('select public.tgd_move_inventory_pallet(%L,%L,%s,%L,%s)',
    v_source.id, v_dest.id, v_dest.slot, v_after.location_id, v_after.pallet_no), 'มีสินค้าอยู่แล้ว');
  select min(n) into v_dest.slot from generate_series(1, v_dest.capacity) n where not exists (
    select 1 from public.tgd_customer_deposit_line_locations a where a.location_id = v_dest.id and a.pallet_no = n
      and (a.boxes is null or a.boxes > coalesce((select sum(boxes) from public.tgd_customer_withdrawal_line_pallet_picks where deposit_line_location_id = a.id), 0)));
  perform public.tgd_add_inventory_pallet(v_unassigned.id, v_dest.id, v_dest.slot, v_unassigned.actual_boxes - 1, v_unassigned.actual_weight - 1);
  if (select sum(boxes) from public.tgd_customer_deposit_line_locations where line_id = v_unassigned.id) <> v_unassigned.actual_boxes then
    raise exception 'Partial/full allocation total mismatch';
  end if;
end;
$$;
rollback;
select 'PASS: move preserves allocations and picks; stale position, roles, full pallets, occupied slots and capacity; partial/full additions and quantity limits. All writes rolled back.' as result;
