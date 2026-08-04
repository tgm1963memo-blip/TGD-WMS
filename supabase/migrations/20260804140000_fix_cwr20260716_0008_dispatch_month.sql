begin;

-- Follow-up correction to the 20260804100000 year-typo fix: that migration
-- conservatively kept this request's originally-typed month (06) and only
-- corrected the year, on the assumption a planned dispatch date could
-- legitimately differ from the request's actual completion date. Confirmed
-- directly against the printed document by the user: the month was also
-- wrong (created 2026-07-16, completed 2026-07-17 - a dispatch "planned"
-- for the month before it was even created is not a legitimate earlier
-- plan, just the rest of the same typo). Correct value is 2026-07-17.
update tgd_customer_withdrawal_requests
set requested_dispatch_date = '2026-07-17'
where withdrawal_no = 'CWR-20260716-0008' and requested_dispatch_date = '2026-06-17';

commit;
