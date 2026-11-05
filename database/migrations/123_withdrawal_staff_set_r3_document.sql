-- Lets TGC staff tick/untick "ร.3" on a customer withdrawal from the admin
-- review page, at any status short of cancelled/rejected. requires_r3_document
-- is what the billing engine charges the flat R3_DOCUMENT fee on
-- (billingRateEngineService.js — r3FlaggedDocuments), and until now only the
-- customer could set it, and only while the request was still a draft — so a
-- ร.3 TGC processed for a customer who forgot to tick it went unbilled.
--
-- Same shape as tgd_set_withdrawal_overtime (20261020090000): staff-only,
-- configurable through tgd_role_function_allowed, audited on the header and
-- in the document timeline.

begin;

alter table public.tgd_customer_withdrawal_requests
  add column if not exists r3_document_set_by_email text,
  add column if not exists r3_document_set_at timestamptz;

create or replace function public.tgd_set_withdrawal_r3_document(
  p_request_id uuid,
  p_requires_r3_document boolean
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
  v_allowed_roles constant text[] := array['admin','accounting','warehouse_manager','warehouse_admin','warehouse_staff'];
begin
  if v_auth_user_id is null or not public.tgd_current_user_is_active() then
    raise exception 'Active authenticated user required';
  end if;

  select p.id, p.email, p.role
  into v_profile
  from public.tgd_user_profiles p
  where p.auth_user_id = v_auth_user_id
    and p.is_active = true
  limit 1;

  if not found then
    raise exception 'User profile not found';
  end if;

  if p_requires_r3_document is null then
    raise exception 'p_requires_r3_document is required';
  end if;

  if not public.tgd_role_function_allowed(
    v_profile.role, 'customer_withdrawal_set_r3_document',
    v_profile.role = any(v_allowed_roles)
  ) then
    raise exception 'Warehouse or admin role required to set the ร.3 flag';
  end if;

  select w.id, w.customer_id, w.status, w.requires_r3_document
  into v_document
  from public.tgd_customer_withdrawal_requests w
  where w.id = p_request_id
  for update;

  if not found then
    raise exception 'Customer withdrawal request not found';
  end if;

  if v_document.status in ('CANCELLED', 'ADMIN_REJECTED') then
    raise exception 'Cannot set ร.3 on a cancelled/rejected request';
  end if;

  update public.tgd_customer_withdrawal_requests
  set requires_r3_document = p_requires_r3_document,
      r3_document_set_by_email = v_profile.email,
      r3_document_set_at = now(),
      last_action_by_user_id = v_profile.id,
      last_action_by_email = v_profile.email,
      last_action_at = now()
  where id = v_document.id;

  insert into public.tgd_customer_document_timeline_events (
    document_type, document_id, customer_id, action, from_status, to_status,
    actor_user_id, actor_email, actor_role, actor_customer_id, comment, metadata_json
  ) values (
    'CUSTOMER_WITHDRAWAL_REQUEST', v_document.id, v_document.customer_id,
    'SET_R3_DOCUMENT', v_document.status, v_document.status,
    v_profile.id, v_profile.email, v_profile.role, null,
    case when p_requires_r3_document then 'คิดค่าบริการเอกสาร ร.3' else 'ไม่คิดค่าบริการเอกสาร ร.3' end,
    jsonb_build_object('requires_r3_document', p_requires_r3_document, 'previous', v_document.requires_r3_document)
  );

  return jsonb_build_object(
    'id', v_document.id,
    'requires_r3_document', p_requires_r3_document,
    'by_email', v_profile.email,
    'at', now()
  );
end;
$$;

revoke all on function public.tgd_set_withdrawal_r3_document(uuid, boolean) from public, anon;
grant execute on function public.tgd_set_withdrawal_r3_document(uuid, boolean) to authenticated;

notify pgrst, 'reload schema';

commit;
