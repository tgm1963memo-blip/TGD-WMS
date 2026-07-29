-- The admin-facing "แก้ไขโปรไฟล์ผู้ใช้" screen (UserManagementPage.jsx) had
-- no way to see or assign a customer_user's customer-side custom role
-- (tgd_customer_custom_roles, added in 20260727130000/20260727140000) —
-- that assignment was only reachable through the customer's own Team
-- Roles page (customer_admin only), so staff creating/editing a user
-- centrally had no link to the role at all. Add customer_custom_role_id
-- support to the admin upsert RPC so both paths write the same column.

begin;

-- Adding a new trailing parameter changes the argument-type list, so
-- CREATE OR REPLACE would leave the old 10-arg overload behind instead of
-- replacing it — drop it explicitly first (same pattern as
-- 20260708100013_withdrawal_line_tracking_code.sql).
drop function if exists public.tgd_admin_upsert_user_profile(
  uuid, text, text, text, text, text, uuid, uuid, boolean, text
);

create or replace function public.tgd_admin_upsert_user_profile(
  p_profile_id   uuid    default null,
  p_email        text    default null,
  p_display_name text    default null,
  p_first_name   text    default null,
  p_last_name    text    default null,
  p_role         text    default null,
  p_customer_id  uuid    default null,
  p_auth_user_id uuid    default null,
  p_is_active    boolean default true,
  p_pin_code     text    default null,
  p_customer_custom_role_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_auth_user_id uuid := auth.uid();
  v_caller record;
  v_result record;
  v_computed_display_name text;
  v_effective_role text;
begin
  if v_auth_user_id is null then
    raise exception 'Authentication required';
  end if;

  select p.id, p.role
  into v_caller
  from public.tgd_user_profiles p
  where p.auth_user_id = v_auth_user_id
    and p.is_active = true
  limit 1;

  if not found or v_caller.role not in ('admin') then
    raise exception 'Admin role required';
  end if;

  v_computed_display_name := coalesce(
    nullif(btrim(coalesce(p_display_name, '')), ''),
    nullif(btrim(coalesce(p_first_name, '') || ' ' || coalesce(p_last_name, '')), '')
  );

  if p_profile_id is not null then
    select coalesce(nullif(btrim(p_role), ''), role) into v_effective_role
    from public.tgd_user_profiles
    where id = p_profile_id;
  else
    v_effective_role := nullif(btrim(p_role), '');
  end if;

  -- A custom role only makes sense for customer_user — force-clear it
  -- whenever the effective role is anything else, so a stale assignment
  -- never lingers on an account that changed role (e.g. promoted to
  -- customer_admin, or converted to a staff role).
  if v_effective_role is distinct from 'customer_user' then
    p_customer_custom_role_id := null;
  elsif p_customer_custom_role_id is not null then
    if not exists (
      select 1 from public.tgd_customer_custom_roles
      where id = p_customer_custom_role_id and customer_id = p_customer_id
    ) then
      raise exception 'Custom role does not belong to this customer';
    end if;
  end if;

  if p_profile_id is not null then
    update public.tgd_user_profiles
    set email        = coalesce(nullif(btrim(p_email), ''), email),
        display_name = coalesce(v_computed_display_name, display_name),
        first_name   = coalesce(nullif(btrim(p_first_name), ''), first_name),
        last_name    = coalesce(nullif(btrim(p_last_name), ''), last_name),
        role         = coalesce(nullif(btrim(p_role), ''), role),
        customer_id  = p_customer_id,
        auth_user_id = coalesce(p_auth_user_id, auth_user_id),
        is_active    = p_is_active,
        pin_code     = coalesce(nullif(btrim(p_pin_code), ''), pin_code),
        customer_custom_role_id = p_customer_custom_role_id,
        updated_at   = now()
    where id = p_profile_id
    returning * into v_result;
  else
    insert into public.tgd_user_profiles
      (email, display_name, first_name, last_name, role, customer_id, auth_user_id, is_active, pin_code, customer_custom_role_id)
    values
      (nullif(btrim(p_email), ''),
       v_computed_display_name,
       nullif(btrim(p_first_name), ''),
       nullif(btrim(p_last_name), ''),
       nullif(btrim(p_role), 'warehouse_staff'),
       p_customer_id,
       p_auth_user_id,
       p_is_active,
       nullif(btrim(p_pin_code), ''),
       p_customer_custom_role_id)
    returning * into v_result;
  end if;

  return jsonb_build_object(
    'id',           v_result.id,
    'email',        v_result.email,
    'display_name', v_result.display_name,
    'first_name',   v_result.first_name,
    'last_name',    v_result.last_name,
    'role',         v_result.role,
    'is_active',    v_result.is_active,
    'customer_custom_role_id', v_result.customer_custom_role_id
  );
end;
$$;

grant execute on function public.tgd_admin_upsert_user_profile(uuid, text, text, text, text, text, uuid, uuid, boolean, text, uuid) to authenticated;

notify pgrst, 'reload schema';

commit;
