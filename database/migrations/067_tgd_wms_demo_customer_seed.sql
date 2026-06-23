-- 067_tgd_wms_demo_customer_seed.sql
-- Seeds minimum demo data required for test/UAT workflows.
-- Safe to re-run: all inserts use WHERE NOT EXISTS.
--
-- Compatible with the ACTUAL production schema:
--   tgd_customers  → was created from 001_tgd_wms_schema_foundation.sql (columns: id, name, created_at, updated_at)
--                    then extended by 060_tgd_wms_customer_columns_backfill (customer_code, customer_name, …)
--                    Neither customer_code nor customer_name has a UNIQUE constraint.
--   tgd_products   → was created from 001_tgd_wms_schema_foundation.sql (columns: id, sku, description, …)
--                    then extended by 007 (name, unit), 054 (argent_type, storage_charge_basis).
--                    Has NO product_code column and NO unique constraint on sku.
--   tgd_customer_products → created by migration 046 (has customer_product_code, uom, temperature_type, etc.)
--                           Has no unique constraint accessible by name in this DB instance.

-- ──────────────────────────────────────────────────────────────────
-- 1. Demo customers (fixed UUIDs for UAT bootstrap scripts)
-- ──────────────────────────────────────────────────────────────────
insert into public.tgd_customers (id, name, customer_code, customer_name, customer_type, is_active)
select
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'::uuid,
  'Demo Customer Alpha',
  'DEMO-ALPHA',
  'Demo Customer Alpha',
  'THIRD_PARTY',
  true
where not exists (
  select 1 from public.tgd_customers
  where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'::uuid
     or name = 'Demo Customer Alpha'
     or customer_name = 'Demo Customer Alpha'
);

insert into public.tgd_customers (id, name, customer_code, customer_name, customer_type, is_active)
select
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2'::uuid,
  'Demo Customer Beta',
  'DEMO-BETA',
  'Demo Customer Beta',
  'THIRD_PARTY',
  true
where not exists (
  select 1 from public.tgd_customers
  where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2'::uuid
     or name = 'Demo Customer Beta'
     or customer_name = 'Demo Customer Beta'
);

-- ──────────────────────────────────────────────────────────────────
-- 2. Demo internal product
--    Uses sku (the original primary code column) and name (added by migration 007).
--    No product_code or unique constraint exists in this DB instance.
-- ──────────────────────────────────────────────────────────────────
insert into public.tgd_products (sku, name, description)
select
  'FRZ-FLOW-01',
  'Flow Test Product',
  'Demo frozen product for UAT testing'
where not exists (
  select 1 from public.tgd_products where sku = 'FRZ-FLOW-01'
);

-- ──────────────────────────────────────────────────────────────────
-- 3. Customer product catalog entry
--    Joins on sku (tgd_products) and name/customer_name (tgd_customers).
-- ──────────────────────────────────────────────────────────────────
insert into public.tgd_customer_products (
  customer_id,
  customer_product_code,
  product_name,
  internal_product_code,
  internal_product_id,
  uom,
  temperature_type,
  is_active
)
select
  c.id,
  'CUS-FLOW-01',
  'Flow Test Product',
  'FRZ-FLOW-01',
  p.id,
  'KG',
  'FROZEN',
  true
from public.tgd_customers c
join public.tgd_products  p on p.sku = 'FRZ-FLOW-01'
where c.id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'::uuid
  and not exists (
    select 1 from public.tgd_customer_products cp
    where cp.customer_id = c.id
      and cp.customer_product_code = 'CUS-FLOW-01'
  );

-- ──────────────────────────────────────────────────────────────────
-- 4. UAT bootstrap customer catalog (fixed UUID from uat-bootstrap-customer-demo.mjs)
--    Ensures customer.test@tgd-wms.local can pick products in deposit flow.
-- ──────────────────────────────────────────────────────────────────
insert into public.tgd_customer_products (
  customer_id,
  customer_product_code,
  product_name,
  internal_product_code,
  internal_product_id,
  uom,
  temperature_type,
  is_active
)
select
  c.id,
  'CUS-FLOW-01',
  'Flow Test Product',
  'FRZ-FLOW-01',
  p.id,
  'KG',
  'FROZEN',
  true
from public.tgd_customers c
join public.tgd_products p on p.sku = 'FRZ-FLOW-01'
where c.id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'::uuid
  and not exists (
    select 1 from public.tgd_customer_products cp
    where cp.customer_id = c.id
      and cp.customer_product_code = 'CUS-FLOW-01'
  );

-- 5. UAT customer by profile email (customer.test@tgd-wms.local)
insert into public.tgd_customer_products (
  customer_id,
  customer_product_code,
  product_name,
  internal_product_code,
  internal_product_id,
  uom,
  temperature_type,
  is_active
)
select
  up.customer_id,
  'CUS-FLOW-01',
  'Flow Test Product',
  'FRZ-FLOW-01',
  p.id,
  'KG',
  'FROZEN',
  true
from public.tgd_user_profiles up
join public.tgd_products p on p.sku = 'FRZ-FLOW-01'
where up.email like 'customer.%@tgd-wms.local'
  and up.customer_id is not null
  and not exists (
    select 1 from public.tgd_customer_products cp
    where cp.customer_id = up.customer_id
      and cp.customer_product_code = 'CUS-FLOW-01'
  );
