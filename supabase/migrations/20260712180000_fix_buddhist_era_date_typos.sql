-- Backfills dates that were recorded 543 years in the future because a
-- Thai user typed the Buddhist Era year they use in everyday life (e.g.
-- 2569) into a date field instead of the Gregorian year the system stores
-- (2026) — DateInputDMY.jsx now auto-corrects any year past 2100 going
-- forward, but rows entered before that fix still need a one-time
-- backfill. Confirmed via a full scan of every mfg/exp/arrival/dispatch
-- date column in the system (deposit requests + lines, withdrawal
-- requests + lines, lots) that these are the only affected rows.

begin;

update public.tgd_customer_deposit_requests
set expected_arrival_date = make_date(extract(year from expected_arrival_date)::int - 543,
                                       extract(month from expected_arrival_date)::int,
                                       extract(day from expected_arrival_date)::int)
where extract(year from expected_arrival_date) > 2100;

update public.tgd_customer_withdrawal_requests
set requested_dispatch_date = make_date(extract(year from requested_dispatch_date)::int - 543,
                                         extract(month from requested_dispatch_date)::int,
                                         extract(day from requested_dispatch_date)::int)
where extract(year from requested_dispatch_date) > 2100;

-- One additional row (tgd_customer_deposit_request_lines.mfg_date =
-- '7020-07-02') doesn't fit the +543 pattern — a separate one-off typo,
-- not the same Buddhist Era mistake. Sibling lines on the same deposit
-- request all show mfg_date around 2026-07-08 to 2026-07-10, and the
-- day/month (07-02) is otherwise unaffected, so the intended value is
-- unambiguously 2026-07-02.
update public.tgd_customer_deposit_request_lines
set mfg_date = '2026-07-02'
where id = 'dc89c7b9-7a09-425e-ad2c-e507cffa4c26' and mfg_date = '7020-07-02';

commit;
