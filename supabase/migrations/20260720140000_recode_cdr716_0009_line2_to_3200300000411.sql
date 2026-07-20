-- Staff-requested correction: CDR-20260716-0009 line 2 (LOT "UNIต้นถังสีฟ้า",
-- 63 boxes/1,260kg) was miscoded as customer_product_code 3200200000411
-- ("ไข่แดงเกลือ11.6%") — but its LOT naming ("front of the blue tank")
-- belongs to the same blue-tank batch series as CDR-20260716-0008 line 5
-- ("ีUNIถังสีฟ้า") and CDR-20260708-0005 line 4 ("Uni กลางถังสีฟ้า"), both
-- correctly coded 3200300000411 ("ไข่รวมเกลือ 10%"). Recode this one line to
-- match its siblings — code, internal code, and name together, so it
-- doesn't end up as a 3200300000411 line still carrying the unrelated
-- 11.6% egg-yolk name, and so it groups correctly with its siblings on the
-- stock balance page (grouped by code+name).

begin;

update public.tgd_customer_deposit_request_lines
set customer_product_code = '3200300000411',
    internal_product_code = '3200300000411',
    product_name = 'ไข่รวมเกลือ 10%'
where id = '8f2f6585-c17c-4efc-b68e-6a1a2c0ef6cc';

commit;
