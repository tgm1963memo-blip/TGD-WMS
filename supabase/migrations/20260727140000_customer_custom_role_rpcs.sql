-- RPCs for the customer-side custom roles feature. Every one resolves the
-- caller's own customer_id server-side and never accepts one from the
-- client, so a customer_admin can only ever manage their own company's
-- roles and users — mirrors the "belongs to a different customer" guard
-- already used by tgd_create_customer_facility_usage_request.

begin;

create or replace function public.tgd_upsert_customer_custom_role(
  p_role_id uuid default null,
  p_role_name text default null,
  p_allowed_menu_keys text[] default '{}',
  p_is_active boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_auth_user_id uuid := auth.uid();
  v_profile record;
  v_role_id uuid;
begin
  if v_auth_user_id is null or not public.tgd_current_user_is_active() then
    raise exception 'Active authenticated user required';
  end if;

  select p.id, p.role, p.customer_id into v_profile
  from public.tgd_user_profiles p
  where p.auth_user_id = v_auth_user_id and p.is_active = true
  limit 1;

  if not found or v_profile.role <> 'customer_admin' or v_profile.customer_id is null then
    raise exception 'customer_admin role required';
  end if;

  if nullif(btrim(coalesce(p_role_name, '')), '') is null then
    raise exception 'role_name is required';
  end if;

  if p_role_id is not null then
    update public.tgd_customer_custom_roles
    set role_name = btrim(p_role_name),
        allowed_menu_keys = coalesce(p_allowed_menu_keys, '{}'),
        is_active = coalesce(p_is_active, true)
    where id = p_role_id and customer_id = v_profile.customer_id
    returning id into v_role_id;

    if not found then
      raise exception 'Role not found';
    end if;
  else
    insert into public.tgd_customer_custom_roles (
      customer_id, role_name, allowed_menu_keys, is_active
    ) values (
      v_profile.customer_id, btrim(p_role_name), coalesce(p_allowed_menu_keys, '{}'), coalesce(p_is_active, true)
    )
    returning id into v_role_id;
  end if;

  return jsonb_build_object('id', v_role_id, 'customer_id', v_profile.customer_id, 'role_name', btrim(p_role_name));
end;
$$;

grant execute on function public.tgd_upsert_customer_custom_role(uuid, text, text[], boolean) to authenticated;

create or replace function public.tgd_delete_customer_custom_role(
  p_role_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_auth_user_id uuid := auth.uid();
  v_profile record;
begin
  if v_auth_user_id is null or not public.tgd_current_user_is_active() then
    raise exception 'Active authenticated user required';
  end if;

  select p.role, p.customer_id into v_profile
  from public.tgd_user_profiles p
  where p.auth_user_id = v_auth_user_id and p.is_active = true
  limit 1;

  if not found or v_profile.role <> 'customer_admin' or v_profile.customer_id is null then
    raise exception 'customer_admin role required';
  end if;

  delete from public.tgd_customer_custom_roles
  where id = p_role_id and customer_id = v_profile.customer_id;

  if not found then
    raise exception 'Role not found';
  end if;

  return jsonb_build_object('id', p_role_id, 'deleted', true);
end;
$$;

grant execute on function public.tgd_delete_customer_custom_role(uuid) to authenticated;

-- Direct client SELECT on tgd_user_profiles is admin-only (see migration
-- 009's rls_user_profiles policy) — a customer_admin has no row visibility
-- into their own company's other users at all today, so this RPC (security
-- definer) is the only way to list them.
create or replace function public.tgd_list_customer_team_users()
returns table (
  id uuid,
  email text,
  display_name text,
  customer_custom_role_id uuid
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_auth_user_id uuid := auth.uid();
  v_profile record;
begin
  if v_auth_user_id is null or not public.tgd_current_user_is_active() then
    raise exception 'Active authenticated user required';
  end if;

  select p.role, p.customer_id into v_profile
  from public.tgd_user_profiles p
  where p.auth_user_id = v_auth_user_id and p.is_active = true
  limit 1;

  if not found or v_profile.role <> 'customer_admin' or v_profile.customer_id is null then
    raise exception 'customer_admin role required';
  end if;

  return query
  select p.id, p.email, p.display_name, p.customer_custom_role_id
  from public.tgd_user_profiles p
  where p.customer_id = v_profile.customer_id
    and p.role = 'customer_user'
    and p.is_active = true
    and coalesce(p.is_deleted, false) = false
  order by p.email;
end;
$$;

grant execute on function public.tgd_list_customer_team_users() to authenticated;

create or replace function public.tgd_assign_customer_user_custom_role(
  p_user_profile_id uuid,
  p_custom_role_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_auth_user_id uuid := auth.uid();
  v_profile record;
  v_target record;
begin
  if v_auth_user_id is null or not public.tgd_current_user_is_active() then
    raise exception 'Active authenticated user required';
  end if;

  select p.role, p.customer_id into v_profile
  from public.tgd_user_profiles p
  where p.auth_user_id = v_auth_user_id and p.is_active = true
  limit 1;

  if not found or v_profile.role <> 'customer_admin' or v_profile.customer_id is null then
    raise exception 'customer_admin role required';
  end if;

  select id, role, customer_id into v_target
  from public.tgd_user_profiles
  where id = p_user_profile_id;

  if not found then
    raise exception 'User not found';
  end if;

  if v_target.customer_id is distinct from v_profile.customer_id then
    raise exception 'User belongs to a different customer';
  end if;

  if v_target.role <> 'customer_user' then
    raise exception 'Only customer_user accounts can be assigned a custom role';
  end if;

  if p_custom_role_id is not null then
    if not exists (
      select 1 from public.tgd_customer_custom_roles
      where id = p_custom_role_id and customer_id = v_profile.customer_id
    ) then
      raise exception 'Role not found';
    end if;
  end if;

  update public.tgd_user_profiles
  set customer_custom_role_id = p_custom_role_id
  where id = p_user_profile_id;

  return jsonb_build_object('id', p_user_profile_id, 'customer_custom_role_id', p_custom_role_id);
end;
$$;

grant execute on function public.tgd_assign_customer_user_custom_role(uuid, uuid) to authenticated;

notify pgrst, 'reload schema';

commit;
