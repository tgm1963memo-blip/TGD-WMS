-- Data correction requested by staff: deposit request OB-20260702-065503
-- has two lines miscoded at data entry — line 5 (id cce4c698-...,
-- LOT 098/49, previously RPC039 "มันหมูตัดแต่ง") and line 6
-- (id 9c3368d2-..., LOT 098/38, previously RPC048 "ไหล่") should both be
-- RPC049, matching every other line in this same document ("เศษชายสามชั้น
-- (หมู 5)"). Scoped by primary key (not by old code, since other rows
-- correctly keep RPC039/RPC048) so only these exact 2 lines change.
-- Recoding without also correcting product_name would leave an internally
-- inconsistent row (RPC049 paired with an unrelated cut's name), so both
-- are updated together to match every other RPC049 line in this document.

begin;

update public.tgd_customer_deposit_request_lines
set customer_product_code = 'RPC049',
    product_name = 'เศษชายสามชั้น (หมู 5)'
where id in (
  'cce4c698-bf1f-4fb5-989b-f5bd8924e117',
  '9c3368d2-ae3f-4215-ad27-79d5125b4cab'
);

commit;
