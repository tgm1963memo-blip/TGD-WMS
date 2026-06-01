-- 013_tgd_wms_seed_movement_quantity_normalization.sql
-- Normalize seeded stock movement quantities to positive direction-based model.
-- Movement direction is represented by from_location_id / to_location_id.
-- Quantity and weight must be positive values.
-- Staging first. No production apply without approval.

do $$
begin
  if exists (
    select 1
    from public.tgd_stock_movements
    where id = '14141414-1414-4141-8141-141414141413'::uuid
      and movement_type = 'ADJUSTMENT_CONFIRM'
      and quantity < 0
  ) then
    update public.tgd_stock_movements
    set
      quantity = abs(quantity),
      weight = case
        when weight is null then null
        else abs(weight)
      end
    where id = '14141414-1414-4141-8141-141414141413'::uuid
      and movement_type = 'ADJUSTMENT_CONFIRM';
  end if;
end $$;