# Stock Count Foundation

Sprint 4E adds stock count and cycle count foundation objects for TGD WMS. Stock count records observed inventory, compares it with expected balances, and prepares draft adjustment documents for controlled variance resolution.

## Count Document And Line Model

`tgd_stock_count_documents` stores count header data: warehouse, count type, lifecycle status, dates, completion, approval, cancellation, and audit fields.

`tgd_stock_count_lines` stores counted inventory identity: customer, product, lot, warehouse, location, pallet, expected quantity, counted quantity, variance, unit of measure, count status, barcode scan event, and optional adjustment line link.

## Expected, Counted, And Variance Quantities

`expected_qty` is the system quantity used for comparison. During completion, the function reads `tgd_stock_balances.qty_on_hand` where a matching stock balance exists and refreshes `expected_qty`.

`counted_qty` is the physical count result. `variance_qty` is calculated as `counted_qty - expected_qty`.

## Relationship To Stock Balance

Stock count reads stock balance data for comparison only. It does not update `tgd_stock_balances`.

## Relationship To Adjustment Documents

Variance resolution is prepared through `tgd_create_adjustment_from_stock_count()`, which creates a DRAFT `tgd_adjustment_documents` row and DRAFT adjustment lines. The generated adjustment remains unposted.

## Why Sprint 4E Does Not Update Stock Directly

Stock count is evidence capture and variance detection. Physical stock changes remain controlled by adjustment posting through the existing adjustment workflow.

## Why Adjustment Is Draft Only

Draft adjustment creation lets supervisors review variance lines before stock-impacting posting. Sprint 4E intentionally does not call `tgd_post_adjustment_document()`.

## Audit Behavior

Completing a stock count and creating an adjustment draft both write audit logs through `tgd_write_audit_log`.

## Barcode And Handheld Readiness

Stock count lines can link to `tgd_barcode_scan_events` through `scan_event_id`, allowing future handheld count workflows to attach scan audit history to count lines.

## Intentionally Not Included

Sprint 4E does not add handheld UI pages, Express sync, direct stock updates, direct movement posting, automatic adjustment posting, or legacy-reference changes.

## Next Sprint Recommendation

The next phase should be Phase 5 Operational UI Foundation.
