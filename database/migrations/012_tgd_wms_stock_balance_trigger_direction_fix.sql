-- 012_tgd_wms_stock_balance_trigger_direction_fix.sql
-- Fix stock balance trigger to support inbound, outbound, transfer, adjustment,
-- and any movement where either from_location_id or to_location_id may be null.
-- Staging first. No production apply without approval.

create or replace function public.tgd_trigger_update_stock_balance()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Deduct quantity from source location when from_location_id exists.
  if new.from_location_id is not null then
    insert into public.tgd_stock_balances (
      customer_id,
      product_id,
      lot_id,
      location_id,
      quantity,
      updated_at
    ) values (
      new.customer_id,
      new.product_id,
      new.lot_id,
      new.from_location_id,
      -new.quantity,
      now()
    )
    on conflict (customer_id, product_id, lot_id, location_id)
    do update set
      quantity = public.tgd_stock_balances.quantity + excluded.quantity,
      updated_at = now();
  end if;

  -- Add quantity to target location when to_location_id exists.
  if new.to_location_id is not null then
    insert into public.tgd_stock_balances (
      customer_id,
      product_id,
      lot_id,
      location_id,
      quantity,
      updated_at
    ) values (
      new.customer_id,
      new.product_id,
      new.lot_id,
      new.to_location_id,
      new.quantity,
      now()
    )
    on conflict (customer_id, product_id, lot_id, location_id)
    do update set
      quantity = public.tgd_stock_balances.quantity + excluded.quantity,
      updated_at = now();
  end if;

  return new;
end;
$$;