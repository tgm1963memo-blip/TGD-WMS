-- Lets a customer_admin create a new customer_user account for their own
-- company directly from CustomerTeamRolesPage, instead of needing staff to
-- create it via the internal UserManagementPage first. The auth identity
-- itself is created client-side via /api/admin-create-auth-user (extended
-- to accept a customer_admin caller, create-only — no password reset on an
-- existing email, to avoid a customer_admin taking over an unrelated
-- account); this RPC only creates the tgd_user_profiles row, scoped to
-- the caller's own company, mirroring tgd_list_customer_team_users /
-- tgd_assign_customer_user_custom_role's "resolve customer_id server-side,
-- never trust a client-supplied one" pattern.

begin;

create or replace function public.tgd_customer_admin_create_team_user(
  p_auth_user_id uuid,
  p_email text,
  p_display_name text default null,
  p_first_name text default null,
  p_last_name text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_auth_user_id uuid := auth.uid();
  v_profile record;
  v_computed_display_name text;
  v_result record;
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

  if p_auth_user_id is null then
    raise exception 'auth_user_id is required';
  end if;

  if nullif(btrim(coalesce(p_email, '')), '') is null then
    raise exception 'email is required';
  end if;

  if exists (select 1 from public.tgd_user_profiles where auth_user_id = p_auth_user_id) then
    raise exception 'A profile already exists for this login';
  end if;

  v_computed_display_name := coalesce(
    nullif(btrim(coalesce(p_display_name, '')), ''),
    nullif(btrim(coalesce(p_first_name, '') || ' ' || coalesce(p_last_name, '')), '')
  );

  insert into public.tgd_user_profiles (
    email, display_name, first_name, last_name, role, customer_id, auth_user_id, is_active
  ) values (
    btrim(p_email),
    v_computed_display_name,
    nullif(btrim(p_first_name), ''),
    nullif(btrim(p_last_name), ''),
    'customer_user',
    v_profile.customer_id,
    p_auth_user_id,
    true
  )
  returning * into v_result;

  return jsonb_build_object(
    'id', v_result.id,
    'email', v_result.email,
    'display_name', v_result.display_name,
    'role', v_result.role,
    'customer_id', v_result.customer_id
  );
end;
$$;

grant execute on function public.tgd_customer_admin_create_team_user(uuid, text, text, text, text) to authenticated;

notify pgrst, 'reload schema';

commit;
