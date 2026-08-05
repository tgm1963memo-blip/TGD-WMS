create or replace function public.tgd_debug_check_deposit_edit_guard(
  p_line_id uuid, p_new_boxes numeric, p_new_weight numeric
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tracking_code text;
  v_withdrawn_boxes numeric;
  v_withdrawn_weight numeric;
begin
  select tracking_code into v_tracking_code from tgd_customer_deposit_request_lines where id = p_line_id;

  select coalesce(sum(coalesce(wl.picked_boxes, wl.requested_boxes, 0)), 0),
         coalesce(sum(coalesce(wl.picked_weight, wl.requested_weight, 0)), 0)
  into v_withdrawn_boxes, v_withdrawn_weight
  from tgd_customer_withdrawal_request_lines wl
  join tgd_customer_withdrawal_requests wr on wr.id = wl.withdrawal_request_id
  where wr.status <> 'CANCELLED'
    and (
      wl.source_customer_deposit_request_line_id = p_line_id
      or (wl.source_customer_deposit_request_line_id is null and v_tracking_code is not null and wl.tracking_code = v_tracking_code)
    );

  return jsonb_build_object(
    'withdrawn_boxes', v_withdrawn_boxes, 'withdrawn_weight', v_withdrawn_weight,
    'new_boxes', p_new_boxes, 'new_weight', p_new_weight,
    'would_block_boxes', p_new_boxes is not null and p_new_boxes < v_withdrawn_boxes,
    'would_block_weight', p_new_weight is not null and p_new_weight < v_withdrawn_weight
  );
end;
$$;
grant execute on function public.tgd_debug_check_deposit_edit_guard(uuid, numeric, numeric) to authenticated, service_role;
