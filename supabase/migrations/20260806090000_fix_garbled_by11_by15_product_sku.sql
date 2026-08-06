-- Two rows in the internal product master (tgd_products) had a corrupted
-- sku: two Thai combining marks (U+0E3A PINTHU, U+0E4D NIKHAHIT) with no
-- base consonant before them, which render as a boxed/dotted placeholder
-- glyph wherever this sku is shown (e.g. "฀BY11" in the Movement Ledger's
-- product picker, and the same garbled "ฺํBY11" carried into an external
-- reference spreadsheet that reads this same table). The customer catalog
-- (tgd_customer_products) and deposit line records for these two items
-- already store the clean code ("BY11"/"BY15") - only this master-table
-- row was affected.

begin;

update public.tgd_products
set sku = 'BY11'
where id = '6e69a3b2-2ae2-4deb-b34c-8b3e4e4ecf3f'
  and sku = 'ฺํBY11';

update public.tgd_products
set sku = 'BY15'
where id = 'cf9e1f0a-07f0-434f-9fa8-64b565a48ba4'
  and sku = 'ฺํBY15';

commit;
