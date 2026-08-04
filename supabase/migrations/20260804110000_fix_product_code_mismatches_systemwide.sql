begin;

-- Same bug class as 20260804100000 (withdrawal lines recorded with a
-- different customer's/product's code than the deposit line their
-- tracking_code actually points to), found via a system-wide sweep, not
-- limited to the one customer already fixed.

-- Cluster 1: seven withdrawal picks against tracking_code XX260630040
-- (lot "138 Sup 35") were recorded as RCC019 instead of RCF085 - both are
-- named "หนังไก่" in this customer's catalog but are separate SKUs with
-- separate lots; RCC019's own lots (117 Sup 35 / 127Sup35 / 161/35) are
-- untouched by this fix. Repeated across 6 separate withdrawal requests
-- from 2026-07-11 to 2026-07-29, so this reads as an ongoing mis-pick
-- (the two identically-named catalog entries are easy to confuse), not a
-- single mistake.
update tgd_customer_withdrawal_request_lines
set customer_product_code = 'RCF085', internal_product_code = 'RCF085'
where id in (
  '98c3c53a-2caa-4a3f-820f-ebe19f8eefd2',
  '131ae468-6d69-405a-8e42-f3eaa9f7b43a',
  '00d376de-d9a0-4549-aac7-4a0273150741',
  '407e6216-f84f-427d-84c6-9131bc2ac8bc',
  '9da79f0b-5d92-4040-bf6b-87bbecae091c',
  '292128a6-e64a-4817-918e-1af10230c96e',
  '15f176f3-ba63-4d03-9e39-94fffbcb6ce2'
)
and customer_product_code = 'RCC019';

-- Cluster 2: two not-yet-picked lines on withdrawal CWR-20260803-0008
-- (tracking FR260730018/FR260730019, lots 183/190) were recorded as
-- 10010-711 instead of 10010-77 - again two catalog codes sharing the
-- exact same product name ("แซนวิสแฮม 500 กรัม TSS แช่แข็ง"). Caught
-- before picking, so no balance was ever affected, but would have
-- reproduced the same ledger-vs-balance mismatch once completed.
update tgd_customer_withdrawal_request_lines
set customer_product_code = '10010-77', internal_product_code = '10010-77'
where id in (
  'b65e0c90-c71f-4a05-acf6-7dae36212f32',
  '0a5e9252-8a0f-4ea1-bee9-ecbdcf39346c'
)
and customer_product_code = '10010-711';

-- Cluster 3: one line on a CANCELLED, never-picked request (tracking
-- XX260702017, lot "098/38") recorded as RPC048 ("ไหล่") instead of
-- RPC049 ("เศษชายสามชั้น (หมู 5)") - genuinely different products, a
-- one-off selection mistake. No balance impact since it was cancelled
-- before picking; corrected for data consistency.
update tgd_customer_withdrawal_request_lines
set customer_product_code = 'RPC049', internal_product_code = 'RPC049'
where id = 'bbb3ae6b-bff5-486a-8f75-e48bd99ab54d'
and customer_product_code = 'RPC048';

commit;
