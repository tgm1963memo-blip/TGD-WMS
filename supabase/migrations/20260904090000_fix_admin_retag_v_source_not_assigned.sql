-- tgd_admin_update_withdrawal_line_source (admin "retag" tool) crashes with
-- Postgres error record "v_source" is not assigned yet whenever an admin
-- edits customer_product_code or lot_no WITHOUT also supplying a new
-- tracking code (p_tracking_code left null) -- a normal, legitimate use of
-- the tool (e.g. fixing a mistyped lot number without retagging the whole
-- line onto a different physical lot). Root cause: v_source is a plpgsql
-- RECORD variable, only ever SELECT INTO'd inside `if v_new_tracking_code is
-- not null then ... end if`. The UPDATE statement below that block
-- references v_source.customer_product_code / v_source.lot_no / etc.
-- unconditionally inside CASE expressions -- even though the WHEN branch
-- that reads v_source is never the one CHOSEN at runtime when
-- v_new_tracking_code is null, plpgsql still has to resolve that record
-- field access's type while planning the UPDATE, which requires v_source to
-- have been assigned at least once THIS call. If the tracking-code branch
-- above was skipped, it never was -- hence the crash, 100% of the time,
-- for exactly this "edit a field without retagging" case.
-- Fix: give v_source an initial all-NULL assignment (right column types,
-- same shape as the real SELECT INTO further down) unconditionally at the
-- top of the function, so it's always "assigned" even on the untaken path.
-- The untaken CASE branch then legally evaluates to NULL and is simply
-- never used (the real UPDATE value still comes from the ELSE branch), so
-- this changes no behavior on the actual retag-with-tracking-code path.

begin;

create or replace function public.tgd_admin_update_withdrawal_line_source(
  p_line_id               uuid,
  p_customer_product_code text default null,
  p_lot_no                text default null,
  p_tracking_code         text default null
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
  v_new_tracking_code text := nullif(btrim(coalesce(p_tracking_code, '')), '');
  v_source record;
  v_max_boxes numeric;
  v_max_weight numeric;
  v_claimed_boxes numeric;
  v_claimed_weight numeric;
begin
  -- Unconditional initializer (see migration header) -- must match the
  -- column list/order/types/ALIASES of the real `select ... into v_source`
  -- below (a `select expr into record_var` with no `as alias` gives the
  -- record positional/anonymous field names, not the names used elsewhere
  -- in this function -- confirmed live: this exact initializer without
  -- aliases raised "record v_source has no field customer_product_code"
  -- instead of fixing the original bug).
  select null::uuid as deposit_line_id, null::uuid as deposit_request_id,
         null::text as customer_product_code, null::text as lot_no,
         null::numeric as actual_boxes, null::numeric as actual_weight,
         null::numeric as expected_boxes, null::numeric as expected_weight,
         null::uuid as customer_id
  into v_source;

  if v_auth_user_id is null or not public.tgd_current_user_is_active() then
    raise exception 'Active authenticated user required';
  end if;

  select p.id, p.role
  into v_profile
  from public.tgd_user_profiles p
  where p.auth_user_id = v_auth_user_id
    and p.is_active = true
  limit 1;

  if not found then
    raise exception 'User profile not found';
  end if;

  if v_profile.role not in ('admin', 'accounting', 'warehouse_manager', 'warehouse_admin') then
    raise exception 'Admin or warehouse role required';
  end if;

  select l.id, l.requested_boxes, l.requested_weight, wr.customer_id
  into v_line
  from public.tgd_customer_withdrawal_request_lines l
  join public.tgd_customer_withdrawal_requests wr on wr.id = l.withdrawal_request_id
  where l.id = p_line_id;

  if not found then
    raise exception 'Withdrawal request line not found';
  end if;

  if v_new_tracking_code is not null then
    select dl.id as deposit_line_id, dl.deposit_request_id, dl.customer_product_code, dl.lot_no,
           dl.actual_boxes, dl.actual_weight, dl.expected_boxes, dl.expected_weight, dr.customer_id
    into v_source
    from public.tgd_customer_deposit_request_lines dl
    join public.tgd_customer_deposit_requests dr on dr.id = dl.deposit_request_id
    where dl.tracking_code = v_new_tracking_code
      and dr.status in ('RECEIVED_CONFIRMED', 'CUSTOMER_NOTIFIED')
    for update of dl;

    if not found then
      raise exception 'No deposit lot found with tracking code %', v_new_tracking_code;
    end if;

    if v_source.customer_id is distinct from v_line.customer_id then
      raise exception 'Tracking code % belongs to a different customer''s lot', v_new_tracking_code;
    end if;

    v_max_boxes := coalesce(v_source.actual_boxes, v_source.expected_boxes, 0);
    v_max_weight := coalesce(v_source.actual_weight, v_source.expected_weight, 0);

    select coalesce(sum(coalesce(wl.picked_boxes, wl.requested_boxes)), 0),
           coalesce(sum(coalesce(wl.picked_weight, wl.requested_weight)), 0)
    into v_claimed_boxes, v_claimed_weight
    from public.tgd_customer_withdrawal_request_lines wl
    join public.tgd_customer_withdrawal_requests wr on wr.id = wl.withdrawal_request_id
    where wr.status <> 'CANCELLED'
      and wl.id <> p_line_id
      and (
        wl.source_customer_deposit_request_line_id = v_source.deposit_line_id
        or wl.tracking_code = v_new_tracking_code
      );

    if v_max_boxes > 0 and v_line.requested_boxes is not null
       and v_line.requested_boxes > (v_max_boxes - v_claimed_boxes) then
      raise exception 'This line requests % boxes, which exceeds the remaining balance (%) for tracking code %',
        v_line.requested_boxes, greatest(0, v_max_boxes - v_claimed_boxes), v_new_tracking_code;
    end if;

    if v_max_weight > 0 and v_line.requested_weight is not null
       and v_line.requested_weight > (v_max_weight - v_claimed_weight) then
      raise exception 'This line requests % kg, which exceeds the remaining balance (%) for tracking code %',
        v_line.requested_weight, greatest(0, v_max_weight - v_claimed_weight), v_new_tracking_code;
    end if;
  end if;

  update public.tgd_customer_withdrawal_request_lines
  set customer_product_code = case
        when v_new_tracking_code is not null then v_source.customer_product_code
        else coalesce(nullif(btrim(coalesce(p_customer_product_code, '')), ''), customer_product_code)
      end,
      lot_no = case
        when v_new_tracking_code is not null then v_source.lot_no
        else coalesce(nullif(btrim(coalesce(p_lot_no, '')), ''), lot_no)
      end,
      tracking_code = case
        when p_tracking_code is not null then v_new_tracking_code
        else tracking_code
      end,
      source_customer_deposit_request_line_id = case
        when v_new_tracking_code is not null then v_source.deposit_line_id
        else source_customer_deposit_request_line_id
      end,
      source_customer_deposit_request_id = case
        when v_new_tracking_code is not null then v_source.deposit_request_id
        else source_customer_deposit_request_id
      end
  where id = p_line_id;

  return (
    select jsonb_build_object(
      'id', l.id,
      'customer_product_code', l.customer_product_code,
      'lot_no', l.lot_no,
      'tracking_code', l.tracking_code,
      'source_customer_deposit_request_line_id', l.source_customer_deposit_request_line_id,
      'source_customer_deposit_request_id', l.source_customer_deposit_request_id
    )
    from public.tgd_customer_withdrawal_request_lines l
    where l.id = p_line_id
  );
end;
$$;

commit;
