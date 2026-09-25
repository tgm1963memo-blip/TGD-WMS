-- "Reset location": clears every pallet allocation
-- (tgd_customer_deposit_line_locations) sitting in the given locations so the
-- goods show as "ยังไม่ระบุ" and can be re-assigned. Receiving documents and
-- tgd_stock_balances are NOT touched.
--
-- Same rule as tgd_remove_deposit_line_location_allocation: a pallet that a
-- withdrawal pick already references is skipped (not deleted) rather than
-- orphaning that pick row. p_dry_run = true only counts, for the confirm
-- dialog.

create or replace function public.tgd_reset_location_allocations(
  p_location_ids uuid[],
  p_dry_run boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_auth_user_id uuid := auth.uid();
  v_role text;
  v_total int;
  v_skipped int;
  v_cleared int := 0;
  v_line_ids uuid[];
begin
  if v_auth_user_id is null or not public.tgd_current_user_is_active() then
    raise exception 'Active authenticated user required';
  end if;

  select p.role into v_role
  from public.tgd_user_profiles p
  where p.auth_user_id = v_auth_user_id and p.is_active = true
  limit 1;

  if v_role is null then
    raise exception 'User profile not found';
  end if;

  if v_role not in ('admin', 'warehouse_manager', 'warehouse_admin') then
    raise exception 'Admin or warehouse manager role required to reset a location';
  end if;

  if p_location_ids is null or cardinality(p_location_ids) = 0 then
    return jsonb_build_object('cleared', 0, 'skipped_picked', 0, 'dry_run', p_dry_run);
  end if;

  select count(*),
         count(*) filter (where exists (
           select 1 from public.tgd_customer_withdrawal_line_pallet_picks pk
           where pk.deposit_line_location_id = a.id
         ))
  into v_total, v_skipped
  from public.tgd_customer_deposit_line_locations a
  where a.location_id = any(p_location_ids);

  if p_dry_run then
    return jsonb_build_object('cleared', v_total - v_skipped, 'skipped_picked', v_skipped, 'dry_run', true);
  end if;

  with deleted as (
    delete from public.tgd_customer_deposit_line_locations a
    where a.location_id = any(p_location_ids)
      and not exists (
        select 1 from public.tgd_customer_withdrawal_line_pallet_picks pk
        where pk.deposit_line_location_id = a.id
      )
    returning a.line_id
  )
  select count(*), array_agg(distinct line_id) into v_cleared, v_line_ids from deleted;

  -- Keep the legacy single location_id column pointing at the line's most
  -- recent remaining allocation (null when none are left), same as the
  -- single-pallet cancel RPC does.
  if v_line_ids is not null then
    update public.tgd_customer_deposit_request_lines l
    set location_id = (
      select a.location_id from public.tgd_customer_deposit_line_locations a
      where a.line_id = l.id
      order by a.created_at desc
      limit 1
    )
    where l.id = any(v_line_ids);
  end if;

  return jsonb_build_object('cleared', v_cleared, 'skipped_picked', v_skipped, 'dry_run', false);
end;
$$;

revoke all on function public.tgd_reset_location_allocations(uuid[], boolean) from public;
grant execute on function public.tgd_reset_location_allocations(uuid[], boolean) to authenticated;
