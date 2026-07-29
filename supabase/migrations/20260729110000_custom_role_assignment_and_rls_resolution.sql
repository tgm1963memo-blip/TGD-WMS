-- Custom roles (created via RolePermissionsAdminPage, stored in
-- tgd_role_definitions with a role_code + base_role) were never actually
-- assignable to a real user: tgd_user_profiles_role_check hardcoded the
-- role column to the 8 built-in role names, so saving a user with
-- role = 'customer_wh' (say) was rejected outright — the "เพิ่ม/แก้ไข
-- โปรไฟล์ผู้ใช้" screen's role list stays disconnected from whatever roles
-- get created on "สิทธิ์และบทบาท". This migration:
--   1. Seeds the one system role missing from tgd_role_definitions
--      (customer_admin — an oversight in the original seed list).
--   2. Replaces the hardcoded CHECK with a FOREIGN KEY to
--      tgd_role_definitions(role_code), so any role defined there becomes
--      a legal, assignable value without needing another migration each
--      time a custom role is added.
--   3. Makes tgd_current_user_role() — the single function every RLS
--      policy in this schema calls to identify the caller's role — resolve
--      a custom (is_system = false) role_code to its base_role. Without
--      this, a user assigned a brand-new custom role would pass the FK
--      check and the frontend dropdown, then be denied by literally every
--      RLS policy in the database (they all do exact-match checks like
--      tgd_current_user_role() in ('admin', 'accounting')), since none of
--      them know how to resolve a role_code they've never seen. System
--      roles are returned unchanged — zero behavior change for every
--      existing user.

begin;

insert into public.tgd_role_definitions (role_code, display_name, description, is_system, sort_order)
values ('customer_admin', 'ผู้ดูแลบัญชีลูกค้า (Customer Admin)', 'จัดการทีมและสิทธิ์ของบริษัทลูกค้า', true, 7)
on conflict (role_code) do update
  set display_name = excluded.display_name,
      description  = excluded.description,
      is_system    = excluded.is_system,
      sort_order   = excluded.sort_order;

update public.tgd_role_definitions set sort_order = 8 where role_code = 'customer_user';

alter table public.tgd_user_profiles
  drop constraint if exists tgd_user_profiles_role_check;

alter table public.tgd_user_profiles
  add constraint tgd_user_profiles_role_fkey
  foreign key (role) references public.tgd_role_definitions(role_code)
  not valid;

-- tgd_user_profiles is small — validate immediately instead of leaving it
-- unchecked against existing rows (every existing role value already
-- exists in tgd_role_definitions, so this is expected to pass cleanly).
alter table public.tgd_user_profiles
  validate constraint tgd_user_profiles_role_fkey;

create or replace function public.tgd_current_user_role()
returns text
language sql
security definer
stable
set search_path = public
as $$
  select case
    when rd.role_code is null or rd.is_system then p.role
    else coalesce(rd.base_role, p.role)
  end
  from public.tgd_user_profiles p
  left join public.tgd_role_definitions rd on rd.role_code = p.role
  where p.auth_user_id = auth.uid()
    and p.is_active = true
  limit 1
$$;

grant execute on function public.tgd_current_user_role() to authenticated;

notify pgrst, 'reload schema';

commit;
