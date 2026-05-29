# Sprint 4E Implementation Notes

Sprint 4E implements the Stock Count / Cycle Count Foundation.

## Purpose

The sprint adds stock count documents, stock count lines, variance calculation, draft adjustment generation, service wrappers, constants, tests, and documentation.

## Added Database Objects

- `tgd_stock_count_documents`
- `tgd_stock_count_lines`
- `tgd_complete_stock_count_document(p_stock_count_document_id uuid, p_completed_by uuid default null)`
- `tgd_create_adjustment_from_stock_count(p_stock_count_document_id uuid, p_created_by uuid default null)`

## Quantity Model

`expected_qty` is the system quantity used for comparison. `counted_qty` is the physical result. `variance_qty` is calculated as `counted_qty - expected_qty`.

## Stock Balance Relationship

Completion refreshes `expected_qty` from matching `tgd_stock_balances.qty_on_hand` where possible. It does not update stock balances.

## Adjustment Relationship

Variance lines can be converted into a DRAFT adjustment document. Positive variances become `IN` adjustment lines. Negative variances become `OUT` adjustment lines. The function links stock count lines to generated adjustment lines where possible.

## Audit Behavior

Completing the stock count and creating the draft adjustment both write audit logs.

## Why Stock Is Not Updated

Stock count is counting and variance detection only. Stock changes remain controlled by the existing adjustment posting workflow.

## Why Adjustment Is Draft Only

Draft adjustment output keeps review and approval separate from stock-changing posting. Sprint 4E does not post adjustment documents.

## Barcode And Handheld Readiness

Stock count lines include `scan_event_id` so future handheld stock count workflows can attach barcode scan events to physical count lines.

## Intentionally Not Included

Sprint 4E does not build UI pages, create Express sync, update stock balances directly, post inventory movements, post adjustment documents, or alter legacy-reference files.

## Next Sprint Recommendation

Phase 5 should implement the Operational UI Foundation.
