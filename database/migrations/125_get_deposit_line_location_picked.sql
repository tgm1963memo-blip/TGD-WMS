-- Reading tgd_deposit_line_location_picked directly costs about 3.3s per
-- request for a signed-in user but 0.3s without RLS, because the view is
-- security_invoker and every row of every table it touches runs the RLS
-- policies. Filters don't help: one location still takes 3.3s.
--
-- This adds a read-only function in the same shape as
-- tgd_get_location_count_expected (security definer, staff check, customer
-- scope), which reads the same view in about 0.25s. It only SELECTs. No table,
-- view, policy or row changes. Roles it refuses keep using the view.

begin;

create or replace function public.tgd_get_deposit_line_location_picked(p_allocation_ids uuid[] default null)
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  v_scope uuid;
  v_result jsonb;
begin
  perform public.tgd_location_count_assert_staff();
  v_scope := public.tgd_current_user_role_customer_scope();

  select coalesce(jsonb_agg(jsonb_build_object(
      'allocation_id', p.allocation_id,
      'picked_boxes', p.picked_boxes,
      'picked_weight', p.picked_weight
    )), '[]'::jsonb)
  into v_result
  from public.tgd_deposit_line_location_picked p
  where (p_allocation_ids is null or p.allocation_id = any(p_allocation_ids))
    and (v_scope is null or exists (
      select 1
      from public.tgd_customer_deposit_request_lines dl
      join public.tgd_customer_deposit_requests dr on dr.id = dl.deposit_request_id
      where dl.id = p.line_id and dr.customer_id = v_scope
    ));

  return v_result;
end;
$$;

revoke all on function public.tgd_get_deposit_line_location_picked(uuid[]) from public, anon;
grant execute on function public.tgd_get_deposit_line_location_picked(uuid[]) to authenticated;

commit;
