-- 011_tgd_wms_stock_balance_unique_key.sql
-- Add unique key required by stock balance trigger ON CONFLICT.
-- Staging first. No production apply without approval.

-- 1. Safety check: duplicate balance keys must not exist.
do $$
begin
  if exists (
    select 1
    from public.tgd_stock_balances
    group by customer_id, product_id, lot_id, location_id
    having count(*) > 1
  ) then
    raise exception 'Duplicate stock balance keys exist. Cannot create unique index.';
  end if;
end $$;

-- 2. Add unique index for trigger upsert.
create unique index if not exists tgd_stock_balances_customer_product_lot_location_uidx
on public.tgd_stock_balances (
  customer_id,
  product_id,
  lot_id,
  location_id
);