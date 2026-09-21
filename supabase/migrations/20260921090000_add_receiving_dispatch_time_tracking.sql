-- Adds "start/finish" work-time tracking for the two customer-portal source
-- documents so the ARR TIME/START/FINISH fields already printed on the CDR
-- staff work order, and the START/FINISH blank lines already printed on the
-- CWR withdrawal document, can be filled in from a real button press instead
-- of being handwritten (CWR) or silently duplicating the customer's expected
-- arrival_time (CDR).
--
-- Captured from two places for each document type: the Scan Center handheld
-- workflow (ReceivingWorkflow / PickingWorkflow) and the corresponding admin
-- desktop review page. The handheld device sits behind one authenticated
-- browser session shared by multiple floor staff who identify themselves via
-- a PIN (see 063_tgd_wms_handheld_staff_list_and_pin_reuse.sql) -- that PIN
-- identity is never bound to auth.uid(), so both new RPCs accept an optional
-- p_actor_profile_id the handheld client can supply to attribute the stamp
-- to the PIN-verified staff member rather than whichever account is logged
-- into the shared device. The value is only trusted after being re-resolved
-- server-side against an active profile with an allowed role -- a client
-- can't use it to attribute an action to an arbitrary user.

begin;

alter table public.tgd_customer_deposit_requests
  add column if not exists receiving_started_at timestamptz,
  add column if not exists receiving_started_by_user_id uuid references public.tgd_user_profiles(id),
  add column if not exists receiving_started_by_email text,
  add column if not exists receiving_finished_at timestamptz,
  add column if not exists receiving_finished_by_user_id uuid references public.tgd_user_profiles(id),
  add column if not exists receiving_finished_by_email text;

alter table public.tgd_customer_withdrawal_requests
  add column if not exists dispatch_started_at timestamptz,
  add column if not exists dispatch_started_by_user_id uuid references public.tgd_user_profiles(id),
  add column if not exists dispatch_started_by_email text,
  add column if not exists dispatch_finished_at timestamptz,
  add column if not exists dispatch_finished_by_user_id uuid references public.tgd_user_profiles(id),
  add column if not exists dispatch_finished_by_email text;

create or replace function public.tgd_set_deposit_receiving_time(
  p_request_id uuid,
  p_phase      text,
  p_at         timestamptz default null,
  p_actor_profile_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_auth_user_id uuid := auth.uid();
  v_session_profile record;
  v_profile record;
  v_phase text := upper(nullif(btrim(p_phase), ''));
  v_document record;
  v_stamped_at timestamptz := coalesce(p_at, now());
  v_allowed_roles constant text[] := array['admin','accounting','warehouse_manager','warehouse_admin','warehouse_staff'];
begin
  if v_auth_user_id is null or not public.tgd_current_user_is_active() then
    raise exception 'Active authenticated user required';
  end if;

  select p.id, p.email, p.role
  into v_session_profile
  from public.tgd_user_profiles p
  where p.auth_user_id = v_auth_user_id
    and p.is_active = true
  limit 1;

  if not found then
    raise exception 'User profile not found';
  end if;

  if v_phase not in ('START', 'FINISH') then
    raise exception 'p_phase must be START or FINISH';
  end if;

  if not public.tgd_role_function_allowed(
    v_session_profile.role, 'customer_deposit_record_receiving_time',
    v_session_profile.role = any(v_allowed_roles)
  ) then
    raise exception 'Warehouse or admin role required to record receiving time';
  end if;

  -- Effective actor for the stamp: trust p_actor_profile_id only if it
  -- resolves to a real, active profile with an allowed role -- otherwise
  -- fall back to the session's own profile (this is what admin desktop
  -- always hits, since it has no PIN layer).
  v_profile := v_session_profile;
  if p_actor_profile_id is not null then
    select p.id, p.email, p.role into v_profile
    from public.tgd_user_profiles p
    where p.id = p_actor_profile_id
      and p.is_active = true
      and p.role = any(v_allowed_roles)
    limit 1;
    if not found then
      v_profile := v_session_profile;
    end if;
  end if;

  select d.id, d.customer_id, d.status,
         d.receiving_started_at, d.receiving_finished_at
  into v_document
  from public.tgd_customer_deposit_requests d
  where d.id = p_request_id
  for update;

  if not found then
    raise exception 'Customer deposit request not found';
  end if;

  if v_document.status in ('CANCELLED', 'ADMIN_REJECTED') then
    raise exception 'Cannot record receiving time on a cancelled/rejected request';
  end if;

  if v_phase = 'START' then
    update public.tgd_customer_deposit_requests
    set receiving_started_at = v_stamped_at,
        receiving_started_by_user_id = v_profile.id,
        receiving_started_by_email = v_profile.email,
        last_action_by_user_id = v_session_profile.id,
        last_action_by_email = v_session_profile.email,
        last_action_at = now()
    where id = v_document.id;
  else
    update public.tgd_customer_deposit_requests
    set receiving_finished_at = v_stamped_at,
        receiving_finished_by_user_id = v_profile.id,
        receiving_finished_by_email = v_profile.email,
        last_action_by_user_id = v_session_profile.id,
        last_action_by_email = v_session_profile.email,
        last_action_at = now()
    where id = v_document.id;
  end if;

  insert into public.tgd_customer_document_timeline_events (
    document_type, document_id, customer_id, action,
    actor_user_id, actor_email, actor_role, actor_customer_id, metadata_json
  ) values (
    'CUSTOMER_DEPOSIT_REQUEST', v_document.id, v_document.customer_id,
    'RECEIVING_TIME_' || v_phase,
    v_profile.id, v_profile.email, v_profile.role, null,
    jsonb_build_object(
      'phase', v_phase, 'at', v_stamped_at,
      'previous_at', case when v_phase = 'START' then v_document.receiving_started_at else v_document.receiving_finished_at end
    )
  );

  return jsonb_build_object(
    'id', v_document.id,
    'phase', v_phase,
    'at', v_stamped_at,
    'by_email', v_profile.email
  );
