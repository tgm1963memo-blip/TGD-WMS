-- 103_backfill_deposit_line_temperature_type.sql
--
-- Business request: the "การจัดเก็บ" (storage type) column shown on deposit
-- documents was recently added as a per-line field. Existing deposit lines
-- created before this field existed have temperature_type = null. Backfill
-- them from the customer's product catalog (source of truth for storage
-- type per product), matching by customer_product_code first and falling
-- back to the internal product id.

begin;

update public.tgd_customer_deposit_request_lines dl
set temperature_type = cp.temperature_type
from public.tgd_customer_deposit_requests dr
join public.tgd_customer_products cp
  on cp.customer_id = dr.customer_id
where dl.deposit_request_id = dr.id
  and cp.customer_product_code = dl.customer_product_code
  and dl.temperature_type is null
  and dl.customer_product_code is not null
  and cp.temperature_type is not null;

update public.tgd_customer_deposit_request_lines dl
set temperature_type = cp.temperature_type
from public.tgd_customer_deposit_requests dr
join public.tgd_customer_products cp
  on cp.customer_id = dr.customer_id
where dl.deposit_request_id = dr.id
  and cp.internal_product_id = dl.product_id
  and dl.temperature_type is null
  and dl.product_id is not null
  and cp.temperature_type is not null;

commit;
