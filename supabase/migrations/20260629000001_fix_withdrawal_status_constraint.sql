-- Fix: tgd_customer_withdrawal_requests status check constraint was missing
-- 'WITHDRAWAL_DRAFT' (the initial draft status used by tgd_create_customer_withdrawal_request)
-- and several later-stage statuses shown in the UI stepper.
-- Drop and recreate with the full set.  NOT VALID skips re-validating existing rows.

ALTER TABLE public.tgd_customer_withdrawal_requests
  DROP CONSTRAINT IF EXISTS tgd_customer_withdrawal_requests_status_check;

ALTER TABLE public.tgd_customer_withdrawal_requests
  ADD CONSTRAINT tgd_customer_withdrawal_requests_status_check
  CHECK (status IN (
    'WITHDRAWAL_DRAFT',
    'DRAFT',
    'SUBMITTED_BY_CUSTOMER',
    'ADMIN_REVIEWING',
    'ADMIN_ACCEPTED',
    'ADMIN_REJECTED',
    'REJECTED',
    'WAREHOUSE_PICKING',
    'PICKED',
    'PACKING_LIST_RECORDED',
    'LOADING',
    'LOADED_CONFIRMED',
    'CUSTOMER_NOTIFIED',
    'COMPLETED',
    'DISPATCHED',
    'CANCELLED'
  )) NOT VALID;
