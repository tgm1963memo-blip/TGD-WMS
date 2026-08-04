begin;

-- The internal product master (tgd_products) is a separate, manually
-- maintained table from each customer's own catalog (tgd_customer_products)
-- - reports that resolve a movement row's product_id (e.g. the Movement
-- Ledger's product filter dropdown) join through tgd_products.sku, so any
-- real customer product that was deposited/withdrawn before someone
-- remembered to also register it here becomes permanently unresolvable and
-- invisible to that dropdown, even though the underlying movement is real
-- and correct. Found via a system-wide sweep of every customer_product_code
-- actually used in deposit/withdrawal lines with no matching tgd_products.sku.
-- (The structural fix - searching by the row's own customer_product_code
-- text, independent of this table - is in MovementLedgerReportPage.jsx /
-- movementLedgerReportService.js; this backfill additionally makes the
-- existing productId dropdown work for these codes too.)
insert into tgd_products (sku, name)
select v.sku, v.name
from (values
  ('10083-87', 'คุ๊กแฮม 1,000 กรัม ไม่มีตรา แช่แข็ง(5กก./กล่อง)'),
  ('10094-1', 'สโมคเบค่อน (หัว S)'),
  ('10336-227', 'แพตตี้หมูผสมไก่ 500 กรัม แช่แข็ง'),
  ('10044-87', 'พ็อกแฮมสเต็ก สไลซ์ (1,000 กรัม) ไม่มีตรา แช่แข็ง'),
  ('20261-7', 'ไส้กรอกไก่รมควัน 3.5 นิ้ว แช่แข็ง'),
  ('10044-1', 'พ็อกแฮมสเต็ก สไลซ์ (1,000กรัม)'),
  ('10272-17', 'สโมคเบค่อน (บิท) 1,000 กรัม TSS'),
  ('20231-22', 'เปปโปโรนี 500 กรัม No.MSG (5กก/ลัง)')
) as v(sku, name)
where not exists (select 1 from tgd_products p where p.sku = v.sku);

commit;
