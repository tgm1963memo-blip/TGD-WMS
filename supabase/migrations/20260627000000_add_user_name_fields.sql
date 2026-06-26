-- Migration: 20260627000000_add_user_name_fields.sql
-- Adds first_name and last_name to tgd_user_profiles; updates the admin upsert RPC.

begin;

alter table public.tgd_user_profiles
  add column if not exists first_name text,
  add column if not exists last_name  text;

-- Backfill: if display_name looks like "First Last", split it
update public.tgd_user_profiles
set first_name = split_part(display_name, ' ', 1),
    last_name  = case
                   when position(' ' in display_name) > 0
                   then substring(display_name from position(' ' in display_name) + 1)
                   else null
                 end
where display_name is not null
  and first_name is null;

-- Replace admin upsert RPC to accept p_first_name and p_last_name
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
  p_pin_code     text    default null
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

  -- Compute display_name: prefer explicit p_display_name, else concat first+last
  v_computed_display_name := coalesce(
    nullif(btrim(coalesce(p_display_name, '')), ''),
    nullif(btrim(coalesce(p_first_name, '') || ' ' || coalesce(p_last_name, '')), '')
  );

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
        updated_at   = now()
    where id = p_profile_id
    returning * into v_result;
  else
    insert into public.tgd_user_profiles
      (email, display_name, first_name, last_name, role, customer_id, auth_user_id, is_active, pin_code)
    values
      (nullif(btrim(p_email), ''),
       v_computed_display_name,
       nullif(btrim(p_first_name), ''),
       nullif(btrim(p_last_name), ''),
       nullif(btrim(p_role), 'warehouse_staff'),
       p_customer_id,
       p_auth_user_id,
       p_is_active,
       nullif(btrim(p_pin_code), ''))
    returning * into v_result;
  end if;

  return jsonb_build_object(
    'id',           v_result.id,
    'email',        v_result.email,
    'display_name', v_result.display_name,
    'first_name',   v_result.first_name,
    'last_name',    v_result.last_name,
    'role',         v_result.role,
    'is_active',    v_result.is_active
  );
end;
$$;

-- Self-service update: allow any active user to update their own first/last name, display_name, pin
create or replace function public.tgd_update_own_profile(
  p_first_name   text    default null,
  p_last_name    text    default null,
  p_display_name text    default null,
  p_pin_code     text    default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_auth_user_id uuid := auth.uid();
  v_result record;
  v_computed_display_name text;
begin
  if v_auth_user_id is null then
    raise exception 'Authentication required';
  end if;

  v_computed_display_name := coalesce(
    nullif(btrim(coalesce(p_display_name, '')), ''),
    nullif(btrim(coalesce(p_first_name, '') || ' ' || coalesce(p_last_name, '')), '')
  );

  update public.tgd_user_profiles
  set first_name   = coalesce(nullif(btrim(p_first_name), ''), first_name),
      last_name    = coalesce(nullif(btrim(p_last_name), ''), last_name),
      display_name = coalesce(v_computed_display_name, display_name),
      pin_code     = case when p_pin_code is not null then nullif(btrim(p_pin_code), '') else pin_code end,
      updated_at   = now()
  where auth_user_id = v_auth_user_id
    and is_active = true
  returning * into v_result;

  if not found then
    raise exception 'Active profile not found for current user';
  end if;

  return jsonb_build_object(
    'id',           v_result.id,
    'first_name',   v_result.first_name,
    'last_name',    v_result.last_name,
    'display_name', v_result.display_name,
    'pin_code',     v_result.pin_code
  );
end;
$$;

grant execute on function public.tgd_admin_upsert_user_profile(uuid, text, text, text, text, text, uuid, uuid, boolean, text) to authenticated;
grant execute on function public.tgd_update_own_profile(text, text, text, text) to authenticated;

commit;
