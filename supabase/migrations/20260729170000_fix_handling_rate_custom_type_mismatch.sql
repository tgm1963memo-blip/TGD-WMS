-- Root cause of BID-20260729-0009 showing 0.00 handling fee / cold storage
-- charge on every line despite this customer having configured rates:
-- tgd_customer_product_service_rates.service_type is a free-text field
-- (the rate form is an <input list> combobox, not a locked <select>) —
-- whoever set up this customer's rates typed a custom label,
-- "ค่าบริการยกสินค้าเข้า – ออก" (a combined "in-out" phrase), instead of
-- picking the two canonical options the movement-based billing engine
-- actually recognizes ("ค่านำเข้า" / HANDLING_IN and "ค่านำออก" /
-- HANDLING_OUT — see SERVICE_TYPES in productServiceRatesService.js and
-- RATE_SERVICE_TYPES in billingInvoiceDraftService.js). A custom
-- service_type string can never match resolveServiceRate's exact-string
-- lookup for an automatically-classified movement, so every RECEIVE_CONFIRM
-- line kept rate = null, amount = null.
--
-- Splits that one combined custom rate into the two canonical rates it was
-- clearly meant to represent, at the same 1.15 THB/kg the customer already
-- configured for both directions. Deactivates (not deletes) the original
-- custom row so the correction is visible in history rather than silently
-- destroying what was entered.
--
-- After this runs, BID-20260729-0009 (and any other draft with lines still
-- missing a rate for this customer) needs "คำนวณอัตราใหม่" (recalculate
-- rates) clicked on it — see recalculateInvoiceDraftLineRates — to backfill
-- rate/amount on its already-created lines; this migration only fixes the
-- rate configuration data, not already-persisted draft lines.

begin;

update public.tgd_customer_product_service_rates
set is_active = false,
    note = 'ปิดใช้งาน — แยกเป็น HANDLING_IN/HANDLING_OUT แล้ว (สร้างซ้ำโดยพิมพ์ประเภทเอง ไม่ตรงกับประเภทมาตรฐานที่ระบบใช้คำนวณอัตโนมัติ)'
where id = '94f299b4-783c-4d17-b97f-5340ee5d7a85'
  and service_type = 'ค่าบริการยกสินค้าเข้า – ออก';

insert into public.tgd_customer_product_service_rates (
  customer_id, customer_product_id, service_type, rate, unit_basis, currency,
  temperature_type, period_days, max_quantity, is_active, note
)
select
  '1def993f-17db-415d-9215-22d9ef5299cd'::uuid,
  null, 'HANDLING_IN', 1.15, 'PER_KG', 'THB',
  null, null, null, true,
  'แยกจากรายการเดิมที่พิมพ์ประเภทเอง (ค่าบริการยกสินค้าเข้า – ออก)'
where not exists (
  select 1 from public.tgd_customer_product_service_rates
  where customer_id = '1def993f-17db-415d-9215-22d9ef5299cd'::uuid
    and service_type = 'HANDLING_IN'
    and is_active = true
);

insert into public.tgd_customer_product_service_rates (
  customer_id, customer_product_id, service_type, rate, unit_basis, currency,
  temperature_type, period_days, max_quantity, is_active, note
)
select
  '1def993f-17db-415d-9215-22d9ef5299cd'::uuid,
  null, 'HANDLING_OUT', 1.15, 'PER_KG', 'THB',
  null, null, null, true,
  'แยกจากรายการเดิมที่พิมพ์ประเภทเอง (ค่าบริการยกสินค้าเข้า – ออก)'
where not exists (
  select 1 from public.tgd_customer_product_service_rates
  where customer_id = '1def993f-17db-415d-9215-22d9ef5299cd'::uuid
    and service_type = 'HANDLING_OUT'
    and is_active = true
);

commit;
