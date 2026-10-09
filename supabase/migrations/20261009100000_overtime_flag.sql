-- "คิด OT" flag on deposit/withdrawal requests. Admin (header of the
-- detail page) and warehouse staff (scan center / handheld) can mark a
-- document as overtime work; billing then charges OT by weight: each line's
-- actual weight x the customer's OVERTIME rate with unit_basis PER_KG (see
-- computeOvertimeWeightLines in src/utils/billingRateCalc.js).
--
-- Same role set as the dispatch/receiving time RPCs
-- (20260921090000_add_receiving_dispatch_time_tracking.sql), since the
-- handheld is where staff record both. Editable on any status except
-- cancelled/rejected — OT is often confirmed after the fact, while billing.
-- Every change writes a SET_OVERTIME row to the document timeline.

begin;

alter table public.tgd_customer_withdrawal_requests
  add column if not exists is_overtime boolean not null default false,
  add column if not exists overtime_note text,
  add column if not exists overtime_set_by_email text,
  add column if not exists overtime_set_at timestamptz;

alter table public.tgd_customer_deposit_requests
  add column if not exists is_overtime boolean not null default false,
  add column if not exists overtime_note text,
  add column if not exists overtime_set_by_email text,
  add column if not exists overtime_set_at timestamptz;

-- Backfill: requests where the customer already picked an OVERTIME aux
-- service at create time show as "คิด OT" too, so admin sees one picture.
-- (Those selections keep billing through the aux-service path; PER_KG
-- OVERTIME rates are never offered there, so nothing is charged twice.)
update public.tgd_customer_withdrawal_requests w
set is_overtime = true
where exists (
  select 1
  from public.tgd_customer_withdrawal_request_services s
  join public.tgd_customer_product_service_rates r on r.id = s.service_rate_id
  where s.withdrawal_request_id = w.id
    and r.service_type = 'OVERTIME'
);

update public.tgd_customer_deposit_requests d
set is_overtime = true
where exists (
  select 1
  from public.tgd_customer_deposit_request_services s
  join public.tgd_customer_product_service_rates r on r.id = s.service_rate_id
  where s.deposit_request_id = d.id
    and r.service_type = 'OVERTIME'
);

create or replace function public.tgd_set_withdrawal_overtime(
  p_request_id  uuid,
  p_is_overtime boolean,
  p_note        text default null,
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
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
  v_document record;
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

  if p_is_overtime is null then
    raise exception 'p_is_overtime is required';
  end if;

  if not public.tgd_role_function_allowed(
    v_session_profile.role, 'customer_withdrawal_set_overtime',
    v_session_profile.role = any(v_allowed_roles)
  ) then
    raise exception 'Warehouse or admin role required to set overtime';
  end if;

  -- Handheld: the device session may be shared, so credit the staff member
  -- picked on the handheld, same as tgd_set_withdrawal_dispatch_time.
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

  select w.id, w.customer_id, w.status, w.is_overtime, w.overtime_note
  into v_document
  from public.tgd_customer_withdrawal_requests w
  where w.id = p_request_id
  for update;

  if not found then
    raise exception 'Customer withdrawal request not found';
  end if;

  if v_document.status in ('CANCELLED', 'ADMIN_REJECTED') then
    raise exception 'Cannot set overtime on a cancelled/rejected request';
  end if;

  update public.tgd_customer_withdrawal_requests
  set is_overtime = p_is_overtime,
      overtime_note = v_note,
      overtime_set_by_email = v_profile.email,
      overtime_set_at = now(),
      last_action_by_user_id = v_session_profile.id,
      last_action_by_email = v_session_profile.email,
      last_action_at = now()
  where id = v_document.id;

  insert into public.tgd_customer_document_timeline_events (
    document_type, document_id, customer_id, action,
    actor_user_id, actor_email, actor_role, actor_customer_id, comment, metadata_json
  ) values (
    'CUSTOMER_WITHDRAWAL_REQUEST', v_document.id, v_document.customer_id,
    'SET_OVERTIME',
    v_profile.id, v_profile.email, v_profile.role, null,
    case when p_is_overtime then 'คิด OT' else 'ไม่คิด OT' end || coalesce(': ' || v_note, ''),
    jsonb_build_object(
      'is_overtime', p_is_overtime, 'note', v_note,
      'previous', v_document.is_overtime, 'previous_note', v_document.overtime_note
    )
  );

  return jsonb_build_object(
    'id', v_document.id,
    'is_overtime', p_is_overtime,
    'note', v_note,
    'by_email', v_profile.email,
    'at', now()
  );
end;
$$;

revoke all on function public.tgd_set_withdrawal_overtime(uuid, boolean, text, uuid) from public;
grant execute on function public.tgd_set_withdrawal_overtime(uuid, boolean, text, uuid) to authenticated;

create or replace function public.tgd_set_deposit_overtime(
  p_request_id  uuid,
  p_is_overtime boolean,
  p_note        text default null,
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
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
  v_document record;
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

  if p_is_overtime is null then
    raise exception 'p_is_overtime is required';
  end if;

  if not public.tgd_role_function_allowed(
    v_session_profile.role, 'customer_deposit_set_overtime',
    v_session_profile.role = any(v_allowed_roles)
  ) then
    raise exception 'Warehouse or admin role required to set overtime';
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

  select d.id, d.customer_id, d.status, d.is_overtime, d.overtime_note
  into v_document
  from public.tgd_customer_deposit_requests d
  where d.id = p_request_id
  for update;

  if not found then
    raise exception 'Customer deposit request not found';
  end if;

  if v_document.status in ('CANCELLED', 'ADMIN_REJECTED') then
    raise exception 'Cannot set overtime on a cancelled/rejected request';
  end if;

  update public.tgd_customer_deposit_requests
  set is_overtime = p_is_overtime,
      overtime_note = v_note,
      overtime_set_by_email = v_profile.email,
      overtime_set_at = now(),
      last_action_by_user_id = v_session_profile.id,
      last_action_by_email = v_session_profile.email,
      last_action_at = now()
  where id = v_document.id;

  insert into public.tgd_customer_document_timeline_events (
    document_type, document_id, customer_id, action,
    actor_user_id, actor_email, actor_role, actor_customer_id, comment, metadata_json
  ) values (
    'CUSTOMER_DEPOSIT_REQUEST', v_document.id, v_document.customer_id,
    'SET_OVERTIME',
    v_profile.id, v_profile.email, v_profile.role, null,
    case when p_is_overtime then 'คิด OT' else 'ไม่คิด OT' end || coalesce(': ' || v_note, ''),
    jsonb_build_object(
      'is_overtime', p_is_overtime, 'note', v_note,
      'previous', v_document.is_overtime, 'previous_note', v_document.overtime_note
    )
  );

  return jsonb_build_object(
    'id', v_document.id,
    'is_overtime', p_is_overtime,
    'note', v_note,
    'by_email', v_profile.email,
    'at', now()
  );
end;
$$;

revoke all on function public.tgd_set_deposit_overtime(uuid, boolean, text, uuid) from public;
grant execute on function public.tgd_set_deposit_overtime(uuid, boolean, text, uuid) to authenticated;

notify pgrst, 'reload schema';

commit;
