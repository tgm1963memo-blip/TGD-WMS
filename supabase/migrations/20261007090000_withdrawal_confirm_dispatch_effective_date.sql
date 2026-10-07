-- Lets admin pick the dispatch date when confirming a withdrawal
-- (CONFIRM_DISPATCH) instead of always stamping now(). Real case:
-- CWR-20260815-0002 was requested/dispatched on 15/08 but only confirmed in
-- the system on 17/08, so the timeline, as-of-date stock balance
-- (tgd_get_customer_stock_balance reads the REVIEW_CONFIRM_DISPATCH event's
-- created_at), movement ledger and billing (both read line picked_at) all
-- put the withdrawal on the wrong day.
--
-- p_effective_date (Bangkok calendar date) only applies to CONFIRM_DISPATCH.
-- When given and not today, the confirm is stamped at 12:00 Bangkok on that
-- date: last_action_at, the timeline event's created_at, and any line
-- picked_at later than that moment (a line cannot be picked after the goods
-- left) are all set to it. A fixed midday (not the current time-of-day)
-- keeps the timestamp on the same calendar day in both Bangkok and UTC --
-- the as-of-date stock reports cast to date in UTC, so a pre-07:00 Bangkok
-- time would land on the previous day. Dates in the future or before the
-- request was created (Bangkok date of created_at) are rejected.
-- Omitted/null keeps the old now() behaviour, so the handheld caller is
-- unaffected.

begin;

drop function if exists public.tgd_review_customer_withdrawal_request(uuid, text, text);

