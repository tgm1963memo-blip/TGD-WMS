-- Fixes two conflicting/stale CHECK constraints on
-- tgd_customer_product_service_rates left over from before this table's
-- history diverged across migration folders:
--
-- 1. tgd_product_service_rates_type_check (from
--    supabase/migrations/20260619000005_product_service_rates_and_roles.sql)
--    still restricts service_type to the original 6 values. The admin UI
--    was recently changed to let users type a custom service type (a
--    <datalist>-backed free-text input, see CustomerProductServiceRatesPage
--    .jsx), but this constraint silently rejects any value outside the
--    original list — the feature has never actually worked.
--
-- 2. tgd_product_service_rates_unit_check (same origin migration) restricts
--    unit_basis to ('PER_KG','PER_UNIT','PER_PALLET','PER_TRIP','FLAT',
--    'PER_DAY') — no PER_HOUR. The 20260712090000 migration added PER_HOUR
--    by adding a *new*, differently-named constraint
--    (tgd_customer_product_service_rates_unit_basis_check), because it
--    assumed (incorrectly) that this old constraint was named
--    tgd_customer_product_service_rates_unit_basis_check too and would be
--    replaced by DROP CONSTRAINT IF EXISTS. Both constraints exist
--    simultaneously today, so PER_HOUR is still rejected — the container
--    reefer plug-in billing feature built on top of it has never actually
--    been saveable.

begin;

alter table public.tgd_customer_product_service_rates
  drop constraint if exists tgd_product_service_rates_type_check;

alter table public.tgd_customer_product_service_rates
  drop constraint if exists tgd_product_service_rates_unit_check;

commit;
