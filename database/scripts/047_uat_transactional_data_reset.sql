-- 047_uat_transactional_data_reset.sql
-- UAT-only transactional data reset. Preserves master data, users, warehouses, products, locations.
-- DRAFT — run on UAT (tgd-wms-staging) only with Controller approval.
-- Uses DELETE (not TRUNCATE) to respect privilege hardening.

begin;

-- Customer portal transactional data
delete from public.tgd_customer_document_timeline_events;
delete from public.tgd_customer_document_attachments;
delete from public.tgd_customer_deposit_request_lines;
delete from public.tgd_customer_withdrawal_request_lines;
delete from public.tgd_customer_deposit_receiving_links;
delete from public.tgd_customer_withdrawal_execution_links;
delete from public.tgd_customer_deposit_requests;
delete from public.tgd_customer_withdrawal_requests;
delete from public.tgd_customer_products;

-- Outbound / dispatch
delete from public.tgd_dispatch_lines;
delete from public.tgd_dispatch_documents;
delete from public.tgd_picking_tasks;
delete from public.tgd_picking_documents;
delete from public.tgd_outbound_lines;
delete from public.tgd_outbound_reservations;
delete from public.tgd_outbound_documents;
delete from public.tgd_allocation_records;

-- Withdrawal / receiving / putaway
delete from public.tgd_withdrawal_request_lines;
delete from public.tgd_withdrawal_requests;
delete from public.tgd_putaway_tasks;
delete from public.tgd_receiving_lines;
delete from public.tgd_receiving_documents;

-- Inventory movement
delete from public.tgd_transfer_lines;
delete from public.tgd_transfer_documents;
delete from public.tgd_adjustment_lines;
delete from public.tgd_adjustment_documents;
delete from public.tgd_stock_count_lines;
delete from public.tgd_stock_count_sessions;
delete from public.tgd_stock_movements;
delete from public.tgd_stock_balances;

-- Billing staging (transactional drafts only)
delete from public.tgd_billing_invoice_draft_lines;
delete from public.tgd_billing_invoice_drafts;
delete from public.tgd_accounting_charge_staging;
delete from public.tgd_operation_charges;
delete from public.tgd_monthly_storage_snapshots;

commit;
