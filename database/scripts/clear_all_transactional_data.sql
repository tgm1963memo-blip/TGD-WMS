-- =============================================================
-- CLEAR ALL TRANSACTIONAL DATA (test data cleanup)
-- Preserves: customers, users, product catalog, warehouse layout,
--            rate rules, products master
-- Deletes:   ALL transactional data via CASCADE
-- WARNING: IRREVERSIBLE — backup first if needed
-- =============================================================
--
-- Uses TRUNCATE ... CASCADE which automatically removes rows from
-- all dependent tables in the correct FK order — no manual ordering needed.
--
-- Parent tables truncated (CASCADE handles all children):
--   tgd_customer_deposit_requests
--     → lines, receiving_documents, timeline_events, email_queue, links
--       → receiving_lines (via receiving_documents cascade)
--   tgd_customer_withdrawal_requests
--     → lines, tgd_withdrawal_requests(old), timeline_events, email_queue, links
--       → withdrawal_allocations, picking_sessions, dispatch, etc. (via old table cascade)
--   tgd_lots
--     → stock_balances, stock_movements, pallets, handheld scans, stock_count_lines
-- =============================================================

begin;

-- Single CASCADE truncate covers the entire transactional graph
truncate table
  public.tgd_customer_deposit_requests,
  public.tgd_customer_withdrawal_requests,
  public.tgd_lots
cascade;

-- Safety net: clear stock tables in case any rows exist without lot references
delete from public.tgd_stock_balances;
delete from public.tgd_stock_movements;

commit;

-- Summary check (all should be 0)
select
  (select count(*) from public.tgd_customer_deposit_requests)    as deposit_requests,
  (select count(*) from public.tgd_customer_withdrawal_requests) as withdrawal_requests,
  (select count(*) from public.tgd_stock_balances)               as stock_balances,
  (select count(*) from public.tgd_stock_movements)              as stock_movements,
  (select count(*) from public.tgd_lots)                         as lots;
