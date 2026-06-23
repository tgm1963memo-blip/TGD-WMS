-- 062_tgd_wms_withdrawal_lines_lot_no.sql
-- Add lot_no column to tgd_customer_withdrawal_request_lines.
-- Migration 054 added mfg_date/exp_date but missed lot_no which the RPC already references.

begin;

alter table public.tgd_customer_withdrawal_request_lines
  add column if not exists lot_no text;

commit;
