-- Migration 080: Patch stuck DRAFT statuses in customer withdrawal requests
update public.tgd_customer_withdrawal_requests
set status = 'WITHDRAWAL_DRAFT'
where status = 'DRAFT';
