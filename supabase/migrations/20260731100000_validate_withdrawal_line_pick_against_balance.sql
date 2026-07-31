-- tgd_record_withdrawal_line_pick (handheld picking) writes
-- picked_boxes/picked_weight with zero validation against either the
-- line's own requested quantity or the deposit line's actual remaining
-- balance. Every downstream balance computation in the codebase treats
-- coalesce(picked_boxes, requested_boxes) as the confirmed claimed
-- amount (see tgd_get_customer_stock_balance and the balance-lock RPC
-- fixed in migration 20260731090000) -- so an arbitrary picked value
-- typed on a handheld device (e.g. a stray digit: 500 instead of 50)
-- silently overdraws the batch system-wide, the exact class of over-claim
-- bug migration 20260729200000 had to manually reconcile after the fact,
-- but this time unchecked at the point of write rather than on retag.
--
-- Fix: before writing, resolve the line's matched deposit line (same
-- direct-id-first, else tracking_code, priority used everywhere else in
-- this codebase) and reject a picked amount that would push total claims
-- against it (this line's own new picked amount + every OTHER
-- non-cancelled line's coalesce(picked, requested)) past the deposit
-- line's actual_boxes/actual_weight. A null picked_boxes/picked_weight
-- (not yet picked) is left unvalidated, same as before.

begin;

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

      if v_max_boxes > 0 and p_picked_boxes is not null
         and p_picked_boxes > (v_max_boxes - v_claimed_boxes) then
        raise exception 'Picked boxes (%) exceed remaining balance (%) for this deposit line/tracking code',
          p_picked_boxes, greatest(0, v_max_boxes - v_claimed_boxes);
      end if;

      if v_max_weight > 0 and p_picked_weight is not null
         and p_picked_weight > (v_max_weight - v_claimed_weight) then
        raise exception 'Picked weight (%) exceeds remaining balance (%) for this deposit line/tracking code',
          p_picked_weight, greatest(0, v_max_weight - v_claimed_weight);
      end if;
    end if;
  end if;

  update public.tgd_customer_withdrawal_request_lines
  set picked_boxes     = p_picked_boxes,
      picked_weight    = p_picked_weight,
      picked_at        = now(),
      picked_by_email  = v_profile.email
  where id = p_line_id;

  return jsonb_build_object(
    'id',           p_line_id,
    'picked_boxes', p_picked_boxes,
    'picked_weight', p_picked_weight
  );
end;
$$;

commit;
