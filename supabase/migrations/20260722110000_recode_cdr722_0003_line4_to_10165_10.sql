-- Staff-requested correction: CDR-20260722-0003 line 4 (LOT 187) was coded
-- as customer_product_code 10154-10 ("สโมคเบค่อน TGM") — recode to
-- 10165-10, whose catalog entry is a different product entirely
-- ("แฮม 4*4 500 กรัม TGM"); update product_name to match so the recoded
-- line doesn't end up showing an unrelated product's name. temperature_type
-- (FROZEN) is unchanged — both codes' catalog entries already agree.

begin;

update public.tgd_customer_deposit_request_lines
set customer_product_code = '10165-10',
    internal_product_code = '10165-10',
    product_name = 'แฮม 4*4 500 กรัม TGM'
where id = '547d28dc-973b-4a85-9e54-f506d7a863eb';

commit;
