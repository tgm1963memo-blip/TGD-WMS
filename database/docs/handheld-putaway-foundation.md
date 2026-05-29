# Handheld Putaway Foundation

Sprint 4C adds the handheld putaway foundation for TGD WMS. It records putaway device sessions and scan evidence without changing stock or posting movements.

## Relationship to Barcode Foundation

Every handheld putaway scan is logged through `tgd_log_barcode_scan()` with `scan_context = PUTAWAY` and `scan_source = HANDHELD`. Barcode resolution and raw scan auditing stay centralized in the Sprint 4A barcode foundation.

## Relationship to Putaway Documents

Handheld putaway sessions attach to `tgd_putaway_documents`. Scan rows can attach to `tgd_putaway_lines`, allowing product, lot, pallet, source location, and destination location scans to be validated against planned putaway line expectations.

## Scan Session Model

`tgd_handheld_putaway_sessions` tracks the putaway document, warehouse, device, operator, lifecycle status, start time, completion, cancellation, and remarks.

`tgd_handheld_putaway_scans` stores each scan step, raw barcode, barcode scan event, resolved entity, validation status, expected entity, optional quantity, device, operator, metadata, and timestamp.

## Scan Validation Behavior

`tgd_record_handheld_putaway_scan(input jsonb)` rejects closed sessions, verifies that the putaway document belongs to the session, records the barcode audit event, and inserts a handheld putaway scan row.

Validation is `VALID` when the resolved entity matches the expected entity, or when no expected entity is supplied and the barcode resolves. Unresolved scans are `WARNING`. Mismatched, ambiguous, or errored scans are `INVALID`.

## Audit Behavior

Each scan is auditable through barcode scan events and handheld putaway scan rows. Completing a handheld putaway session writes an audit log with session, putaway document, and scan count.

## No Stock Updates in Sprint 4C

Sprint 4C does not update stock balances and does not post inventory movements. Actual physical movement remains controlled by `tgd_post_putaway_document()`.

## Intentionally Not Included

Sprint 4C does not add handheld UI pages, Express sync, putaway posting changes, stock updates, direct movement posting, picking, dispatch, or legacy-reference changes.

## Next Sprint Recommendation

Sprint 4D should implement the Handheld Picking Workflow using the barcode and handheld workflow foundations.
