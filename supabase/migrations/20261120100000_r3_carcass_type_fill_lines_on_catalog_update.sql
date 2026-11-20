-- Withdrawal lines snapshot the product's ร.3 carcass type when they are
-- saved (trg_withdrawal_line_fill_r3_carcass_type, 20261105100000). A line
-- saved while its catalog product had no ร.3 type kept an empty snapshot, and
-- only re-saving the line filled it — so completed withdrawals kept showing
-- "สินค้ายังไม่ระบุประเภท ร.3" even after the type was set in the catalog.
--
-- Now: whenever a catalog product's ร.3 type is set, fill every withdrawal
-- line of that customer + product code whose snapshot is still empty.
-- Lines that already have a type are left alone (history is not rewritten).

create or replace function public.tgd_customer_product_fill_withdrawal_line_r3()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.r3_carcass_type_code is null then
    return new;
  end if;
  if tg_op = 'UPDATE'
     and new.r3_carcass_type_code is not distinct from old.r3_carcass_type_code
     and new.customer_product_code is not distinct from old.customer_product_code
     and new.customer_id is not distinct from old.customer_id then
    return new;
  end if;

  update public.tgd_customer_withdrawal_request_lines l
  set r3_carcass_type_code = new.r3_carcass_type_code
  from public.tgd_customer_withdrawal_requests w
  where w.id = l.withdrawal_request_id
    and w.customer_id = new.customer_id
    and l.customer_product_code = new.customer_product_code
    and l.r3_carcass_type_code is null;

  return new;
end;
$$;

drop trigger if exists trg_customer_product_fill_withdrawal_line_r3 on public.tgd_customer_products;
create trigger trg_customer_product_fill_withdrawal_line_r3
after insert or update of r3_carcass_type_code, customer_product_code, customer_id
on public.tgd_customer_products
for each row execute function public.tgd_customer_product_fill_withdrawal_line_r3();

-- One-time backfill for lines saved before their product got a ร.3 type.
update public.tgd_customer_withdrawal_request_lines l
set r3_carcass_type_code = cp.r3_carcass_type_code
from public.tgd_customer_withdrawal_requests w
join public.tgd_customer_products cp on cp.customer_id = w.customer_id
where w.id = l.withdrawal_request_id
  and cp.customer_product_code = l.customer_product_code
  and cp.r3_carcass_type_code is not null
  and l.r3_carcass_type_code is null;
