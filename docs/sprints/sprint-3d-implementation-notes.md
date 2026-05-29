# Sprint 3D Implementation Notes

## What Was Created

- `database/migrations/011_dispatch_goods_issue_foundation.sql`
- `database/docs/dispatch-goods-issue-foundation.md`
- `src/constants/dispatchStatus.js`
- `src/services/dispatchService.js`
- `tests/unit/dispatch-schema.test.js`

## Dispatch / Goods Issue Purpose

Dispatch is the real outbound goods issue for customer withdrawal requests.

## Database Objects

- `tgd_dispatch_documents`
- `tgd_dispatch_lines`
- `tgd_post_dispatch_document(p_dispatch_document_id uuid, p_posted_by uuid default null)`

## Movement Behavior

Posting creates `PICK_CONFIRM` movements through `tgd_post_inventory_movement(input jsonb)`.

The movement engine handles reduction of `qty_on_hand` and `qty_allocated`.

## Relationship To Prior Outbound Work

Dispatch links to withdrawal requests, optional picking documents, picking lines, and allocation lines.

## Stock Safety Rule

The dispatch post function does not update `tgd_stock_balances` directly. It uses the movement engine for stock changes.

## Intentionally Not Created

- No invoice tables
- No delivery billing logic
- No outbound order tables
- No Sales Order / SO naming
- No full React UI
- No Express sync
- No legacy file changes

## Migration Application Notes

Apply previous migrations before `011_dispatch_goods_issue_foundation.sql`. This migration depends on withdrawal requests, withdrawal allocations, picking, master data, user profiles, movement posting, and audit logging.

## Next Sprint Recommendation

Phase 4 Sprint 4A Barcode Scan Service, or a targeted hardening sprint for outbound reversal and RLS policies.

