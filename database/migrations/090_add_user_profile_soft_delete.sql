-- 090_add_user_profile_soft_delete.sql
-- USER-MGMT-090: Soft-delete for user profiles.
-- Profiles are never hard-deleted: tgd_audit_logs.performed_by has a FK to
-- tgd_user_profiles(id), so removing a row would break the history of
-- everything that user ever did. Instead we flag the row as deleted,
-- force it inactive, and hide it from the default profile list.

begin;

alter table public.tgd_user_profiles
  add column if not exists is_deleted boolean not null default false,
  add column if not exists deleted_at timestamptz;

create index if not exists tgd_user_profiles_is_deleted_idx
  on public.tgd_user_profiles (is_deleted);

create or replace function public.tgd_admin_delete_user_profile(
  p_profile_id uuid
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

  if v_actor.id = p_profile_id then
    raise exception 'Cannot delete your own profile';
  end if;

  select up.id, up.email, up.is_active, up.is_deleted
  into v_existing
  from public.tgd_user_profiles up
  where up.id = p_profile_id
  limit 1;

  if not found then
    raise exception 'Profile not found';
  end if;

  if v_existing.is_deleted then
    raise exception 'Profile already deleted';
  end if;

  update public.tgd_user_profiles
  set is_deleted = true,
      is_active = false,
      deleted_at = now(),
      updated_at = now()
  where id = p_profile_id;

  perform public.tgd_write_audit_log(jsonb_build_object(
    'entity_type', 'USER_PROFILE',
    'entity_id', p_profile_id::text,
    'action', 'DELETE_PROFILE',
    'performed_by', v_actor.id::text,
    'performed_by_auth_user_id', auth.uid()::text,
    'old_value', jsonb_build_object('is_active', v_existing.is_active, 'is_deleted', v_existing.is_deleted),
    'new_value', jsonb_build_object('is_active', false, 'is_deleted', true)
  ));

  return jsonb_build_object(
    'id', p_profile_id,
    'email', v_existing.email,
    'is_deleted', true,
    'action', 'DELETE_PROFILE'
  );
end;
$$;

revoke all on function public.tgd_admin_delete_user_profile(uuid) from public, anon;
grant execute on function public.tgd_admin_delete_user_profile(uuid) to authenticated;

comment on function public.tgd_admin_delete_user_profile(uuid) is
  'USER-MGMT-090: Admin-only soft delete. Row is kept (forced inactive + flagged) so tgd_audit_logs.performed_by FK history stays intact.';

commit;
