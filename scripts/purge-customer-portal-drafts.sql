-- Purge customer portal draft deposit and withdrawal requests (UAT cleanup).
begin;

delete from public.tgd_customer_deposit_request_lines
where deposit_request_id in (
  select id from public.tgd_customer_deposit_requests where status = 'DRAFT'
);

delete from public.tgd_customer_document_timeline_events
where document_type = 'CUSTOMER_DEPOSIT_REQUEST'
  and document_id in (
    select id from public.tgd_customer_deposit_requests where status = 'DRAFT'
  );

delete from public.tgd_customer_document_attachments
where document_type = 'CUSTOMER_DEPOSIT_REQUEST'
  and document_id in (
    select id from public.tgd_customer_deposit_requests where status = 'DRAFT'
  );

delete from public.tgd_customer_deposit_requests
where status = 'DRAFT';

delete from public.tgd_customer_withdrawal_request_lines
where withdrawal_request_id in (
  select id from public.tgd_customer_withdrawal_requests where status = 'WITHDRAWAL_DRAFT'
);

delete from public.tgd_customer_document_timeline_events
where document_type = 'CUSTOMER_WITHDRAWAL_REQUEST'
  and document_id in (
    select id from public.tgd_customer_withdrawal_requests where status = 'WITHDRAWAL_DRAFT'
  );

delete from public.tgd_customer_document_attachments
where document_type = 'CUSTOMER_WITHDRAWAL_REQUEST'
  and document_id in (
    select id from public.tgd_customer_withdrawal_requests where status = 'WITHDRAWAL_DRAFT'
  );

delete from public.tgd_customer_withdrawal_requests
where status = 'WITHDRAWAL_DRAFT';

commit;

select
  (select count(*) from public.tgd_customer_deposit_requests where status = 'DRAFT') as deposit_drafts,
  (select count(*) from public.tgd_customer_withdrawal_requests where status = 'WITHDRAWAL_DRAFT') as withdrawal_drafts;
