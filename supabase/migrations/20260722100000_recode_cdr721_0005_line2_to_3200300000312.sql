-- Staff-requested correction: CDR-20260721-0005 line 2 (LOT "API",
-- 236 boxes/2,360kg) was coded as customer_product_code 3200300000311 —
-- recode to 3200300000312 instead. product_name ("ไข่รวมเหลวฯ") and
-- temperature_type (FROZEN) are unchanged since both codes' catalog
-- entries already match this line's existing values.

begin;

update public.tgd_customer_deposit_request_lines
set customer_product_code = '3200300000312',
    internal_product_code = '3200300000312'
where id = 'f3b3e680-2b8c-436f-8018-8af6efd8bafe';

commit;
