-- Delete all test withdrawal request lines first (FK constraint)
DELETE FROM public.tgd_customer_withdrawal_request_lines;

-- Delete all test withdrawal requests
DELETE FROM public.tgd_customer_withdrawal_requests;

-- Delete receiving documents (which reference deposit requests)
DELETE FROM public.tgd_receiving_documents;

-- Delete all test deposit request lines
DELETE FROM public.tgd_customer_deposit_request_lines;

-- Delete all test deposit requests
DELETE FROM public.tgd_customer_deposit_requests;
