-- 070_tgd_wms_role_function_permissions.sql
-- Per-role navigation function permissions for the admin permission matrix.

create table if not exists public.tgd_role_function_permissions (
  id                  uuid primary key default gen_random_uuid(),
  role_code           text not null,
  function_key        text not null,
  is_allowed          boolean not null,
  updated_at          timestamptz not null default now(),
  updated_by_user_id  uuid references public.tgd_user_profiles(id) on delete set null,
  constraint tgd_role_function_permissions_unique unique (role_code, function_key)
);

create index if not exists tgd_role_function_permissions_role_idx
  on public.tgd_role_function_permissions (role_code);

drop trigger if exists set_tgd_role_function_permissions_updated_at on public.tgd_role_function_permissions;
create trigger set_tgd_role_function_permissions_updated_at
  before update on public.tgd_role_function_permissions
  for each row execute function public.set_updated_at();

alter table public.tgd_role_function_permissions enable row level security;

drop policy if exists rls_role_function_permissions_read on public.tgd_role_function_permissions;
create policy rls_role_function_permissions_read
  on public.tgd_role_function_permissions
  for select
  to authenticated
  using (true);

drop policy if exists rls_role_function_permissions_write on public.tgd_role_function_permissions;
create policy rls_role_function_permissions_write
  on public.tgd_role_function_permissions
  for all
  to authenticated
  using (public.tgd_current_user_role() = 'admin')
  with check (public.tgd_current_user_role() = 'admin');

grant select, insert, update, delete on public.tgd_role_function_permissions to authenticated;

create or replace function public.tgd_save_role_function_permission_overrides(
  p_role_code   text,
  p_overrides   jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_auth_user_id uuid := auth.uid();
  v_role text;
  v_item jsonb;
  v_function_key text;
  v_allowed boolean;
  v_deleted int := 0;
  v_upserted int := 0;
begin
  if v_auth_user_id is null then
    raise exception 'Authentication required';
  end if;

  select p.role into v_role
  from public.tgd_user_profiles p
  where p.auth_user_id = v_auth_user_id and p.is_active = true
  limit 1;

  if v_role is distinct from 'admin' then
    raise exception 'Admin role required to manage role function permissions';
  end if;

  if coalesce(trim(p_role_code), '') = '' then
    raise exception 'role_code is required';
  end if;

  if lower(trim(p_role_code)) = 'admin' then
    raise exception 'Admin role permissions cannot be overridden';
  end if;

  for v_item in
    select value
    from jsonb_array_elements(coalesce(p_overrides, '[]'::jsonb))
  loop
    v_function_key := trim(coalesce(v_item->>'function_key', ''));
    if v_function_key = '' then
      continue;
    end if;

    if coalesce((v_item->>'reset')::boolean, false) then
      delete from public.tgd_role_function_permissions
      where role_code = trim(p_role_code)
        and function_key = v_function_key;
      v_deleted := v_deleted + 1;
      continue;
    end if;

    if v_item ? 'is_allowed' then
      v_allowed := coalesce((v_item->>'is_allowed')::boolean, false);
      insert into public.tgd_role_function_permissions (
        role_code, function_key, is_allowed, updated_by_user_id
      ) values (
        trim(p_role_code), v_function_key, v_allowed, (
          select id from public.tgd_user_profiles
          where auth_user_id = v_auth_user_id and is_active = true
          limit 1
        )
      )
      on conflict (role_code, function_key)
      do update set
        is_allowed = excluded.is_allowed,
        updated_by_user_id = excluded.updated_by_user_id,
        updated_at = now();
      v_upserted := v_upserted + 1;
    end if;
  end loop;

  return jsonb_build_object(
    'role_code', trim(p_role_code),
    'upserted', v_upserted,
    'deleted', v_deleted
  );
end;
$$;

create or replace function public.tgd_reset_role_function_permissions(
  p_role_code text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_auth_user_id uuid := auth.uid();
  v_role text;
  v_deleted int;
begin
  if v_auth_user_id is null then
    raise exception 'Authentication required';
  end if;

  select p.role into v_role
  from public.tgd_user_profiles p
  where p.auth_user_id = v_auth_user_id and p.is_active = true
  limit 1;

  if v_role is distinct from 'admin' then
    raise exception 'Admin role required to manage role function permissions';
  end if;

  if coalesce(trim(p_role_code), '') = '' then
    raise exception 'role_code is required';
  end if;

  delete from public.tgd_role_function_permissions
  where role_code = trim(p_role_code);

  get diagnostics v_deleted = row_count;

  return jsonb_build_object(
    'role_code', trim(p_role_code),
    'deleted', v_deleted
  );
end;
$$;

grant execute on function public.tgd_save_role_function_permission_overrides(text, jsonb) to authenticated;
grant execute on function public.tgd_reset_role_function_permissions(text) to authenticated;
