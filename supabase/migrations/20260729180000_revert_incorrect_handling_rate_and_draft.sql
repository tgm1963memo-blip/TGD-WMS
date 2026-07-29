-- Reverts 20260729170000: further investigation with the customer
-- confirmed this customer has NO separate handling-in/handling-out fee at
-- all — their actual agreed rate is the STORAGE/FROZEN rate already
-- configured (0.42 THB/kg per 15 days, id 296dee5d-b994-45a3-800d-
-- d52e70635444). The "ค่าบริการยกสินค้าเข้า – ออก" custom rate that started
-- this whole investigation was itself a mistaken entry, not a real fee —
-- splitting it into canonical HANDLING_IN/HANDLING_OUT at 1.15 THB/kg
-- (20260729170000) was therefore ALSO wrong, just a different kind of
-- wrong: it invented a movement-based handling charge this customer never
-- actually agreed to.
--
-- Deactivates those two HANDLING_IN/HANDLING_OUT rates and hard-deletes
-- BID-20260729-0009 (still plain DRAFT status, safe to delete — see
-- deleteBillingInvoiceDraft's own comment on why: lines first, then
-- header, so the underlying movements become selectable again). That
-- draft was created via the movements/handling flow, which is the wrong
-- invoice type for this customer entirely — their real invoice needs to
-- come from the period-based STORAGE billing flow instead, which will
-- correctly pick up the existing 0.42/15-day FROZEN rate.

begin;

update public.tgd_customer_product_service_rates
set is_active = false,
    note = 'ปิดใช้งาน — ลูกค้ารายนี้ไม่มีค่ายก-ขนแยกต่างหาก มีแต่ค่าฝาก (STORAGE) FROZEN 0.42/15 วัน ที่มีอยู่แล้ว'
where id in (
  '29ade357-cf75-4985-9fac-e636301e65bf', -- HANDLING_IN
  'fb7f4533-d102-414f-a514-40297340cae0'  -- HANDLING_OUT
);

delete from public.tgd_billing_invoice_draft_lines
where invoice_draft_id = '9fae2f67-8384-4e0e-9057-9f369bfd76b7';

delete from public.tgd_billing_invoice_drafts
where id = '9fae2f67-8384-4e0e-9057-9f369bfd76b7'
  and status = 'DRAFT';

commit;
