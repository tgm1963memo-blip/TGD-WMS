-- Mirrors tgd_recall_customer_deposit_request (20260718100000) for
-- withdrawal requests: lets the customer (or admin/accounting) pull a
-- submitted-but-not-yet-accepted withdrawal request back to
-- WITHDRAWAL_DRAFT so it can be edited via the existing create/edit page
-- (CustomerWithdrawalRequestCreatePage.jsx already refuses to
-- edit/submit anything whose status isn't WITHDRAWAL_DRAFT, so resetting
-- the status here is all that's needed for the edit flow to work).
--
-- Allowed only from SUBMITTED_BY_CUSTOMER / ADMIN_REVIEWING, same boundary
-- as the deposit side: once ADMIN_ACCEPTED, tgd_review_customer_withdrawal_request's
-- ACCEPT branch has already fired tgd_bridge_customer_withdrawal_to_internal
-- and bridged this into a real warehouse picking document, so there's no
-- going back at that point — a separate, more powerful "recall confirmed"
-- tool would be needed for that, same split as the deposit side has between
-- tgd_recall_customer_deposit_request and tgd_recall_confirmed_deposit_request.
--
-- Distinct from tgd_cancel_customer_withdrawal_request: cancel sets status
-- to the terminal CANCELLED and is meant to abandon the request; recall
-- resets to WITHDRAWAL_DRAFT so the customer can fix a mistake and resubmit.

begin;

create or replace function public.tgd_recall_customer_withdrawal_request(
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
  where p.auth_user_id = v_auth_user_id and p.is_active = true
  limit 1;

  if not found or v_profile.role not in ('customer_admin', 'customer_user', 'admin', 'accounting') then
    raise exception 'Role is not allowed to recall a withdrawal request';
  end if;

  select w.id, w.customer_id, w.status
  into v_document
  from public.tgd_customer_withdrawal_requests w
  where w.id = p_request_id
  for update;

  if not found then
    raise exception 'Customer withdrawal request not found';
  end if;

  if v_profile.role in ('customer_admin', 'customer_user')
     and (v_profile.customer_id is null or v_profile.customer_id <> v_document.customer_id) then
    raise exception 'Customer scope violation';
  end if;

  if v_document.status not in ('SUBMITTED_BY_CUSTOMER', 'ADMIN_REVIEWING') then
    raise exception 'Withdrawal request can only be recalled while awaiting admin review (current status: %)', v_document.status;
  end if;

  update public.tgd_customer_withdrawal_requests
  set status = 'WITHDRAWAL_DRAFT',
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
    'CUSTOMER_WITHDRAWAL_REQUEST', v_document.id, v_document.customer_id,
    'RECALL', v_document.status, 'WITHDRAWAL_DRAFT',
    v_profile.id, v_profile.email, v_profile.role, v_profile.customer_id,
    nullif(btrim(p_comment), '')
  );

  return jsonb_build_object(
    'id', v_document.id, 'customer_id', v_document.customer_id,
    'status', 'WITHDRAWAL_DRAFT', 'action', 'RECALL'
  );
end;
$$;

revoke all on function public.tgd_recall_customer_withdrawal_request(uuid, text) from public;
grant execute on function public.tgd_recall_customer_withdrawal_request(uuid, text) to authenticated;

commit;
