-- Reverts migration 20260720110000: staff asked to undo the product_name
-- correction on OVO Foodtech's customer_product_code 3200200000411 deposit
-- lines and restore the original value exactly as it was before that
-- migration ran. Scoped the same way the forward migration was (customer +
-- code + the value it's currently expected to hold) so only the same 6
-- lines are touched, nothing else.

begin;

update public.tgd_customer_deposit_request_lines dl
set product_name = 'ไข่แดงเกลือ11.6%'
from public.tgd_customer_deposit_requests dr
where dr.id = dl.deposit_request_id
  and dr.customer_id = '91c30583-3902-4fdc-b179-cc0618c9c1aa'
  and dl.customer_product_code = '3200200000411'
  and dl.product_name = 'ไข่รวมเหลวพาสเจอร์ไรซ์ผสมเกลือ 10%';

commit;
