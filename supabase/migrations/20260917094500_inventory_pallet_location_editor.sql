begin;

-- Restricted inventory-page entry points. Existing handheld storage rules
-- (including duplicate/over-capacity warnings) deliberately remain intact.
create or replace function public.tgd_move_inventory_pallet(
  p_allocation_id uuid, p_location_id uuid, p_pallet_no integer,
  p_expected_location_id uuid, p_expected_pallet_no integer
) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_line_id uuid;
  v_allocation record;
  v_capacity integer;
begin
  if auth.uid() is null or not public.tgd_current_user_is_active() or not exists (
    select 1 from public.tgd_user_profiles where auth_user_id = auth.uid()
      and is_active = true and role in ('admin', 'warehouse_admin', 'warehouse_manager')
  ) then raise exception 'ไม่มีสิทธิ์จัดการ Location'; end if;

  select line_id into v_line_id from public.tgd_customer_deposit_line_locations where id = p_allocation_id;
  -- Match the add-storage lock order: deposit line, then location.
  perform 1 from public.tgd_customer_deposit_request_lines dl
    join public.tgd_customer_deposit_requests dr on dr.id = dl.deposit_request_id
    where dl.id = v_line_id and dr.status in ('RECEIVED_CONFIRMED', 'CUSTOMER_NOTIFIED')
    for update of dl;
  if not found then raise exception 'ไม่พบล็อตที่รับเข้าแล้ว'; end if;

  select * into v_allocation from public.tgd_customer_deposit_line_locations
    where id = p_allocation_id for update;
  if not found then raise exception 'ไม่พบพาเลท'; end if;
  if v_allocation.location_id is distinct from p_expected_location_id
    or v_allocation.pallet_no is distinct from p_expected_pallet_no then
    raise exception 'ตำแหน่งถูกแก้ไขแล้ว กรุณาปิดแล้วเปิดหน้าต่างใหม่';
  end if;
  if v_allocation.boxes is not null and v_allocation.boxes <= coalesce((
    select sum(boxes) from public.tgd_customer_withdrawal_line_pallet_picks where deposit_line_location_id = p_allocation_id
  ), 0) then raise exception 'พาเลทนี้ไม่มีสินค้าคงเหลือ'; end if;

  select l.capacity into v_capacity from public.tgd_locations l
    join public.tgd_rooms r on r.id = l.room_id join public.tgd_zones z on z.id = r.zone_id
    where l.id = p_location_id and z.is_active = true for update of l;
  if not found then raise exception 'Location ปลายทางไม่พร้อมใช้งาน'; end if;
  if p_pallet_no is null or p_pallet_no < 1 or v_capacity is null or p_pallet_no > v_capacity then
    raise exception 'เลขพาเลทเกินความจุของ Location';
  end if;
  if exists (
    select 1 from public.tgd_customer_deposit_line_locations a
    where a.location_id = p_location_id and a.pallet_no = p_pallet_no and a.id <> p_allocation_id
      and (a.boxes is null or a.boxes > coalesce((select sum(pk.boxes)
        from public.tgd_customer_withdrawal_line_pallet_picks pk where pk.deposit_line_location_id = a.id), 0))
  ) then raise exception 'ช่องพาเลทปลายทางมีสินค้าอยู่แล้ว กรุณาเลือกช่องใหม่'; end if;

  update public.tgd_customer_deposit_line_locations set location_id = p_location_id, pallet_no = p_pallet_no
    where id = p_allocation_id;
  update public.tgd_customer_deposit_request_lines set location_id = p_location_id where id = v_line_id;
  return jsonb_build_object('id', p_allocation_id, 'location_id', p_location_id, 'pallet_no', p_pallet_no);
end;
$$;

create or replace function public.tgd_add_inventory_pallet(
  p_line_id uuid, p_location_id uuid, p_pallet_no integer, p_boxes numeric, p_weight numeric
) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_line record;
  v_capacity integer;
begin
  if auth.uid() is null or not public.tgd_current_user_is_active() or not exists (
    select 1 from public.tgd_user_profiles where auth_user_id = auth.uid()
      and is_active = true and role in ('admin', 'warehouse_admin', 'warehouse_manager')
  ) then raise exception 'ไม่มีสิทธิ์จัดการ Location'; end if;

  select dl.* into v_line from public.tgd_customer_deposit_request_lines dl
    join public.tgd_customer_deposit_requests dr on dr.id = dl.deposit_request_id
    where dl.id = p_line_id and dr.status in ('RECEIVED_CONFIRMED', 'CUSTOMER_NOTIFIED') for update of dl;
  if not found then raise exception 'ไม่พบล็อตที่รับเข้าแล้ว'; end if;
  if (v_line.actual_boxes is not null and p_boxes is null)
    or (v_line.actual_weight is not null and p_weight is null)
    or coalesce(p_boxes, 0) < 0 or coalesce(p_weight, 0) < 0
    or (coalesce(p_boxes, 0) = 0 and coalesce(p_weight, 0) = 0)
    or (v_line.actual_boxes > 0 and coalesce(p_boxes, 0) = 0)
    or p_boxes::text in ('NaN', 'Infinity', '-Infinity') or p_weight::text in ('NaN', 'Infinity', '-Infinity') then
    raise exception 'กรุณาระบุกล่องและน้ำหนักที่จัดเก็บให้ถูกต้อง';
  end if;
  select l.capacity into v_capacity from public.tgd_locations l
    join public.tgd_rooms r on r.id = l.room_id join public.tgd_zones z on z.id = r.zone_id
    where l.id = p_location_id and z.is_active = true for update of l;
  if not found then raise exception 'Location ปลายทางไม่พร้อมใช้งาน'; end if;
  if p_pallet_no is null or p_pallet_no < 1 or v_capacity is null or p_pallet_no > v_capacity then
    raise exception 'เลขพาเลทเกินความจุของ Location';
  end if;
  if exists (
    select 1 from public.tgd_customer_deposit_line_locations a
    where a.location_id = p_location_id and a.pallet_no = p_pallet_no
      and (a.boxes is null or a.boxes > coalesce((select sum(pk.boxes)
        from public.tgd_customer_withdrawal_line_pallet_picks pk where pk.deposit_line_location_id = a.id), 0))
  ) then raise exception 'ช่องพาเลทปลายทางมีสินค้าอยู่แล้ว กรุณาเลือกช่องใหม่'; end if;

  -- Calls the existing quantity validation and insert under the same locks.
  return public.tgd_add_deposit_line_location_allocation(p_line_id, p_location_id, p_pallet_no, p_boxes, p_weight);
end;
$$;

revoke all on function public.tgd_move_inventory_pallet(uuid, uuid, integer, uuid, integer) from public, anon;
revoke all on function public.tgd_add_inventory_pallet(uuid, uuid, integer, numeric, numeric) from public, anon;
grant execute on function public.tgd_move_inventory_pallet(uuid, uuid, integer, uuid, integer) to authenticated;
grant execute on function public.tgd_add_inventory_pallet(uuid, uuid, integer, numeric, numeric) to authenticated;
notify pgrst, 'reload schema';
commit;
