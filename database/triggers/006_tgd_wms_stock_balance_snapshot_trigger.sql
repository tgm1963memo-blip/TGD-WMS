-- Prepared Stock Balance Snapshot Trigger – DO NOT APPLY TO PRODUCTION WITHOUT CONTROLLER APPROVAL
-- This file defines a trigger that keeps tgd_stock_balances in sync with the movement ledger.
-- No real execution in this sprint.

SET search_path = public;

/*
  Trigger function: updates or inserts a balance row whenever a new stock movement is recorded.
  It runs with SECURITY DEFINER because it must have write access to tgd_stock_balances.
  The search_path is locked to "public" to avoid schema leakage.
  No auth/profile/role checks are needed here – the RPC layer (Sprint 13G) already validated the caller.
*/
CREATE OR REPLACE FUNCTION public.tgd_trigger_update_stock_balance()
RETURNS trigger AS $$
BEGIN
    -- UPSERT into the balance table (customer, item, location) adding the movement quantity
    INSERT INTO tgd_stock_balances (
        customer_id,
        item_id,
        location_id,
        quantity
    ) VALUES (
        NEW.customer_id,
        NEW.item_id,
        NEW.target_location_id,
        NEW.quantity
    ) ON CONFLICT (customer_id, item_id, location_id)
    DO UPDATE SET quantity = tgd_stock_balances.quantity + EXCLUDED.quantity;

    RETURN NULL; -- AFTER trigger must return NULL
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

/*
  AFTER INSERT trigger on the movement ledger.
  Fires the balance‑update function for each new movement row.
*/
CREATE TRIGGER tgd_after_insert_stock_movement
AFTER INSERT ON tgd_stock_movements
FOR EACH ROW
EXECUTE FUNCTION public.tgd_trigger_update_stock_balance();

-- End of Stock Balance Snapshot Trigger
-- Prepared only – do NOT apply to production without Controller approval.
