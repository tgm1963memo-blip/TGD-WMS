begin;

-- Root cause 1: 8 withdrawal picks against customer OVO Foodtech's lot "API"
-- (and lot "A2-07264087") were recorded with customer_product_code/
-- internal_product_code '3200300000311' (a different real product for this
-- customer) instead of '3200300000312' (the product these lots actually
-- belong to, confirmed via each line's tracking_code matching a 312 deposit
-- line). This made the movement ledger report attribute these dispatches to
-- the wrong product, so product 312's ledger showed no withdrawals for
-- these lots while the true stock balance (unaffected, since it isn't keyed
-- off this line-level code) correctly showed them depleted - the two
-- reports disagreed for exactly this reason.
update tgd_customer_withdrawal_request_lines
set customer_product_code = '3200300000312', internal_product_code = '3200300000312'
where id in (
  'e71b23ff-fdef-45c2-b1a2-240aee1265f2',
  'f2018d67-5299-4451-935a-4d1b6812aa24',
  'cc035882-cdf3-4758-8a24-50fcd53d733c',
  'c8e14da6-a65f-43c1-bfd9-7015be9a2bac',
  '33458b6f-8621-4b79-b2ab-ab829ec659f1',
  '30a5753d-60d4-4ed3-9f4f-efe422fee079',
  '7d222229-7fb4-4d94-ac7a-84806730be56',
  '80d30150-6eb2-461f-a8c7-d2c4c32f8920'
)
and customer_product_code = '3200300000311';

-- Root cause 2: a system-wide, recurring year-typo on requested_dispatch_date
-- (the movement ledger report uses this header field, not the line's own
-- picked_at, as the movement date - see getConfirmedWithdrawalRows in
-- movementLedgerReportService.js). A dispatch date typo'd a year into the
-- future pushes that whole withdrawal's rows out of any report scoped to
-- the actual (correct) month, even though the goods already left and the
-- live stock balance already reflects it - producing exactly this kind of
-- ledger-vs-balance mismatch. Found via a system-wide scan for
-- requested_dispatch_date more than ~200 days from the request's
-- last_action_at on an already-COMPLETED (or in-progress) request.
update tgd_customer_withdrawal_requests
set requested_dispatch_date = '2026-06-17'
where withdrawal_no = 'CWR-20260716-0008' and requested_dispatch_date = '2027-06-17';

update tgd_customer_withdrawal_requests
set requested_dispatch_date = '2026-07-18'
where withdrawal_no = 'CWR-20260717-0001' and requested_dispatch_date = '2027-07-18';

update tgd_customer_withdrawal_requests
set requested_dispatch_date = '2026-07-23'
where withdrawal_no = 'CWR-20260723-0002' and requested_dispatch_date = '2027-07-23';

update tgd_customer_withdrawal_requests
set requested_dispatch_date = '2026-07-24'
where withdrawal_no = 'CWR-20260723-0005' and requested_dispatch_date = '2027-07-24';

update tgd_customer_withdrawal_requests
set requested_dispatch_date = '2026-07-29'
where withdrawal_no = 'CWR-20260727-0005' and requested_dispatch_date = '2027-07-29';

update tgd_customer_withdrawal_requests
set requested_dispatch_date = '2026-07-31'
where withdrawal_no = 'CWR-20260730-0003' and requested_dispatch_date = '4483-07-31';

update tgd_customer_withdrawal_requests
set requested_dispatch_date = '2026-08-04'
where withdrawal_no = 'CWR-20260803-0010' and requested_dispatch_date = '2027-08-04';

commit;