create or replace function public.tgd_review_customer_withdrawal_request(
  p_request_id     uuid,
  p_decision       text,
  p_comment        text default null,
  p_effective_date date default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_auth_user_id uuid := auth.uid();
  v_profile      record;
  v_document     record;
  v_decision     text := upper(nullif(btrim(p_decision), ''));
  v_to_status    text;
  v_internal_id  uuid;
  v_unconfirmed_count int;
  v_bkk_now      timestamp := now() at time zone 'Asia/Bangkok';
  v_action_at    timestamptz := now();
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

  if v_decision not in ('ACCEPT', 'REJECT', 'REVIEWING', 'SEND_TO_PICKING', 'CONFIRM_DISPATCH') then
    raise exception 'Decision must be ACCEPT, REJECT, REVIEWING, SEND_TO_PICKING, or CONFIRM_DISPATCH';
  end if;

  if v_decision in ('ACCEPT', 'REJECT', 'REVIEWING') and
     not public.tgd_role_function_allowed(
       v_profile.role, 'customer_request_approve',
       v_profile.role in ('admin', 'accounting')
     ) then
    raise exception 'Admin or accounting role required to review a withdrawal request';
  end if;

  if v_decision in ('SEND_TO_PICKING', 'CONFIRM_DISPATCH') and
     not public.tgd_role_function_allowed(
       v_profile.role, 'customer_withdrawal_send_to_picking',
       v_profile.role in ('admin', 'accounting', 'warehouse_admin', 'warehouse_manager', 'warehouse_staff')
     ) then
    raise exception 'Warehouse or admin role required for picking operations';
  end if;

  select w.id, w.customer_id, w.status, w.withdrawal_no, w.created_at
  into v_document
  from public.tgd_customer_withdrawal_requests w
  where w.id = p_request_id
  for update;

  if not found then
    raise exception 'Customer withdrawal request not found';
  end if;

  if p_effective_date is not null and v_decision = 'CONFIRM_DISPATCH' then
    if p_effective_date > v_bkk_now::date then
      raise exception 'Dispatch date cannot be in the future';
    end if;
    if p_effective_date < (v_document.created_at at time zone 'Asia/Bangkok')::date then
      raise exception 'Dispatch date cannot be before the request was created (%)',
        (v_document.created_at at time zone 'Asia/Bangkok')::date;
    end if;
    if p_effective_date < v_bkk_now::date then
      v_action_at := (p_effective_date + time '12:00') at time zone 'Asia/Bangkok';
    end if;
  end if;

  if v_decision = 'REVIEWING' and v_document.status = 'SUBMITTED_BY_CUSTOMER' then
    v_to_status := 'ADMIN_REVIEWING';
  elsif v_decision = 'ACCEPT' and v_document.status = 'ADMIN_REVIEWING' then
    v_to_status := 'ADMIN_ACCEPTED';
  elsif v_decision = 'REJECT' and v_document.status in ('ADMIN_REVIEWING', 'SUBMITTED_BY_CUSTOMER') then
    v_to_status := 'ADMIN_REJECTED';
  elsif v_decision = 'SEND_TO_PICKING' and v_document.status = 'ADMIN_ACCEPTED' then
    v_to_status := 'WAREHOUSE_PICKING';
  elsif v_decision = 'CONFIRM_DISPATCH' and v_document.status in ('WAREHOUSE_PICKING', 'ADMIN_ACCEPTED') then
    v_to_status := 'COMPLETED';

    -- Every line must have a confirmed pick before dispatch can be
    -- confirmed (see 20260810090000).
    select count(*) into v_unconfirmed_count
    from public.tgd_customer_withdrawal_request_lines wl
    where wl.withdrawal_request_id = v_document.id
      and wl.picked_boxes is null
      and wl.picked_weight is null;

    if v_unconfirmed_count > 0 then
      raise exception 'Cannot confirm dispatch: % line(s) have no confirmed pick quantity (boxes/weight) recorded yet', v_unconfirmed_count;
    end if;
  else
    raise exception 'Invalid withdrawal review transition from % using %',
      v_document.status, v_decision;
  end if;

  update public.tgd_customer_withdrawal_requests
  set status                   = v_to_status,
      reviewed_by_user_id      = case when v_decision in ('ACCEPT', 'REJECT') then v_profile.id else reviewed_by_user_id end,
      reviewed_by_email        = case when v_decision in ('ACCEPT', 'REJECT') then v_profile.email else reviewed_by_email end,
      reviewed_at              = case when v_decision in ('ACCEPT', 'REJECT') then now() else reviewed_at end,
      review_comment           = nullif(btrim(p_comment), ''),
      last_action_by_user_id   = v_profile.id,
      last_action_by_email     = v_profile.email,
      last_action_at           = v_action_at
  where id = v_document.id;

  if v_decision = 'CONFIRM_DISPATCH' and v_action_at < now() then
    update public.tgd_customer_withdrawal_request_lines
    set picked_at = v_action_at
    where withdrawal_request_id = v_document.id
      and picked_at > v_action_at;
  end if;

  if v_decision = 'ACCEPT' then
    v_internal_id := public.tgd_bridge_customer_withdrawal_to_internal(v_document.id, v_profile.id);
  end if;

  -- Reduce tgd_stock_balances when dispatch is confirmed so warehouse map
  -- immediately reflects the correct (empty) occupancy for vacated locations.
  if v_decision = 'CONFIRM_DISPATCH' then
    perform public.tgd_sync_stock_balances_for_withdrawal(v_document.id);
  end if;

  insert into public.tgd_customer_document_timeline_events (
    document_type, document_id, customer_id, action, from_status, to_status,
    actor_user_id, actor_email, actor_role, actor_customer_id, comment, created_at
  ) values (
    'CUSTOMER_WITHDRAWAL_REQUEST', v_document.id, v_document.customer_id,
    'REVIEW_' || v_decision, v_document.status, v_to_status,
    v_profile.id, v_profile.email, v_profile.role, v_profile.customer_id,
    nullif(btrim(p_comment), ''), v_action_at
  );

  if v_decision = 'ACCEPT' then
    perform public.tgd_enqueue_customer_request_notifications(
      'CUSTOMER_WITHDRAWAL_REQUEST', v_document.id, v_document.customer_id,
      v_document.withdrawal_no, null, 'WITHDRAWAL_ACCEPTED'
    );
  end if;

  return jsonb_build_object(
    'id',                              v_document.id,
    'customer_id',                     v_document.customer_id,
    'status',                          v_to_status,
    'action',                          'REVIEW_' || v_decision,
    'internal_withdrawal_request_id',  v_internal_id,
    'effective_at',                    v_action_at
  );
end;
$$;

revoke all on function public.tgd_review_customer_withdrawal_request(uuid, text, text, date) from public;
grant execute on function public.tgd_review_customer_withdrawal_request(uuid, text, text, date) to authenticated;

notify pgrst, 'reload schema';

commit;
