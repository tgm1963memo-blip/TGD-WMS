-- =============================================================
-- CLEAR ALL TRANSACTIONAL DATA (test data cleanup)
-- Preserves: customers, users, warehouse layout, rate rules
-- Deletes:   deposit/withdrawal requests, stock movements/balances,
--            lots, customer product mappings, internal product catalog
-- WARNING: IRREVERSIBLE — backup first if needed
-- =============================================================
--
-- Delete order (child → parent to satisfy FK constraints):
--
--   1. tgd_customer_deposit_requests    CASCADE →
--        tgd_customer_deposit_request_lines
--        tgd_receiving_documents → tgd_receiving_lines
--        timeline_events, email_queue, notification links
--
--   2. tgd_customer_withdrawal_requests CASCADE →
--        tgd_customer_withdrawal_request_lines
--        timeline_events, email_queue, notification links
--
--   3. tgd_lots                         CASCADE →
--        tgd_stock_balances, tgd_stock_movements, tgd_pallets
--        handheld scans, stock_count_lines
--
--   4. Safety net: delete stock rows not linked to any lot
--
--   5. tgd_customer_products — customer ↔ product code mappings
--
--   6. tgd_products — internal product catalog
--      (safe after lots/stock cleared; tgd_customers preserved)
-- =============================================================

begin;

-- Step 1-3: CASCADE truncate covers the entire transactional graph
truncate table
  public.tgd_customer_deposit_requests,
  public.tgd_customer_withdrawal_requests,
  public.tgd_lots
cascade;

-- Step 4: safety net for stock rows not linked to a lot
delete from public.tgd_stock_balances;
delete from public.tgd_stock_movements;

-- Step 5: customer ↔ product code mappings
delete from public.tgd_customer_products;

-- Step 6: internal product catalog
-- (lots/stock/customer_products already cleared — no FK violations)
delete from public.tgd_products;

commit;

-- Summary check (all should be 0)
select
  (select count(*) from public.tgd_customer_deposit_requests)    as deposit_requests,
  (select count(*) from public.tgd_customer_withdrawal_requests) as withdrawal_requests,
  (select count(*) from public.tgd_stock_balances)               as stock_balances,
  (select count(*) from public.tgd_stock_movements)              as stock_movements,
  (select count(*) from public.tgd_lots)                         as lots,
  (select count(*) from public.tgd_customer_products)            as customer_products,
  (select count(*) from public.tgd_products)                     as products;
