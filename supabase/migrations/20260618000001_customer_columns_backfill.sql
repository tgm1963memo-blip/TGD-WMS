-- 060_tgd_wms_customer_columns_backfill.sql
-- Add full customer profile columns to tgd_customers.
-- The table was originally created with only id/name/created_at/updated_at.
-- This migration adds the columns that masterDataService.js and the UI expect.

alter table public.tgd_customers
  add column if not exists customer_code  text,
  add column if not exists customer_name  text,
  add column if not exists customer_type  text,
  add column if not exists tax_id         text,
  add column if not exists contact_name   text,
  add column if not exists phone          text,
  add column if not exists email          text,
  add column if not exists address        text,
  add column if not exists is_active      boolean not null default true;

-- Backfill customer_name from the legacy name column for any existing rows.
update public.tgd_customers
  set customer_name = name
  where customer_name is null and name is not null;

-- Indexes used by the application.
create index if not exists tgd_customers_customer_code_idx
  on public.tgd_customers (customer_code)
  where customer_code is not null;

create index if not exists tgd_customers_active_idx
  on public.tgd_customers (is_active)
  where is_active = true;
