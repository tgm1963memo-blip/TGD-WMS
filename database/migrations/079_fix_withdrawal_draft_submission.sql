-- Fix tgd_submit_customer_withdrawal_request bug where it checks for 'DRAFT' instead of 'WITHDRAWAL_DRAFT'

create or replace function public.tgd_submit_customer_withdrawal_request(
  p_request_id uuid,
  p_comment text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_auth_user_id uuid := auth.uid();
  v_profile record;
  v_document record;
  v_withdrawal_no text;
begin
  if v_auth_user_id is null or not public.tgd_current_user_is_active() then
    raise exception 'Active authenticated user required';
  end if;

  select p.id, p.email, p.role, p.customer_id into v_profile
  from public.tgd_user_profiles p
  where p.auth_user_id = v_auth_user_id and p.is_active = true limit 1;
  if not found then raise exception 'Active profile required'; end if;
  perform public.tgd_assert_customer_request_actor(v_profile.role, v_profile.customer_id);

  select w.id, w.customer_id, w.status, w.withdrawal_no into v_document
  from public.tgd_customer_withdrawal_requests w where w.id = p_request_id for update;
  if not found then raise exception 'Customer withdrawal request not found'; end if;
  perform public.tgd_assert_customer_request_document_scope(v_profile.role, v_profile.customer_id, v_document.customer_id);
  
  -- The Fix: Compare against 'WITHDRAWAL_DRAFT'
  if v_document.status <> 'WITHDRAWAL_DRAFT' then raise exception 'Withdrawal request must be DRAFT before submission'; end if;

  v_withdrawal_no := v_document.withdrawal_no;

  update public.tgd_customer_withdrawal_requests
  set status = 'SUBMITTED_BY_CUSTOMER',
      submitted_by_user_id = v_profile.id,
      submitted_by_email = v_profile.email,
      submitted_at = now(),
      last_action_by_user_id = v_profile.id,
      last_action_by_email = v_profile.email,
      last_action_at = now()
  where id = v_document.id;

  insert into public.tgd_customer_document_timeline_events (
    document_type, document_id, customer_id, action, from_status, to_status,
    actor_user_id, actor_email, actor_role, actor_customer_id, comment
  ) values (
    'CUSTOMER_WITHDRAWAL_REQUEST', v_document.id, v_document.customer_id,
    'SUBMIT', v_document.status, 'SUBMITTED_BY_CUSTOMER',
    v_profile.id, v_profile.email, v_profile.role, v_profile.customer_id,
    nullif(btrim(p_comment), '')
  );

  perform public.tgd_enqueue_customer_request_notifications(
    'CUSTOMER_WITHDRAWAL_REQUEST', v_document.id, v_document.customer_id, v_withdrawal_no, v_profile.email
  );

  return jsonb_build_object(
    'id', v_document.id, 'customer_id', v_document.customer_id,
    'status', 'SUBMITTED_BY_CUSTOMER', 'action', 'SUBMIT'
  );
end;
$$;
