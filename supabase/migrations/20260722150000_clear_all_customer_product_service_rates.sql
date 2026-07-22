-- Staff-requested wipe: remove every existing service rate row (STORAGE and
-- all other service types, both customers — C002 ไทย-เยอรมัน มีท and C003
-- OVO Foodtech, 9 rows total as of this migration) so they can be
-- re-entered from scratch via the "อัตราค่าบริการตามสินค้า" admin page, now
-- that STORAGE rates are enforced to be scoped by storage method
-- (temperature_type) rather than by individual product.
--
-- Confirmed safe before writing this migration: zero rows in
-- tgd_billing_invoice_draft_lines or tgd_customer_deposit_request_services
-- reference any of these 9 rate ids via their service_rate_id FK, so this
-- delete does not orphan any historical billing record.

begin;

delete from public.tgd_customer_product_service_rates;

commit;
