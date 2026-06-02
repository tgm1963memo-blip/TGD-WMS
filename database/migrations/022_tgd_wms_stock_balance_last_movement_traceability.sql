-- 022_tgd_wms_stock_balance_last_movement_traceability.sql
-- Patch draft for stock balance traceability after 13J-Z / 13J-AA validation.
-- This migration is a draft only and must not be applied without controller approval.
-- Production locked for review and controller approval only.

create or replace function public.tgd_trigger_update_stock_balance()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Deduct quantity from source location when from_location_id exists.
  -- `last_movement_id` must be set for traceability, but weight behavior remains intentionally unchanged.
  if new.from_location_id is not null then
    insert into public.tgd_stock_balances (
      customer_id,
      product_id,
      lot_id,
      location_id,
      quantity,
      last_movement_id,
      updated_at
    ) values (
      new.customer_id,
      new.product_id,
      new.lot_id,
      new.from_location_id,
      -new.quantity,
      new.id,
      now()
    )
    on conflict (customer_id, product_id, lot_id, location_id)
    do update set
      quantity = public.tgd_stock_balances.quantity + excluded.quantity,
      last_movement_id = new.id,
      updated_at = now();
  end if;

  -- Add quantity to target location when to_location_id exists.
  -- Weight is intentionally unchanged in this sprint.
  if new.to_location_id is not null then
    insert into public.tgd_stock_balances (
      customer_id,
      product_id,
      lot_id,
      location_id,
      quantity,
      last_movement_id,
      updated_at
    ) values (
      new.customer_id,
      new.product_id,
      new.lot_id,
      new.to_location_id,
      new.quantity,
      new.id,
      now()
    )
    on conflict (customer_id, product_id, lot_id, location_id)
    do update set
      quantity = public.tgd_stock_balances.quantity + excluded.quantity,
      last_movement_id = new.id,
      updated_at = now();
  end if;

  return new;
end;
$$;
