-- 101_tgd_wms_warehouse_admin_approval_permissions.sql
--
-- Business request: warehouse_admin should be able to click Approve
-- (อนุมัติ) on customer deposit/withdrawal requests, in addition to the
-- send-to-picking (เบิกใบงาน), confirm-receipt (ยืนยันการรับเข้า), and
-- proxy-submit (แจ้งเบิกแทนลูกค้า) actions it can already perform.
--
-- All four actions become configurable from the Roles & Permissions admin
-- page (tgd_role_function_permissions), instead of being hardcoded role
-- lists inside each RPC. An override row is only needed when a role should
-- differ from the historical default.
--
-- Function keys introduced:
--   customer_request_approve             - ACCEPT/REJECT/REVIEWING (deposit + withdrawal)
--   customer_withdrawal_send_to_picking  - SEND_TO_PICKING/CONFIRM_DISPATCH (withdrawal)
--   customer_deposit_confirm_receipt     - CONFIRM_RECEIPT/COUNT_VARIANCE (deposit)
--   customer_request_proxy               - create/update/submit requests on behalf of a customer

begin;

-- 1. Generic helper: read a tgd_role_function_permissions override, falling
--    back to a caller-supplied default when no override row exists.
create or replace function public.tgd_role_function_allowed(
  p_role            text,
  p_function_key    text,
  p_default_allowed boolean
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when p_role = 'admin' then true
    else coalesce(
      (
        select is_allowed
        from public.tgd_role_function_permissions
        where role_code = p_role and function_key = p_function_key
        limit 1
      ),
      p_default_allowed
    )
  end;
$$;

grant execute on function public.tgd_role_function_allowed(text, text, boolean) to authenticated;

-- 2. Proxy create/update/submit-on-behalf-of-customer becomes configurable
--    too (previously a hardcoded role list).
create or replace function public.tgd_is_customer_request_proxy_role(p_role text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.tgd_role_function_allowed(
    lower(coalesce(p_role, '')),
    'customer_request_proxy',
    lower(coalesce(p_role, '')) in ('admin', 'warehouse_admin', 'warehouse_manager', 'warehouse_staff')
  );
$$;

comment on function public.tgd_is_customer_request_proxy_role(text) is
  'True for roles allowed to view/create/submit customer deposit/withdrawal requests on behalf of customers. Configurable via tgd_role_function_permissions (function_key = customer_request_proxy).';

-- 3. Deposit review (latest body from migration 090) with the role checks
--    replaced by configurable permission lookups.
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

  select d.id, d.customer_id, d.status
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

  -- ACCEPT: bridge to warehouse receiving document
  if v_decision = 'ACCEPT' then
    v_receiving_id := public.tgd_bridge_customer_deposit_to_receiving(v_document.id, v_profile.id);
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

-- 4. Withdrawal review (latest body from migration 081) with the role
--    checks replaced by configurable permission lookups.
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

comment on function public.tgd_review_customer_withdrawal_request(uuid, text, text) is
  'Reviews a customer withdrawal request. Decisions: REVIEWING, ACCEPT, REJECT, SEND_TO_PICKING, CONFIRM_DISPATCH. Approve permission configurable via tgd_role_function_permissions (customer_request_approve); picking/dispatch via customer_withdrawal_send_to_picking.';

revoke all on function public.tgd_review_customer_withdrawal_request(uuid, text, text) from public;
grant execute on function public.tgd_review_customer_withdrawal_request(uuid, text, text) to authenticated;

-- 5. Grant warehouse_admin the "approve" action by default, per business
--    request. (send_to_picking / confirm_receipt / proxy already default
--    to allowed for warehouse_admin above, so no override row is needed
--    for those — they are simply now visible/togglable on the settings page.)
insert into public.tgd_role_function_permissions (role_code, function_key, is_allowed)
values ('warehouse_admin', 'customer_request_approve', true)
on conflict (role_code, function_key) do update set is_allowed = excluded.is_allowed, updated_at = now();

notify pgrst, 'reload schema';

commit;
