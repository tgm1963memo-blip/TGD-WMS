-- Seal number (เลขซีล) and the receiving driver's name (ชื่อผู้ขับรถ) on
-- customer deposits and withdrawals, recorded by TGC staff.
--
-- Same shape as tgd_set_*_vehicle_registration (20261113100000): staff-only,
-- configurable through tgd_role_function_allowed, audited on the header
-- (*_set_by_email / *_set_at) and in the document timeline
-- (action SET_TRANSPORT_INFO).
--
-- Idempotent: safe to run more than once.

begin;

alter table public.tgd_customer_deposit_requests
  add column if not exists seal_no text,
  add column if not exists driver_name text,
  add column if not exists transport_info_set_by_email text,
  add column if not exists transport_info_set_at timestamptz;

alter table public.tgd_customer_withdrawal_requests
  add column if not exists seal_no text,
  add column if not exists driver_name text,
  add column if not exists transport_info_set_by_email text,
  add column if not exists transport_info_set_at timestamptz;

create or replace function public.tgd_set_document_transport_info(
  p_document_type text,
  p_request_id uuid,
  p_seal_no text,
  p_driver_name text
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
  v_seal text := nullif(btrim(coalesce(p_seal_no, '')), '');
  v_driver text := nullif(btrim(coalesce(p_driver_name, '')), '');
  v_function_key text;
  v_allowed_roles constant text[] := array['admin','accounting','warehouse_manager','warehouse_admin','warehouse_staff'];
begin
  if v_auth_user_id is null or not public.tgd_current_user_is_active() then
    raise exception 'Active authenticated user required';
  end if;

  if p_document_type not in ('CUSTOMER_DEPOSIT_REQUEST', 'CUSTOMER_WITHDRAWAL_REQUEST') then
    raise exception 'Unsupported document type %', p_document_type;
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

  v_function_key := case p_document_type
    when 'CUSTOMER_DEPOSIT_REQUEST' then 'customer_deposit_set_transport_info'
    else 'customer_withdrawal_set_transport_info'
  end;

  if not public.tgd_role_function_allowed(v_profile.role, v_function_key, v_profile.role = any(v_allowed_roles)) then
    raise exception 'Warehouse or admin role required to record the seal number and driver';
  end if;

  if p_document_type = 'CUSTOMER_DEPOSIT_REQUEST' then
    select d.id, d.customer_id, d.status, d.seal_no, d.driver_name
    into v_document
    from public.tgd_customer_deposit_requests d
    where d.id = p_request_id
    for update;
  else
    select w.id, w.customer_id, w.status, w.seal_no, w.driver_name
    into v_document
    from public.tgd_customer_withdrawal_requests w
    where w.id = p_request_id
    for update;
  end if;

  if not found then
    raise exception 'Request not found';
  end if;

  if v_document.status in ('CANCELLED', 'ADMIN_REJECTED', 'REJECTED') then
    raise exception 'Cannot record transport details on a cancelled/rejected request';
  end if;

  if p_document_type = 'CUSTOMER_DEPOSIT_REQUEST' then
    update public.tgd_customer_deposit_requests
    set seal_no = v_seal,
        driver_name = v_driver,
        transport_info_set_by_email = v_profile.email,
        transport_info_set_at = now(),
        last_action_by_user_id = v_profile.id,
        last_action_by_email = v_profile.email,
        last_action_at = now()
    where id = v_document.id;
  else
    update public.tgd_customer_withdrawal_requests
    set seal_no = v_seal,
        driver_name = v_driver,
        transport_info_set_by_email = v_profile.email,
        transport_info_set_at = now(),
        last_action_by_user_id = v_profile.id,
        last_action_by_email = v_profile.email,
        last_action_at = now()
    where id = v_document.id;
  end if;

  insert into public.tgd_customer_document_timeline_events (
    document_type, document_id, customer_id, action, from_status, to_status,
    actor_user_id, actor_email, actor_role, actor_customer_id, comment, metadata_json
  ) values (
    p_document_type, v_document.id, v_document.customer_id,
    'SET_TRANSPORT_INFO', v_document.status, v_document.status,
    v_profile.id, v_profile.email, v_profile.role, null,
    'บันทึกเลขซีล / ชื่อผู้ขับรถ',
    jsonb_build_object(
      'previous_seal_no', coalesce(v_document.seal_no, '-'),
      'seal_no', coalesce(v_seal, '-'),
      'previous_driver_name', coalesce(v_document.driver_name, '-'),
      'driver_name', coalesce(v_driver, '-')
    )
  );

  return jsonb_build_object(
    'id', v_document.id,
    'seal_no', v_seal,
    'driver_name', v_driver,
    'by_email', v_profile.email,
    'at', now()
  );
end;
$$;

revoke all on function public.tgd_set_document_transport_info(text, uuid, text, text) from public, anon;
grant execute on function public.tgd_set_document_transport_info(text, uuid, text, text) to authenticated;

notify pgrst, 'reload schema';

commit;
