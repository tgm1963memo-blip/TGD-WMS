-- =================================================================
-- CLEANUP ALL TEST DATA — TGD WMS
-- Keep only: thitiwat.tan@tgm.co.th (user profile)
-- NOTE: Auth users in Supabase dashboard must be deleted separately
--
-- Run this entire script in Supabase SQL Editor (tgc-wms project)
-- =================================================================

BEGIN;

-- ================================================================
-- 1. HANDHELD SESSION DATA
-- ================================================================
DELETE FROM public.tgd_handheld_picking_scans;
DELETE FROM public.tgd_handheld_picking_sessions;
DELETE FROM public.tgd_handheld_putaway_scans;
DELETE FROM public.tgd_handheld_putaway_sessions;
DELETE FROM public.tgd_handheld_receiving_scans;
DELETE FROM public.tgd_handheld_receiving_sessions;

-- ================================================================
-- 2. BILLING DATA
-- ================================================================
DELETE FROM public.tgd_billing_invoice_draft_lines;
DELETE FROM public.tgd_billing_invoice_drafts;
DELETE FROM public.tgd_accounting_charge_staging;
DELETE FROM public.tgd_monthly_storage_snapshots;
DELETE FROM public.tgd_operation_charges;

-- ================================================================
-- 3. CUSTOMER PORTAL — NOTIFICATIONS & TIMELINE
-- ================================================================
DELETE FROM public.tgd_customer_request_email_queue;
DELETE FROM public.tgd_customer_document_timeline_events;
DELETE FROM public.tgd_customer_document_attachments;

-- ================================================================
-- 4. CUSTOMER PORTAL — WITHDRAWAL
-- ================================================================
DELETE FROM public.tgd_customer_withdrawal_execution_links;
DELETE FROM public.tgd_customer_withdrawal_request_lines;
DELETE FROM public.tgd_customer_withdrawal_requests;

-- ================================================================
-- 5. CUSTOMER PORTAL — DEPOSIT & FACILITY
-- ================================================================
DELETE FROM public.tgd_customer_facility_usage_requests;
DELETE FROM public.tgd_customer_deposit_receiving_links;
DELETE FROM public.tgd_customer_deposit_request_lines;
DELETE FROM public.tgd_customer_deposit_requests;

-- ================================================================
-- 6. OPERATIONS — OUTBOUND (Dispatch / Picking / Allocation)
-- ================================================================
DELETE FROM public.tgd_dispatch_lines;
DELETE FROM public.tgd_dispatch_documents;
DELETE FROM public.tgd_picking_tasks;
DELETE FROM public.tgd_allocation_records;
DELETE FROM public.tgd_withdrawal_request_lines;
DELETE FROM public.tgd_withdrawal_requests;

-- ================================================================
-- 7. OPERATIONS — INBOUND (Receiving / Putaway)
-- ================================================================
DELETE FROM public.tgd_receiving_lines;
DELETE FROM public.tgd_receiving_documents;
DELETE FROM public.tgd_putaway_tasks;

-- ================================================================
-- 8. OPERATIONS — TRANSFER / ADJUSTMENT / STOCK COUNT
-- ================================================================
DELETE FROM public.tgd_transfer_lines;
DELETE FROM public.tgd_transfer_documents;
DELETE FROM public.tgd_adjustment_lines;
DELETE FROM public.tgd_adjustment_documents;
DELETE FROM public.tgd_stock_count_lines;
DELETE FROM public.tgd_stock_count_sessions;

-- ================================================================
-- 9. STOCK DATA (movements, balances, lots, pallets)
-- ================================================================
DELETE FROM public.tgd_stock_balances;
DELETE FROM public.tgd_stock_movements;
DELETE FROM public.tgd_lots;
DELETE FROM public.tgd_pallets;

-- ================================================================
-- 10. AUDIT LOGS
-- ================================================================
DELETE FROM public.tgd_audit_logs;

-- ================================================================
-- 11. CUSTOMER CATALOG PRODUCTS
-- ================================================================
DELETE FROM public.tgd_customer_products;

-- ================================================================
-- 12. CUSTOMER CONFIG (rate rules, policies — linked to customers)
-- ================================================================
DELETE FROM public.tgd_customer_storage_rate_rules;
DELETE FROM public.tgd_customer_request_policy;

-- ================================================================
-- 13. USER PROFILES — delete all except thitiwat.tan@tgm.co.th
-- ================================================================
DELETE FROM public.tgd_user_profiles
WHERE email != 'thitiwat.tan@tgm.co.th';

-- ================================================================
-- 14. CUSTOMERS — delete all test customers
-- ================================================================
DELETE FROM public.tgd_customers;

-- ================================================================
-- VERIFY RESULT
-- ================================================================
SELECT 'user_profiles' AS tbl, COUNT(*) FROM public.tgd_user_profiles
UNION ALL SELECT 'customers',         COUNT(*) FROM public.tgd_customers
UNION ALL SELECT 'customer_products', COUNT(*) FROM public.tgd_customer_products
UNION ALL SELECT 'deposit_requests',  COUNT(*) FROM public.tgd_customer_deposit_requests
UNION ALL SELECT 'withdrawal_requests', COUNT(*) FROM public.tgd_customer_withdrawal_requests
UNION ALL SELECT 'receiving_documents', COUNT(*) FROM public.tgd_receiving_documents
UNION ALL SELECT 'stock_movements',   COUNT(*) FROM public.tgd_stock_movements
UNION ALL SELECT 'stock_balances',    COUNT(*) FROM public.tgd_stock_balances
ORDER BY 1;

COMMIT;

-- ================================================================
-- AFTER RUNNING THIS SCRIPT:
-- Go to Supabase Dashboard → Authentication → Users
-- Delete all test accounts manually:
--   - customer.test@tgd-wms.local
--   - staff.test@tgd-wms.local
--   - admin.test@tgd-wms.local
--   - warehouse.admin.test@tgd-wms.local
--   - manager.test@tgd-wms.local
--   - accounting.test@tgd-wms.local
--   - viewer.test@tgd-wms.local
--   (any other test accounts you created during development)
-- Keep only: thitiwat.tan@tgm.co.th
-- ================================================================
