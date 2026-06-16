-- 045_tgd_wms_user_management_admin_rpc.sql
-- USER-MGMT-045: Admin-controlled user profile upsert, activation, and self-read policy.
-- DRAFT ONLY — do NOT apply without Controller approval.
-- Prerequisites: migrations 007, 009, 041 applied.
-- Scope: profile metadata only. Does NOT create auth.users rows.

begin;

-- ---------------------------------------------------------------------------
-- 1. Self-read policy — authenticated users can read their own profile row
-- Admin FOR ALL policy from 009 remains for full management.
-- ---------------------------------------------------------------------------

drop policy if exists rls_user_profiles_self_read on public.tgd_user_profiles;
create policy rls_user_profiles_self_read
on public.tgd_user_profiles
for select
to authenticated
using (auth_user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 2. Admin upsert user profile
-- ---------------------------------------------------------------------------

create or replace function public.tgd_admin_upsert_user_profile(
  p_profile_id uuid default null,
  p_email text default null,
  p_display_name text default null,
  p_role text default null,
  p_customer_id uuid default null,
  p_auth_user_id uuid default null,
  p_is_active boolean default true
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
    'admin', 'warehouse_manager', 'warehouse_staff', 'accounting', 'viewer',
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

  if p_profile_id is not null then
    select up.id, up.email, up.display_name, up.role, up.customer_id, up.auth_user_id, up.is_active
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
      email, display_name, role, customer_id, auth_user_id, is_active
    ) values (
      v_email,
      nullif(btrim(p_display_name), ''),
      v_role,
      case when v_role in ('customer_admin', 'customer_user') then p_customer_id else null end,
      p_auth_user_id,
      coalesce(p_is_active, true)
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

-- ---------------------------------------------------------------------------
-- 3. Admin set profile active flag
-- ---------------------------------------------------------------------------

create or replace function public.tgd_admin_set_user_profile_active(
  p_profile_id uuid,
  p_is_active boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor record;
  v_existing record;
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

  if p_profile_id is null then
    raise exception 'profile_id is required';
  end if;

  select up.id, up.email, up.is_active
  into v_existing
  from public.tgd_user_profiles up
  where up.id = p_profile_id
  limit 1;

  if not found then
    raise exception 'Profile not found';
  end if;

  if v_actor.id = p_profile_id and p_is_active = false then
    raise exception 'Cannot deactivate your own profile';
  end if;

  update public.tgd_user_profiles
  set is_active = coalesce(p_is_active, true), updated_at = now()
  where id = p_profile_id;

  perform public.tgd_write_audit_log(jsonb_build_object(
    'entity_type', 'USER_PROFILE',
    'entity_id', p_profile_id::text,
    'action', case when coalesce(p_is_active, true) then 'ACTIVATE_PROFILE' else 'DEACTIVATE_PROFILE' end,
    'performed_by', v_actor.id::text,
    'performed_by_auth_user_id', auth.uid()::text,
    'old_value', jsonb_build_object('is_active', v_existing.is_active),
    'new_value', jsonb_build_object('is_active', coalesce(p_is_active, true))
  ));

  return jsonb_build_object(
    'id', p_profile_id,
    'email', v_existing.email,
    'is_active', coalesce(p_is_active, true),
    'action', case when coalesce(p_is_active, true) then 'ACTIVATE_PROFILE' else 'DEACTIVATE_PROFILE' end
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. Grants
-- ---------------------------------------------------------------------------

revoke all on function public.tgd_admin_upsert_user_profile(uuid, text, text, text, uuid, uuid, boolean) from public, anon;
revoke all on function public.tgd_admin_set_user_profile_active(uuid, boolean) from public, anon;

grant execute on function public.tgd_admin_upsert_user_profile(uuid, text, text, text, uuid, uuid, boolean) to authenticated;
grant execute on function public.tgd_admin_set_user_profile_active(uuid, boolean) to authenticated;

comment on function public.tgd_admin_upsert_user_profile(uuid, text, text, text, uuid, uuid, boolean) is
  'USER-MGMT-045: Admin-only profile create/update. Does not create auth.users.';
comment on function public.tgd_admin_set_user_profile_active(uuid, boolean) is
  'USER-MGMT-045: Admin-only profile activation toggle.';

commit;
