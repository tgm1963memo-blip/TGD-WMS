-- 049_tgd_wms_warehouse_admin_role.sql
-- Add warehouse_admin role for deposit/withdrawal/balance warehouse operators.

begin;

alter table if exists public.tgd_user_profiles
  drop constraint if exists tgd_user_profiles_role_check;

alter table if exists public.tgd_user_profiles
  add constraint tgd_user_profiles_role_check
  check (
    role in (
      'admin',
      'warehouse_manager',
      'warehouse_admin',
      'warehouse_staff',
      'accounting',
      'viewer',
      'customer_admin',
      'customer_user'
    )
  )
  not valid;

comment on constraint tgd_user_profiles_role_check on public.tgd_user_profiles is
  'Adds warehouse_admin between warehouse_staff and warehouse_manager.';

commit;
