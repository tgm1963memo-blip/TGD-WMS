-- Both "confirm and close out" actions (a deposit's CONFIRM_RECEIPT and a
-- withdrawal's CONFIRM_DISPATCH) could flip a document to its terminal
-- status without ever checking that every line actually had a confirmed
-- quantity recorded. The deposit side was only ever guarded client-side
-- (allLinesHaveActualQty in CustomerAdminDepositReviewPage.jsx /
-- CustomerDepositDetailModal.jsx); the withdrawal side had NO guard at
-- all in the desktop admin review page (only the handheld picking page
-- gated its own "complete" button on picked_at) and none server-side
-- either — a real audit found 45 withdrawal requests already COMPLETED
-- with picked_boxes AND picked_weight both still null on some or all
-- lines. Neither RPC enforced this, so a client-side gap (or a direct
-- RPC call) could always slip through. Fixed at the source: both RPCs
-- now reject the transition outright if any line has neither its boxes
-- nor its weight confirmed — same "both null" definition already used
-- throughout this codebase's own coalesce(picked, requested)/
-- coalesce(actual, expected) fallbacks to mean "never actually recorded".

begin;

create or replace function public.tgd_review_customer_deposit_request(
  p_request_id uuid,
  p_decision   text,
  p_comment    text default null
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
  v_receiving_id uuid;
  v_has_variance boolean := false;
  v_line         record;
  v_unconfirmed_count int;
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

  if v_decision not in ('ACCEPT', 'REJECT', 'REVIEWING', 'CONFIRM_RECEIPT', 'COUNT_VARIANCE') then
    raise exception 'Decision must be ACCEPT, REJECT, REVIEWING, CONFIRM_RECEIPT, or COUNT_VARIANCE';
  end if;

  -- CONFIRM_RECEIPT and COUNT_VARIANCE allow warehouse roles
  if v_decision in ('CONFIRM_RECEIPT', 'COUNT_VARIANCE') then
    if not public.tgd_role_function_allowed(
      v_profile.role, 'customer_deposit_confirm_receipt',
      v_profile.role in ('admin', 'accounting', 'warehouse_manager', 'warehouse_admin')
    ) then
      raise exception 'Admin, accounting, or warehouse role required';
    end if;
  else
    if not public.tgd_role_function_allowed(
      v_profile.role, 'customer_request_approve',
      v_profile.role in ('admin', 'accounting')
    ) then
      raise exception 'Admin or accounting role required to review a deposit request';
    end if;
  end if;

  select d.id, d.customer_id, d.status, d.expected_arrival_date
  into v_document
  from public.tgd_customer_deposit_requests d
  where d.id = p_request_id
  for update;

  if not found then
    raise exception 'Customer deposit request not found';
  end if;

  -- Status transition logic
  if v_decision = 'REVIEWING' and v_document.status = 'SUBMITTED_BY_CUSTOMER' then
    v_to_status := 'ADMIN_REVIEWING';
  elsif v_decision = 'ACCEPT' and v_document.status = 'ADMIN_REVIEWING' then
    v_to_status := 'ADMIN_ACCEPTED';
  elsif v_decision = 'REJECT' and v_document.status = 'ADMIN_REVIEWING' then
    v_to_status := 'ADMIN_REJECTED';
  elsif v_decision = 'CONFIRM_RECEIPT' and v_document.status in ('WAREHOUSE_RECEIVING', 'PALLETIZING', 'COUNT_VARIANCE_REVIEW', 'ADMIN_RECOUNT_REQUESTED') then
    v_to_status := 'RECEIVED_CONFIRMED';

    -- Every line must have a confirmed quantity before receiving can be
    -- confirmed — a line with both actual_boxes and actual_weight still
    -- null was never actually counted/weighed at all, not just "0 of
    -- something real".
    select count(*) into v_unconfirmed_count
    from public.tgd_customer_deposit_request_lines l
    where l.deposit_request_id = p_request_id
      and l.actual_boxes is null
      and l.actual_weight is null;

    if v_unconfirmed_count > 0 then
      raise exception 'Cannot confirm receipt: % line(s) have no confirmed quantity (boxes/weight) recorded yet', v_unconfirmed_count;
    end if;

    -- Compute variance: any line where actual != expected
    select exists (
      select 1
      from public.tgd_customer_deposit_request_lines l
      where l.deposit_request_id = p_request_id
        and (
          (l.actual_boxes is not null and l.actual_boxes <> l.expected_boxes)
          or (l.actual_weight is not null and round(l.actual_weight::numeric, 3) <> round(l.expected_weight::numeric, 3))
        )
    ) into v_has_variance;

  elsif v_decision = 'COUNT_VARIANCE' and v_document.status in ('ADMIN_ACCEPTED', 'WAREHOUSE_RECEIVING', 'PALLETIZING') then
    v_to_status := 'COUNT_VARIANCE_REVIEW';
  else
    raise exception 'Invalid deposit review transition from % using %',
      v_document.status, v_decision;
  end if;

  -- Update request record
  update public.tgd_customer_deposit_requests
  set status                = v_to_status,
      reviewed_by_user_id   = case when v_decision in ('ACCEPT', 'REJECT') then v_profile.id   else reviewed_by_user_id   end,
      reviewed_by_email     = case when v_decision in ('ACCEPT', 'REJECT') then v_profile.email else reviewed_by_email     end,
      reviewed_at           = case when v_decision in ('ACCEPT', 'REJECT') then now()           else reviewed_at           end,
      web_approved_by_email = case when v_decision = 'CONFIRM_RECEIPT'     then v_profile.email else web_approved_by_email end,
      last_action_by_user_id = v_profile.id,
      last_action_by_email  = v_profile.email,
      last_action_at        = now(),
      review_comment        = coalesce(p_comment, review_comment),
      has_receipt_variance  = case when v_decision = 'CONFIRM_RECEIPT' then v_has_variance else has_receipt_variance end
  where id = v_document.id;

  -- ACCEPT: bridge to warehouse receiving document, then assign a tracking
  -- code to every line that doesn't have one yet -- safety net for lines
  -- added between submit and accept. Date component is the request's own
  -- declared deposit date, matching the submit-time assignment above.
  if v_decision = 'ACCEPT' then
    v_receiving_id := public.tgd_bridge_customer_deposit_to_receiving(v_document.id, v_profile.id);

    for v_line in
      select dl.id, dl.temperature_type
      from public.tgd_customer_deposit_request_lines dl
      where dl.deposit_request_id = v_document.id
        and dl.tracking_code is null
      order by dl.line_no
    loop
      update public.tgd_customer_deposit_request_lines
      set tracking_code = public.tgd_generate_deposit_line_tracking_code(
        v_line.temperature_type, coalesce(v_document.expected_arrival_date, current_date)
      )
      where id = v_line.id;
    end loop;
  end if;

  -- CONFIRM_RECEIPT: create stock movements → triggers stock_balances update
  if v_decision = 'CONFIRM_RECEIPT' then
    perform public.tgd_create_stock_movements_from_deposit(v_document.id, v_profile.id);
  end if;

  -- Timeline event
  insert into public.tgd_customer_document_timeline_events (
    document_type, document_id, customer_id, action, from_status, to_status,
    actor_user_id, actor_email, actor_role, actor_customer_id, comment
  ) values (
    'CUSTOMER_DEPOSIT_REQUEST', v_document.id, v_document.customer_id,
    'REVIEW_' || v_decision, v_document.status,
    case when v_decision = 'ACCEPT' then 'WAREHOUSE_RECEIVING' else v_to_status end,
    v_profile.id, v_profile.email, v_profile.role, v_profile.customer_id,
    nullif(btrim(coalesce(p_comment, '')), '')
  );

  return jsonb_build_object(
    'id',                   v_document.id,
    'customer_id',          v_document.customer_id,
    'status',               case when v_decision = 'ACCEPT' then 'WAREHOUSE_RECEIVING' else v_to_status end,
    'action',               'REVIEW_' || v_decision,
    'receiving_document_id', v_receiving_id
  );
end;
$$;

revoke all on function public.tgd_review_customer_deposit_request(uuid, text, text) from public;
grant execute on function public.tgd_review_customer_deposit_request(uuid, text, text) to authenticated;


create or replace function public.tgd_review_customer_withdrawal_request(
  p_request_id uuid,
  p_decision   text,
  p_comment    text default null
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

  select w.id, w.customer_id, w.status, w.withdrawal_no
  into v_document
  from public.tgd_customer_withdrawal_requests w
  where w.id = p_request_id
  for update;

  if not found then
    raise exception 'Customer withdrawal request not found';
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
    -- confirmed — a line with both picked_boxes and picked_weight still
    -- null was never actually picked/weighed at all. This is the
    -- server-side half of the fix; the desktop admin review page had NO
    -- client-side guard at all here (unlike the handheld picking page,
    -- which already gates its own "complete" button on picked_at) — a
    -- real audit found 45 withdrawal requests already COMPLETED this way.
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
      last_action_at           = now()
  where id = v_document.id;

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
    actor_user_id, actor_email, actor_role, actor_customer_id, comment
  ) values (
    'CUSTOMER_WITHDRAWAL_REQUEST', v_document.id, v_document.customer_id,
    'REVIEW_' || v_decision, v_document.status, v_to_status,
    v_profile.id, v_profile.email, v_profile.role, v_profile.customer_id,
    nullif(btrim(p_comment), '')
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
    'internal_withdrawal_request_id',  v_internal_id
  );
end;
$$;

revoke all on function public.tgd_review_customer_withdrawal_request(uuid, text, text) from public;
grant execute on function public.tgd_review_customer_withdrawal_request(uuid, text, text) to authenticated;

commit;
