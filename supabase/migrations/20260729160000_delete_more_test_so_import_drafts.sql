-- One-off cleanup: hard-delete 2 more already-cancelled test withdrawal
-- requests (CWR-20260729-0009, -0010) created while testing the FEFO
-- auto-allocation fix for the Sales Order bulk-import feature. Confirmed
-- before deletion: both CANCELLED, zero lines ever picked, no document
-- attachments, no execution links.

begin;

delete from public.tgd_customer_document_timeline_events
where document_id in (
  'f95d1141-bb10-4645-b024-3496ffff9301',
  'eabe17ad-7523-4b6b-8c61-762ef7b0f41b'
);

delete from public.tgd_customer_withdrawal_request_lines
where withdrawal_request_id in (
  'f95d1141-bb10-4645-b024-3496ffff9301',
  'eabe17ad-7523-4b6b-8c61-762ef7b0f41b'
);

delete from public.tgd_customer_withdrawal_requests
where id in (
  'f95d1141-bb10-4645-b024-3496ffff9301',
  'eabe17ad-7523-4b6b-8c61-762ef7b0f41b'
);

commit;
