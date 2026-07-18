-- Lets a customer recall (เรียกเอกสารกลับ) their own submitted deposit
-- request back to DRAFT for editing — but only before it reaches the true
-- point of no return: the ACCEPT decision in
-- tgd_review_customer_deposit_request, which bridges the request into a
-- real warehouse tgd_receiving_documents row
-- (tgd_bridge_customer_deposit_to_receiving) the moment status leaves
-- ADMIN_REVIEWING. So recall is only valid from SUBMITTED_BY_CUSTOMER or
-- ADMIN_REVIEWING — the exact same boundary the admin's own "เปิดใบงาน"
-- (ACCEPT) action already respects (CustomerAdminDepositReviewPage.jsx's
-- canOpenWorkOrder gate). ADMIN_ACCEPTED is deliberately excluded even
-- though it's never actually a durable/observable status (the bridge fires
-- synchronously in the same transaction as ACCEPT) — costs nothing to be
-- defensive about it.
--
-- Does not touch tgd_customer_deposit_request_lines at all — any tracking
-- codes already assigned to lines are left exactly as-is, so resubmitting
-- after editing keeps the same codes (tgd_submit_customer_deposit_request
-- only assigns a tracking_code where a line's is still NULL).

begin;

create or replace function public.tgd_recall_customer_deposit_request(
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

  select p.id, p.email, p.role, p.customer_id
  into v_profile
  from public.tgd_user_profiles p
  where p.auth_user_id = v_auth_user_id
    and p.is_active = true
  limit 1;

  if not found or v_profile.role not in ('customer_admin', 'customer_user', 'admin', 'accounting') then
    raise exception 'Role is not allowed to recall a deposit request';
  end if;

  select d.id, d.customer_id, d.status
  into v_document
  from public.tgd_customer_deposit_requests d
  where d.id = p_request_id
  for update;

  if not found then
    raise exception 'Customer deposit request not found';
  end if;

  if v_profile.role in ('customer_admin', 'customer_user')
     and (v_profile.customer_id is null or v_profile.customer_id <> v_document.customer_id) then
    raise exception 'Customer scope violation';
  end if;

  if v_document.status not in ('SUBMITTED_BY_CUSTOMER', 'ADMIN_REVIEWING') then
    raise exception 'Deposit request can only be recalled while awaiting admin review (current status: %)', v_document.status;
  end if;

  update public.tgd_customer_deposit_requests
  set status = 'DRAFT',
      reviewed_by_user_id = null,
      reviewed_by_email = null,
      reviewed_at = null,
      review_comment = coalesce(nullif(btrim(p_comment), ''), review_comment),
      last_action_by_user_id = v_profile.id,
      last_action_by_email = v_profile.email,
      last_action_at = now()
  where id = v_document.id;

  insert into public.tgd_customer_document_timeline_events (
    document_type, document_id, customer_id, action, from_status, to_status,
    actor_user_id, actor_email, actor_role, actor_customer_id, comment
  ) values (
    'CUSTOMER_DEPOSIT_REQUEST', v_document.id, v_document.customer_id,
    'RECALL', v_document.status, 'DRAFT',
    v_profile.id, v_profile.email, v_profile.role, v_profile.customer_id,
    nullif(btrim(p_comment), '')
  );

  return jsonb_build_object(
    'id', v_document.id,
    'customer_id', v_document.customer_id,
    'status', 'DRAFT',
    'action', 'RECALL'
  );
end;
$$;

revoke all on function public.tgd_recall_customer_deposit_request(uuid, text) from public;
grant execute on function public.tgd_recall_customer_deposit_request(uuid, text) to authenticated;

commit;
