-- Lets admin/warehouse staff pull a withdrawal request that already
-- reached COMPLETED back to WAREHOUSE_PICKING -- e.g. staff marked it
-- complete before actually picking it, then discovered the notified
-- lot doesn't have enough stock and needs to add/substitute lines
-- before it can really be fulfilled (real case: CWR-20260731-0012, all
-- 13 lines still have picked_boxes/picked_weight = null despite status
-- COMPLETED).
--
-- Unlike tgd_recall_confirmed_deposit_request (which has to reverse real
-- tgd_stock_movements/tgd_stock_balances rows created by
-- CONFIRM_RECEIPT), this transition has no physical stock-ledger side
-- effect to undo: tgd_review_customer_withdrawal_request's CONFIRM_DISPATCH
-- branch only flips the status column (see migration
-- 20260629000002's "Step 3: Correct review function (no stock-deduction
-- side-effect)"), and the customer-portal balance figure is always
-- computed dynamically from requested_boxes/picked_boxes on the
-- withdrawal lines themselves, not decremented separately anywhere. The
-- bridged internal tgd_withdrawal_requests document (created on ACCEPT)
-- is also unaffected either way -- it only ever reaches DRAFT under the
-- current bridge implementation, with no picking/dispatch document
-- linked, so there is nothing on that side to reverse either.
--
-- Recorded picks (picked_boxes/picked_weight) are intentionally left
-- untouched, same as the deposit-side recall leaves actual_boxes/
-- actual_weight alone -- the point is to let staff correct/add lines via
-- the existing withdrawal-line tools, not to wipe what's already there.

begin;

create or replace function public.tgd_admin_recall_completed_withdrawal_request(
  p_request_id uuid,
  p_comment text default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_auth_user_id uuid := auth.uid();
  v_profile record;
  v_document record;
begin
  if v_auth_user_id is null or not public.tgd_current_user_is_active() then
    raise exception 'Active authenticated user required';
  end if;

  select p.id, p.email, p.role into v_profile
  from public.tgd_user_profiles p
  where p.auth_user_id = v_auth_user_id and p.is_active = true
  limit 1;
  if not found then
    raise exception 'User profile not found';
  end if;

  if v_profile.role not in ('admin', 'accounting', 'warehouse_admin', 'warehouse_manager', 'warehouse_staff') then
    raise exception 'Admin or warehouse role required to recall a completed withdrawal request';
  end if;

  select w.id, w.customer_id, w.status, w.withdrawal_no
  into v_document
  from public.tgd_customer_withdrawal_requests w
  where w.id = p_request_id
  for update;

  if not found then
    raise exception 'Customer withdrawal request not found';
  end if;

  if v_document.status <> 'COMPLETED' then
    raise exception 'Withdrawal request must be COMPLETED to recall it back to picking (current status: %)', v_document.status;
  end if;

  update public.tgd_customer_withdrawal_requests
  set status = 'WAREHOUSE_PICKING',
      last_action_by_user_id = v_profile.id,
      last_action_by_email = v_profile.email,
      last_action_at = now()
  where id = v_document.id;

  insert into public.tgd_customer_document_timeline_events (
    document_type, document_id, customer_id, action, from_status, to_status,
    actor_user_id, actor_email, actor_role, actor_customer_id, comment
  ) values (
    'CUSTOMER_WITHDRAWAL_REQUEST', v_document.id, v_document.customer_id,
    'ADMIN_RECALL_COMPLETED', v_document.status, 'WAREHOUSE_PICKING',
    v_profile.id, v_profile.email, v_profile.role, v_profile.customer_id,
    nullif(btrim(p_comment), '')
  );

  return jsonb_build_object(
    'id', v_document.id,
    'customer_id', v_document.customer_id,
    'withdrawal_no', v_document.withdrawal_no,
    'status', 'WAREHOUSE_PICKING',
    'action', 'ADMIN_RECALL_COMPLETED'
  );
end;
$$;

grant execute on function public.tgd_admin_recall_completed_withdrawal_request(uuid, text) to authenticated;

commit;
