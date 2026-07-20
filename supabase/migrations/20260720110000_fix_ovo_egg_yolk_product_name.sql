-- Data correction requested by staff: OVO Foodtech's customer_product_code
-- 3200200000411 already has the correct name in the catalog
-- (tgd_customer_products, fixed earlier) but the 6 deposit lines already
-- submitted under this code (across CDR-20260716-0009, CDR-20260714-0004,
-- OB-20260701-014034) still carry the old snapshot "ไข่แดงเกลือ11.6%" taken
-- at submission time. Printed documents (e.g. the staff work order print)
-- read the deposit line's own product_name directly, not the catalog, so
-- the earlier catalog-preference fix for the stock balance RPC
-- (20260720100000) does not reach these — update the historical lines
-- directly, scoped tightly to this exact customer + code + old value so
-- nothing else is touched.

begin;

update public.tgd_customer_deposit_request_lines dl
set product_name = 'ไข่รวมเหลวพาสเจอร์ไรซ์ผสมเกลือ 10%'
from public.tgd_customer_deposit_requests dr
where dr.id = dl.deposit_request_id
  and dr.customer_id = '91c30583-3902-4fdc-b179-cc0618c9c1aa'
  and dl.customer_product_code = '3200200000411'
  and dl.product_name = 'ไข่แดงเกลือ11.6%';

commit;
