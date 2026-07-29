-- One-off cleanup: hard-delete 3 already-cancelled test withdrawal
-- requests (CWR-20260729-0005, -0006, -0007) created while testing the
-- Sales Order bulk-import feature. Confirmed before deletion: all
-- CANCELLED, zero lines ever picked (picked_boxes/picked_weight null on
-- every line), no document attachments, no execution links to an internal
-- warehouse pick job — never touched real stock movement.

begin;

delete from public.tgd_customer_document_timeline_events
where document_id in (
  'fa529e50-f05c-4c9c-9b2c-e3ab20d13b53',
  'e5025d91-fb96-4dae-affb-d42e335646c0',
  'd3aeb40d-4178-4203-baec-c583202ab484'
);

delete from public.tgd_customer_withdrawal_request_lines
where withdrawal_request_id in (
  'fa529e50-f05c-4c9c-9b2c-e3ab20d13b53',
  'e5025d91-fb96-4dae-affb-d42e335646c0',
  'd3aeb40d-4178-4203-baec-c583202ab484'
);

delete from public.tgd_customer_withdrawal_requests
where id in (
  'fa529e50-f05c-4c9c-9b2c-e3ab20d13b53',
  'e5025d91-fb96-4dae-affb-d42e335646c0',
  'd3aeb40d-4178-4203-baec-c583202ab484'
);

commit;
