-- 102_tgd_wms_role_function_access_level.sql
--
-- Business request: on pages that have data-entry forms (receiving,
-- withdrawal review, catalog/admin pages, etc.), let the Roles & Permissions
-- admin page grant a role "read-only" access (can view the page) separate
-- from "read-write" access (can also save/edit/confirm). Enforcement is
-- client-side only per business decision — this column just carries the
-- configured level so the UI can read it.

begin;

alter table public.tgd_role_function_permissions
  add column if not exists access_level text not null default 'write';

alter table public.tgd_role_function_permissions
  drop constraint if exists tgd_role_function_permissions_access_level_check;

alter table public.tgd_role_function_permissions
  add constraint tgd_role_function_permissions_access_level_check
  check (access_level in ('read', 'write'));

-- Recreate the save RPC to accept/persist access_level alongside is_allowed.
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
  v_access_level text;
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
      v_access_level := lower(coalesce(nullif(trim(v_item->>'access_level'), ''), 'write'));
      if v_access_level not in ('read', 'write') then
        v_access_level := 'write';
      end if;

      insert into public.tgd_role_function_permissions (
        role_code, function_key, is_allowed, access_level, updated_by_user_id
      ) values (
        trim(p_role_code), v_function_key, v_allowed, v_access_level, (
          select id from public.tgd_user_profiles
          where auth_user_id = v_auth_user_id and is_active = true
          limit 1
        )
      )
      on conflict (role_code, function_key)
      do update set
        is_allowed = excluded.is_allowed,
        access_level = excluded.access_level,
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

grant execute on function public.tgd_save_role_function_permission_overrides(text, jsonb) to authenticated;

notify pgrst, 'reload schema';

commit;
