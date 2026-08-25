-- Regression fix: database/migrations/090_fix_review_deposit_restore_
-- behaviors.sql (a legacy numbered migration, applied for the first time
-- on 2026-08-24 via `npm run db:apply-pending`) recreated
-- tgd_review_customer_deposit_request from a pre-076/077-era snapshot that
-- predates two later fixes that had already shipped under
-- supabase/migrations/:
--   1. 20260708100008_tgd_wms_warehouse_admin_approval_permissions.sql --
--      replaced the hardcoded `role in ('admin','accounting')` check with
--      the configurable tgd_role_function_allowed(...) lookup, and granted
--      warehouse_admin the 'customer_request_approve' permission by
--      default.
--   2. 20260810090000_require_confirmed_qty_before_completing_documents.sql
--      -- added the unconfirmed-qty guard on CONFIRM_RECEIPT and
--      tracking-code auto-assignment on ACCEPT.
--
-- Applying 090 silently reverted all of that: warehouse_admin users (e.g.
-- jamjuree.puizas@gmail.com) could no longer review/open a deposit request
-- at all, hitting "Admin or accounting role required to review a deposit
-- request" even though tgd_role_function_permissions still had their
-- override row set to allowed -- the live function simply stopped
-- consulting that table.
--
-- This migration is a byte-for-byte re-application of
-- 20260810090000's tgd_review_customer_deposit_request body (the
-- tgd_review_customer_withdrawal_request half of that file was never
-- affected by 090 and is untouched here), so the migration history itself
-- has a record of the regression and its fix, not just a live hotfix.
-- scripts/apply-pending-migrations.mjs has also been updated so 090 can
-- never be re-applied by a future run.

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

notify pgrst, 'reload schema';

commit;
