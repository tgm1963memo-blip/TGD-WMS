-- Data correction: customer_product_code '10194-1' was a typo of the real
-- catalog code '10094-1' (tgd_customer_products already has '10094-1' —
-- same product, "สโมคเบค่อน (หัว S)" — and never had an entry for
-- '10194-1' at all, confirming the mistyped lines never matched the
-- catalog). Confirmed via direct query that the only table in the schema
-- with any row referencing '10194-1' is tgd_customer_deposit_request_lines
-- (5 lines, customer_product_code and internal_product_code both carrying
-- the typo — internal_product_code mirrors customer_product_code here
-- since there was no catalog match to resolve it from). Catalog, deposit
-- lines, and withdrawal lines are the only tables with a *_product_code
-- column anywhere in this schema (confirmed via information_schema).

begin;

update public.tgd_customer_deposit_request_lines
set customer_product_code = '10094-1',
    internal_product_code = '10094-1'
where customer_product_code = '10194-1'
   or internal_product_code = '10194-1';

do $$
declare
  v_remaining int;
begin
  select count(*) into v_remaining
  from public.tgd_customer_deposit_request_lines
  where customer_product_code = '10194-1' or internal_product_code = '10194-1';

  if v_remaining > 0 then
    raise exception 'Recode incomplete — % row(s) still reference 10194-1', v_remaining;
  end if;
end $$;

commit;
