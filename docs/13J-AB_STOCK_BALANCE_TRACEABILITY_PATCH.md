# 13J-AB Stock Balance Traceability Patch Draft

## Background

The current `public.tgd_trigger_update_stock_balance()` behavior updates stock quantity for source and destination locations, but it does not always preserve `last_movement_id` for the stock balance rows created or updated by movement adjustments.

This draft patch is intended for controlled review only and must not be applied in production without controller approval.

## Root Cause

- `tgd_stock_balances` rows are updated using the current movement quantity.
- The trigger previously kept the quantity logic but did not reliably propagate `new.id` into the `last_movement_id` field on both source and destination balance rows.

## Patch Summary

- Replaces `public.tgd_trigger_update_stock_balance()` with a draft version that:
  - inserts or updates source location stock balance rows when `new.from_location_id` exists;
  - inserts or updates destination location stock balance rows when `new.to_location_id` exists;
  - sets `last_movement_id = new.id` for both insert and update branches;
  - preserves the existing `quantity` accumulation behavior;
  - keeps weight handling intentionally unchanged for this sprint.

## Safety and Lock Status

- This patch is a draft and is not ready for direct application.
- It is documented for review, not for production deployment.
- Controller approval is required before applying this migration.
- The implementation preserves the existing stock balance behavior while improving traceability.
