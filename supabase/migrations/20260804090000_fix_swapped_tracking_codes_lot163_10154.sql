begin;

-- Two withdrawal picks against product 10154 / lot 163 were recorded against
-- the wrong physical tracking code (batch). Reported directly by warehouse
-- staff comparing the movement ledger to what was actually picked, and
-- corroborated by the data itself: before this fix, FR260630017 (a 300-box
-- deposit line) had 400 boxes withdrawn against it (edfb7312: 200 +
-- c0fd8ee7: 200) — a data-integrity-breaking over-withdrawal only possible
-- because the LOT-level balance check (pooling all of lot 163's tracking
-- codes) doesn't catch a single tracking code being over-picked. Swapping
-- these two lines' tracking_code (and the deposit-line link/batch note that
-- travel with it) makes both source lines land at exactly 0 remaining:
--   FR260630017 (300 boxes): edfb7312 (200) + 4d9c1f43 (100, swapped in)   = 300
--   FR260630019 (700 boxes): 2e5a448a(100)+f8077be2(200)+4257cbf0(200)+c0fd8ee7(200, swapped in) = 700

update tgd_customer_withdrawal_request_lines
set
  tracking_code = 'FR260630019',
  source_customer_deposit_request_line_id = '089afff6-6e1f-47b4-9e79-968042ec752f',
  note = 'A2-06263655'
where id = 'c0fd8ee7-d2c0-42ef-a11b-388df10d693a'
  and tracking_code = 'FR260630017';

update tgd_customer_withdrawal_request_lines
set
  tracking_code = 'FR260630017',
  source_customer_deposit_request_line_id = 'c339c1d9-c76f-4e99-a193-c33b012bead7',
  note = 'A2-06263641'
where id = '4d9c1f43-9b73-4975-875e-dec980e7a374'
  and tracking_code = 'FR260630019';

commit;
