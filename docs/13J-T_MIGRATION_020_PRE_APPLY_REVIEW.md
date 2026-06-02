# 13J-T Migration 020 Pre-Apply Review

## Purpose

Review migration `020_tgd_wms_receiving_real_stock_posting_draft.sql` before any staging apply. This review is source-only. Migration 020 was not applied, production remains locked, and the Receiving UI remains locked.

## Confirmed Staging Schema Inputs

- `tgd_receiving_documents` has `id`, `customer_id`, `document_no`, `status`, `created_at`, `updated_at`.
- `tgd_receiving_lines` has `id`, `document_id`, `product_id`, `lot_id`, `quantity`, `weight`, `created_at`, `updated_at`.
- `tgd_stock_movements` includes `from_location_id`, `to_location_id`, `quantity`, `movement_type`, `movement_date`, `related_document_id`, `reference`, `created_by`, and other existing columns.
- `tgd_stock_balances` uses `quantity`.

## Patch Summary

- Added `movement_date = now()` to the stock movement insert because staging stock movements include `movement_date`.
- Added explicit `anon` execute revokes for both receiving post RPCs.
- Kept the Receiving UI locked.
- Kept post behavior RPC-only.
- Kept stock balance updates out of the RPC; the existing stock movement trigger remains responsible for balance changes.

## Constraint Findings

- Local migrations include `RECEIVE_CONFIRM` in the stock movement type alignment.
- Local receiving document status definitions include `CONFIRMED`, but Controller should confirm the active staging status constraint before applying.
- The local stock balance trigger uses `from_location_id`, `to_location_id`, and `quantity`, matching the migration's movement insert convention.
- Existing receiving lines do not yet have `location_id`; migration 020 adds it as nullable. Posting will still require populated `location_id` before a document can post.

## Remaining Blockers

- Migration 020 still requires explicit Controller approval before staging apply.
- Existing receiving line data must have valid `location_id` before a real posting can pass validation.
- Active staging status constraint should be verified to allow `CONFIRMED`.
- Receiving UI write remains locked until a future approved enablement sprint.

## Recommendation

PATCH REQUIRED completed in source. Hold apply until Controller reviews the patched draft and confirms staging constraints.
