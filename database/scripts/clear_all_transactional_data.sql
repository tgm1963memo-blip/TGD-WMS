-- =============================================================
-- CLEAR ALL TRANSACTIONAL DATA (test data cleanup)
-- Preserves: customers, users, product catalog, warehouse layout,
--            rate rules, products master
-- Deletes:   deposit requests, withdrawal requests, stock,
--            lots, receiving docs, handheld sessions
-- WARNING: IRREVERSIBLE — backup first if needed
-- =============================================================

begin;

do $$
begin

  -- 1. Email notification queue
  delete from public.tgd_customer_request_email_queue;
  raise notice 'cleared: tgd_customer_request_email_queue';

  -- 2. Document timeline events
  delete from public.tgd_customer_document_timeline_events;
  raise notice 'cleared: tgd_customer_document_timeline_events';

  -- 3. Deposit ↔ receiving links
  begin
    delete from public.tgd_customer_deposit_receiving_links;
    raise notice 'cleared: tgd_customer_deposit_receiving_links';
  exception when undefined_table then
    raise notice 'skip (not found): tgd_customer_deposit_receiving_links';
  end;

  -- 4. Withdrawal ↔ execution links
  begin
    delete from public.tgd_customer_withdrawal_execution_links;
    raise notice 'cleared: tgd_customer_withdrawal_execution_links';
  exception when undefined_table then
    raise notice 'skip (not found): tgd_customer_withdrawal_execution_links';
  end;

  -- 5. Handheld picking scans → sessions (reference lots, must go before lots)
  begin
    delete from public.tgd_handheld_picking_scans;
    delete from public.tgd_handheld_picking_sessions;
    raise notice 'cleared: handheld picking';
  exception when undefined_table then
    raise notice 'skip (not found): handheld picking tables';
  end;

  -- 6. Handheld putaway scans → sessions
  begin
    delete from public.tgd_handheld_putaway_scans;
    delete from public.tgd_handheld_putaway_sessions;
    raise notice 'cleared: handheld putaway';
  exception when undefined_table then
    raise notice 'skip (not found): handheld putaway tables';
  end;

  -- 7. Handheld receiving scans → sessions
  begin
    delete from public.tgd_handheld_receiving_scans;
    delete from public.tgd_handheld_receiving_sessions;
    raise notice 'cleared: handheld receiving';
  exception when undefined_table then
    raise notice 'skip (not found): handheld receiving tables';
  end;

  -- 8. Stock count lines → documents/sessions
  begin
    delete from public.tgd_stock_count_lines;
    raise notice 'cleared: tgd_stock_count_lines';
  exception when undefined_table then
    raise notice 'skip (not found): tgd_stock_count_lines';
  end;

  begin
    delete from public.tgd_stock_count_documents;
    raise notice 'cleared: tgd_stock_count_documents';
  exception when undefined_table then
    raise notice 'skip (not found): tgd_stock_count_documents';
  end;

  begin
    delete from public.tgd_stock_count_sessions;
    raise notice 'cleared: tgd_stock_count_sessions';
  exception when undefined_table then
    raise notice 'skip (not found): tgd_stock_count_sessions';
  end;

  -- 9. Receiving lines → documents
  --    (tgd_receiving_documents.source_deposit_request_id → tgd_customer_deposit_requests)
  --    MUST delete before deposit requests
  begin
    delete from public.tgd_receiving_lines;
    delete from public.tgd_receiving_documents;
    raise notice 'cleared: receiving documents + lines';
  exception when undefined_table then
    raise notice 'skip (not found): receiving tables';
  end;

  -- 10. Withdrawal allocation lines → allocations
  begin
    delete from public.tgd_withdrawal_allocation_lines;
    raise notice 'cleared: tgd_withdrawal_allocation_lines';
  exception when undefined_table then
    raise notice 'skip (not found): tgd_withdrawal_allocation_lines';
  end;

  begin
    delete from public.tgd_withdrawal_allocations;
    raise notice 'cleared: tgd_withdrawal_allocations';
  exception when undefined_table then
    raise notice 'skip (not found): tgd_withdrawal_allocations';
  end;

  -- 11. Withdrawal request lines → requests
  delete from public.tgd_customer_withdrawal_request_lines;
  delete from public.tgd_customer_withdrawal_requests;
  raise notice 'cleared: withdrawal requests + lines';

  -- 12. Deposit request lines → requests (safe now — receiving docs already deleted)
  delete from public.tgd_customer_deposit_request_lines;
  delete from public.tgd_customer_deposit_requests;
  raise notice 'cleared: deposit requests + lines';

  -- 13. Stock balances + movements
  delete from public.tgd_stock_balances;
  delete from public.tgd_stock_movements;
  raise notice 'cleared: stock_balances + stock_movements';

  -- 14. Pallets (if exist, reference lots)
  begin
    delete from public.tgd_pallets;
    raise notice 'cleared: tgd_pallets';
  exception when undefined_table then
    raise notice 'skip (not found): tgd_pallets';
  end;

  -- 15. Lots (delete last — many tables reference this)
  delete from public.tgd_lots;
  raise notice 'cleared: tgd_lots';

end;
$$;

commit;

-- Summary check
select
  (select count(*) from public.tgd_customer_deposit_requests)  as deposit_requests,
  (select count(*) from public.tgd_customer_withdrawal_requests) as withdrawal_requests,
  (select count(*) from public.tgd_stock_balances)              as stock_balances,
  (select count(*) from public.tgd_stock_movements)             as stock_movements,
  (select count(*) from public.tgd_lots)                        as lots;