end;
$$;

revoke all on function public.tgd_set_deposit_receiving_time(uuid, text, timestamptz, uuid) from public;
grant execute on function public.tgd_set_deposit_receiving_time(uuid, text, timestamptz, uuid) to authenticated;

create or replace function public.tgd_set_withdrawal_dispatch_time(
  p_request_id uuid,
  p_phase      text,
  p_at         timestamptz default null,
  p_actor_profile_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_auth_user_id uuid := auth.uid();
  v_session_profile record;
  v_profile record;
  v_phase text := upper(nullif(btrim(p_phase), ''));
  v_document record;
  v_stamped_at timestamptz := coalesce(p_at, now());
  v_allowed_roles constant text[] := array['admin','accounting','warehouse_manager','warehouse_admin','warehouse_staff'];
begin
  if v_auth_user_id is null or not public.tgd_current_user_is_active() then
    raise exception 'Active authenticated user required';
  end if;

  select p.id, p.email, p.role
  into v_session_profile
  from public.tgd_user_profiles p
  where p.auth_user_id = v_auth_user_id
    and p.is_active = true
  limit 1;

  if not found then
    raise exception 'User profile not found';
  end if;

  if v_phase not in ('START', 'FINISH') then
    raise exception 'p_phase must be START or FINISH';
  end if;

  if not public.tgd_role_function_allowed(
    v_session_profile.role, 'customer_withdrawal_record_dispatch_time',
    v_session_profile.role = any(v_allowed_roles)
  ) then
    raise exception 'Warehouse or admin role required to record dispatch time';
  end if;

  v_profile := v_session_profile;
  if p_actor_profile_id is not null then
    select p.id, p.email, p.role into v_profile
    from public.tgd_user_profiles p
    where p.id = p_actor_profile_id
      and p.is_active = true
      and p.role = any(v_allowed_roles)
    limit 1;
    if not found then
      v_profile := v_session_profile;
    end if;
  end if;

  select w.id, w.customer_id, w.status,
         w.dispatch_started_at, w.dispatch_finished_at
  into v_document
  from public.tgd_customer_withdrawal_requests w
  where w.id = p_request_id
  for update;

  if not found then
    raise exception 'Customer withdrawal request not found';
  end if;

  if v_document.status in ('CANCELLED', 'ADMIN_REJECTED') then
    raise exception 'Cannot record dispatch time on a cancelled/rejected request';
  end if;

  if v_phase = 'START' then
    update public.tgd_customer_withdrawal_requests
    set dispatch_started_at = v_stamped_at,
        dispatch_started_by_user_id = v_profile.id,
        dispatch_started_by_email = v_profile.email,
        last_action_by_user_id = v_session_profile.id,
        last_action_by_email = v_session_profile.email,
        last_action_at = now()
    where id = v_document.id;
  else
    update public.tgd_customer_withdrawal_requests
    set dispatch_finished_at = v_stamped_at,
        dispatch_finished_by_user_id = v_profile.id,
        dispatch_finished_by_email = v_profile.email,
        last_action_by_user_id = v_session_profile.id,
        last_action_by_email = v_session_profile.email,
        last_action_at = now()
    where id = v_document.id;
  end if;

  insert into public.tgd_customer_document_timeline_events (
    document_type, document_id, customer_id, action,
    actor_user_id, actor_email, actor_role, actor_customer_id, metadata_json
  ) values (
    'CUSTOMER_WITHDRAWAL_REQUEST', v_document.id, v_document.customer_id,
    'DISPATCH_TIME_' || v_phase,
    v_profile.id, v_profile.email, v_profile.role, null,
    jsonb_build_object(
      'phase', v_phase, 'at', v_stamped_at,
      'previous_at', case when v_phase = 'START' then v_document.dispatch_started_at else v_document.dispatch_finished_at end
    )
  );

  return jsonb_build_object(
    'id', v_document.id,
    'phase', v_phase,
    'at', v_stamped_at,
    'by_email', v_profile.email
  );
end;
$$;

revoke all on function public.tgd_set_withdrawal_dispatch_time(uuid, text, timestamptz, uuid) from public;
grant execute on function public.tgd_set_withdrawal_dispatch_time(uuid, text, timestamptz, uuid) to authenticated;

notify pgrst, 'reload schema';

commit;
