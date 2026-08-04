begin;

-- Same bug class again: withdrawal CWR-20260803-0014 line 2 correctly
-- resolved and locked its source deposit line (source_customer_deposit_
-- request_line_id = 57c6ffcf..., tracking_code FR260731081, product
-- 10083-87, lot 205) but was tagged with catalog code '10083-871' instead
-- - a distinct, active catalog entry created one day before this deposit
-- with almost the same name, but with zero deposit history of its own.
-- That made this batch's balance read as fully claimed/zero when searched
-- under '10083-87' (the real code, with real stock) while '10083-871'
-- (the wrong code, with no stock at all) has nothing to show either -
-- so searching either code turns up empty.
update tgd_customer_withdrawal_request_lines
set customer_product_code = '10083-87', internal_product_code = '10083-87'
where id = '06493050-ca72-4ba4-99d7-00ce72cc3992'
and customer_product_code = '10083-871';

commit;
