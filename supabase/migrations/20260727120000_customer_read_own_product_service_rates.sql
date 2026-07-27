-- tgd_customer_product_service_rates' RLS SELECT policies only ever granted
-- staff roles (admin/warehouse_manager/warehouse_admin/accounting/viewer) —
-- customer_admin/customer_user were never included. listAllProductServiceRates
-- is called from two customer-facing pages (the deposit request page's
-- "aux services" picker, and the Facility Usage page's rate picker just
-- added), but a real customer session got zero rows back every time (RLS
-- silently filters them out) — the Facility Usage page then shows "no rate
-- configured for your account" even when the admin has configured several.
--
-- Adds a customer-scoped SELECT policy: a customer_admin/customer_user may
-- read a rate row if it's either an all-items rate directly on their own
-- customer_id, or a product-specific rate on one of their own products —
-- same two-branch ownership shape already used elsewhere for this table
-- (see resolveServiceRate / tgd_create_customer_facility_usage_request's
-- "belongs to a different customer" check).

begin;

drop policy if exists rls_product_service_rates_customer_read on public.tgd_customer_product_service_rates;
create policy rls_product_service_rates_customer_read
  on public.tgd_customer_product_service_rates
  for select
  to authenticated
  using (
    public.tgd_current_user_role() in ('customer_admin', 'customer_user')
    and (
      customer_id = public.tgd_current_user_customer_id()
      or exists (
        select 1 from public.tgd_customer_products cp
        where cp.id = tgd_customer_product_service_rates.customer_product_id
          and cp.customer_id = public.tgd_current_user_customer_id()
      )
    )
  );

commit;
