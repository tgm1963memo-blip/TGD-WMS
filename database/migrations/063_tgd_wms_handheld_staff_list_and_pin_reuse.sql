-- 063_tgd_wms_handheld_staff_list_and_pin_reuse.sql
-- Allow duplicate PIN codes across users (each user has unique identity).
-- Add staff list RPC for handheld login: select user first, then enter PIN.
-- Replace single-PIN lookup with per-user PIN verification.

begin;

-- 1. Remove PIN uniqueness enforcement from admin upsert (allow reuse)
create or replace function public.tgd_admin_upsert_user_profile(
  p_profile_id uuid default null,
  p_email text default null,
  p_display_name text default null,
  p_role text default null,
  p_customer_id uuid default null,
  p_auth_user_id uuid default null,
  p_is_active boolean default true,
  p_pin_code text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor record;
  v_email text := lower(nullif(btrim(p_email), ''));
  v_role text := nullif(btrim(p_role), '');
  v_pin_code text := nullif(btrim(p_pin_code), '');
  v_existing record;
  v_profile_id uuid;
  v_action text;
begin
  if auth.uid() is null or not public.tgd_current_user_is_active() then
    raise exception 'Active authenticated user required';
  end if;

  select p.id, p.email, p.role
  into v_actor
  from public.tgd_user_profiles p
  where p.auth_user_id = auth.uid()
    and p.is_active = true
  limit 1;

  if not found or v_actor.role <> 'admin' then
    raise exception 'Admin role required';
  end if;

  if v_role is null then
    raise exception 'role is required';
  end if;

  if v_role not in (
    'admin', 'warehouse_manager', 'warehouse_admin', 'warehouse_staff', 'accounting', 'viewer',
    'customer_admin', 'customer_user'
  ) then
    raise exception 'Invalid role: %', v_role;
  end if;

  if v_role in ('customer_admin', 'customer_user') then
    if p_customer_id is null then
      raise exception 'customer_id is required for customer portal roles';
    end if;
    if not exists (select 1 from public.tgd_customers c where c.id = p_customer_id and c.is_active = true) then
      raise exception 'customer_id must reference an active customer';
    end if;
  elsif p_customer_id is not null then
    raise exception 'customer_id must be null for internal roles';
  end if;

  -- PIN uniqueness check removed to allow PIN reuse across staff

  if p_profile_id is not null then
    select up.id, up.email, up.display_name, up.role, up.customer_id, up.auth_user_id, up.is_active, up.pin_code
    into v_existing
    from public.tgd_user_profiles up
    where up.id = p_profile_id
    limit 1;

    if not found then
      raise exception 'Profile not found';
    end if;

    if p_auth_user_id is not null
      and exists (
        select 1
        from public.tgd_user_profiles up
        where up.auth_user_id = p_auth_user_id
          and up.id <> p_profile_id
      ) then
      raise exception 'auth_user_id is already linked to another profile';
    end if;

    update public.tgd_user_profiles
    set
      email = coalesce(v_email, email),
      display_name = coalesce(nullif(btrim(p_display_name), ''), display_name),
      role = v_role,
      customer_id = case when v_role in ('customer_admin', 'customer_user') then p_customer_id else null end,
      auth_user_id = coalesce(p_auth_user_id, auth_user_id),
      is_active = coalesce(p_is_active, is_active),
      pin_code = v_pin_code,
      updated_at = now()
    where id = p_profile_id
    returning id into v_profile_id;

    v_action := 'UPDATE_PROFILE';
  else
    if v_email is null then
      raise exception 'email is required for new profile';
    end if;

    if exists (select 1 from public.tgd_user_profiles up where lower(up.email) = v_email) then
      raise exception 'Profile with this email already exists';
    end if;

    if p_auth_user_id is not null
      and exists (
        select 1 from public.tgd_user_profiles up where up.auth_user_id = p_auth_user_id
      ) then
      raise exception 'auth_user_id is already linked to another profile';
    end if;

    insert into public.tgd_user_profiles (
      email, display_name, role, customer_id, auth_user_id, is_active, pin_code
    ) values (
      v_email,
      nullif(btrim(p_display_name), ''),
      v_role,
      case when v_role in ('customer_admin', 'customer_user') then p_customer_id else null end,
      p_auth_user_id,
      coalesce(p_is_active, true),
      v_pin_code
    )
    returning id into v_profile_id;

    v_action := 'CREATE_PROFILE';
  end if;

  perform public.tgd_write_audit_log(jsonb_build_object(
    'entity_type', 'USER_PROFILE',
    'entity_id', v_profile_id::text,
    'action', v_action,
    'performed_by', v_actor.id::text,
    'performed_by_auth_user_id', auth.uid()::text,
    'new_value', jsonb_build_object(
      'email', v_email,
      'display_name', nullif(btrim(p_display_name), ''),
      'role', v_role,
      'customer_id', p_customer_id,
      'auth_user_id', p_auth_user_id,
      'is_active', coalesce(p_is_active, true)
    )
  ));

  return jsonb_build_object(
    'id', v_profile_id,
    'email', v_email,
    'role', v_role,
    'customer_id', case when v_role in ('customer_admin', 'customer_user') then p_customer_id else null end,
    'is_active', coalesce(p_is_active, true),
    'action', v_action
  );
end;
$$;

-- 2. List active TGC staff (non-customer roles) for handheld login picker
create or replace function public.tgd_handheld_list_staff()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rows jsonb;
begin
  if auth.uid() is null then
    raise exception 'Authenticated user required';
  end if;

  select jsonb_agg(
    jsonb_build_object(
      'id', p.id,
      'displayName', coalesce(p.display_name, p.email),
      'email', p.email,
      'role', p.role,
      'hasPin', p.pin_code is not null
    ) order by coalesce(p.display_name, p.email)
  )
  into v_rows
  from public.tgd_user_profiles p
  where p.is_active = true
    and p.role in ('admin', 'warehouse_manager', 'warehouse_admin', 'warehouse_staff', 'accounting')
    and p.pin_code is not null;

  return coalesce(v_rows, '[]'::jsonb);
end;
$$;

-- 3. Verify PIN for a specific profile (supports PIN reuse across users)
create or replace function public.tgd_handheld_verify_pin_for_user(
  p_profile_id uuid,
  p_pin_code text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile record;
begin
  if auth.uid() is null then
    raise exception 'Authenticated user required';
  end if;

  select id, email, display_name, role
  into v_profile
  from public.tgd_user_profiles
  where id = p_profile_id
    and pin_code = p_pin_code
    and is_active = true
  limit 1;

  if not found then
    return jsonb_build_object('success', false, 'error', 'รหัส PIN ไม่ถูกต้อง');
  end if;

  return jsonb_build_object(
    'success', true,
    'profile', jsonb_build_object(
      'id', v_profile.id,
      'email', v_profile.email,
      'displayName', v_profile.display_name,
      'role', v_profile.role
    )
  );
end;
$$;

-- 4. Grants
revoke all on function public.tgd_admin_upsert_user_profile(uuid, text, text, text, uuid, uuid, boolean, text) from public, anon;
grant execute on function public.tgd_admin_upsert_user_profile(uuid, text, text, text, uuid, uuid, boolean, text) to authenticated;

revoke all on function public.tgd_handheld_list_staff() from public, anon;
grant execute on function public.tgd_handheld_list_staff() to authenticated;

revoke all on function public.tgd_handheld_verify_pin_for_user(uuid, text) from public, anon;
grant execute on function public.tgd_handheld_verify_pin_for_user(uuid, text) to authenticated;

commit;
