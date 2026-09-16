-- Add safeguard: prevent withdrawal line picks that would deplete weight
-- while leaving boxes remaining, and require users to finish boxes when
-- weight runs out.
--
-- Root cause: withdrawal lines created with user-entered requested_boxes and
-- requested_weight were never validated to match deposit line weight ratios.
-- When picked_boxes/picked_weight were recorded, the RPC only snapped weight
-- to remaining balance on genuine "closing" picks (all boxes picked). But
-- intermediate picks were free to deviate from the deposit line's weight-per-box
-- ratio, causing balance_boxes and balance_weight to drift independently.
--
-- Fix: validate on pick that:
-- 1. If this pick claims all remaining boxes for a line (closing pick), it must
--    also claim all remaining weight (strictly checked)
-- 2. Conversely, if this pick would claim all remaining weight, it must also
--    claim all remaining boxes (the stronger safeguard the user requested)

begin;

-- tgd_record_withdrawal_line_pick: add validation and weight snap
create or replace function public.tgd_record_withdrawal_line_pick(
  p_line_id      uuid,
  p_picked_boxes numeric default null,
  p_picked_weight numeric default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_auth_user_id uuid := auth.uid();
  v_profile      record;
  v_line         record;
  v_deposit_line record;
  v_max_boxes    numeric;
  v_max_weight   numeric;
  v_claimed_boxes numeric;
  v_claimed_weight numeric;
  v_remaining_boxes numeric;
  v_remaining_weight numeric;
  v_final_picked_weight numeric := p_picked_weight;
begin
  if v_auth_user_id is null or not public.tgd_current_user_is_active() then
    raise exception 'Active authenticated user required';
  end if;

  select p.id, p.email
  into v_profile
  from public.tgd_user_profiles p
  where p.auth_user_id = v_auth_user_id and p.is_active = true
  limit 1;

  if not found then
    raise exception 'User profile not found';
  end if;

  select id, source_customer_deposit_request_line_id, tracking_code
  into v_line
  from public.tgd_customer_withdrawal_request_lines
  where id = p_line_id;

  if not found then
    raise exception 'Withdrawal request line not found';
  end if;

  if v_line.source_customer_deposit_request_line_id is not null or v_line.tracking_code is not null then
    select dl.id, dl.actual_boxes, dl.actual_weight, dl.expected_boxes, dl.expected_weight
    into v_deposit_line
    from public.tgd_customer_deposit_request_lines dl
    join public.tgd_customer_deposit_requests dr on dr.id = dl.deposit_request_id
    where dr.status in ('RECEIVED_CONFIRMED', 'CUSTOMER_NOTIFIED')
      and (
        (v_line.source_customer_deposit_request_line_id is not null and dl.id = v_line.source_customer_deposit_request_line_id)
        or (v_line.tracking_code is not null and dl.tracking_code = v_line.tracking_code)
      )
    limit 1
    for update of dl;

    if found then
      v_max_boxes := coalesce(v_deposit_line.actual_boxes, v_deposit_line.expected_boxes, 0);
      v_max_weight := coalesce(v_deposit_line.actual_weight, v_deposit_line.expected_weight, 0);

      select coalesce(sum(coalesce(wl.picked_boxes, wl.requested_boxes)), 0),
             coalesce(sum(coalesce(wl.picked_weight, wl.requested_weight)), 0)
      into v_claimed_boxes, v_claimed_weight
      from public.tgd_customer_withdrawal_request_lines wl
      join public.tgd_customer_withdrawal_requests wr on wr.id = wl.withdrawal_request_id
      where wr.status <> 'CANCELLED'
        and wl.id <> p_line_id
        and (
          wl.source_customer_deposit_request_line_id = v_deposit_line.id
          or (v_line.tracking_code is not null and wl.tracking_code = v_line.tracking_code)
        );

      v_remaining_boxes := v_max_boxes - v_claimed_boxes;
      v_remaining_weight := v_max_weight - v_claimed_weight;

      if v_max_boxes > 0 and p_picked_boxes is not null
         and p_picked_boxes > greatest(0, v_remaining_boxes) then
        raise exception 'Picked boxes (%) exceed remaining balance (%) for this deposit line/tracking code',
          p_picked_boxes, greatest(0, v_remaining_boxes);
      end if;

      if v_max_weight > 0 and p_picked_weight is not null
         and p_picked_weight > greatest(0, v_remaining_weight) then
        raise exception 'Picked weight (%) exceeds remaining balance (%) for this deposit line/tracking code',
          p_picked_weight, greatest(0, v_remaining_weight);
      end if;

      -- NEW SAFEGUARD: If this pick would deplete all remaining weight,
      -- it must also deplete all remaining boxes (enforce matching end-state).
      if v_max_weight > 0 and v_remaining_weight > 0 and p_picked_weight is not null
         and p_picked_weight >= v_remaining_weight then
        if p_picked_boxes is null or p_picked_boxes < v_remaining_boxes then
          raise exception 'When weight is fully withdrawn (%.2f kg depletes remaining %.2f kg), boxes must also be fully withdrawn. Remaining boxes: %, your boxes: %',
            p_picked_weight, v_remaining_weight, v_remaining_boxes, coalesce(p_picked_boxes, 0);
        end if;
      end if;

      -- Also snap weight for genuine closing picks (all boxes picked).
      if v_max_boxes > 0 and v_remaining_boxes > 0 and p_picked_boxes = v_remaining_boxes then
        v_final_picked_weight := greatest(0, v_remaining_weight);
      end if;
    end if;
  end if;

  update public.tgd_customer_withdrawal_request_lines
  set picked_boxes     = p_picked_boxes,
      picked_weight    = v_final_picked_weight,
      picked_at        = now(),
      picked_by_email  = v_profile.email
  where id = p_line_id;

  return jsonb_build_object(
    'id',           p_line_id,
    'picked_boxes', p_picked_boxes,
    'picked_weight', v_final_picked_weight
  );
end;
$$;

commit;
