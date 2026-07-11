-- warehouse_admin can already navigate to and see the Customer Product
-- Catalog admin page (frontend nav/route checks already allow it), but the
-- page's actual data query hit an RLS wall: rls_customer_products_select on
-- tgd_customer_products never included warehouse_admin in its role list
-- (only admin/accounting/warehouse_manager/warehouse_staff/viewer), so any
-- SELECT from that role silently returned zero rows regardless of the
-- frontend permission check. Add warehouse_admin to the read policy so the
-- page can actually load data once the frontend is allowed to view it.

begin;

drop policy if exists rls_customer_products_select on public.tgd_customer_products;
create policy rls_customer_products_select
on public.tgd_customer_products
for select
to authenticated
using (
  public.tgd_current_user_is_active()
  and (
    public.tgd_current_user_role() in ('admin', 'accounting', 'warehouse_manager', 'warehouse_admin', 'warehouse_staff', 'viewer')
    or (
      public.tgd_current_user_role() in ('customer_admin', 'customer_user')
      and public.tgd_current_user_customer_id() = customer_id
    )
  )
);

-- Make the frontend view permission explicit/configurable via the Roles &
-- Permissions admin page, matching the page's new hasRoleFunctionAccess
-- check, instead of leaning on ambiguous legacy nav-visibility fallbacks.
insert into public.tgd_role_function_permissions (role_code, function_key, is_allowed, access_level)
values ('warehouse_admin', 'customer_product_catalog_admin', true, 'read')
on conflict (role_code, function_key) do update
  set is_allowed = excluded.is_allowed, access_level = excluded.access_level, updated_at = now();

commit;
