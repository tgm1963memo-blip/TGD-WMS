-- drop_orphaned_upsert_product_service_rate_overload.sql
-- 20260818090000_billing_contract_terms.sql used `create or replace function`
-- to append 6 new trailing parameters to tgd_upsert_product_service_rate
-- (12 params -> 18 params). Postgres only replaces a function in place when
-- the parameter type list matches exactly -- appending parameters, even with
-- defaults, changes the signature and creates a *second*, separate overload
-- instead of replacing the old one. Confirmed directly against a production
-- schema dump: both the original 12-parameter function and the new
-- 18-parameter one exist simultaneously, both still GRANTed to
-- anon/authenticated/service_role.
--
-- 20260819090000_fix_service_rate_uniqueness_missing_types.sql re-declared
-- the function with the same 18-parameter signature as this one, so it
-- correctly replaced *that* version in place -- only this one orphaned
-- 12-parameter original is left behind.

begin;

drop function if exists public.tgd_upsert_product_service_rate(
  uuid, uuid, text, numeric, text, text, text, boolean, uuid, numeric, text, numeric
);

notify pgrst, 'reload schema';

commit;
