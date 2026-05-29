# Handheld Picking Foundation

Sprint 4D adds the handheld picking foundation for TGD WMS. It records picking device sessions and scan evidence without issuing stock or posting movements.

## Relationship to Barcode Foundation

Every handheld picking scan is logged through `tgd_log_barcode_scan()` with `scan_context = PICKING` and `scan_source = HANDHELD`. Barcode resolution and raw scan auditing stay centralized in the Sprint 4A barcode foundation.

## Relationship to Picking Documents

Handheld picking sessions attach to `tgd_picking_documents` and their linked withdrawal requests. Scan rows can attach to `tgd_picking_lines`, allowing product, lot, pallet, and location scans to be validated against picking line expectations.

## Relationship to Withdrawal Allocation

Picking lines may reference withdrawal allocation lines created by the allocation workflow. Handheld picking stores `allocation_line_id` for traceability, but it does not allocate, release, issue, or post inventory.

## Scan Session Model

`tgd_handheld_picking_sessions` tracks the picking document, withdrawal request, warehouse, device, operator, lifecycle status, completion, cancellation, and remarks.

`tgd_handheld_picking_scans` stores each scan step, raw barcode, barcode scan event, resolved entity, validation status, expected entity, related picking/allocation/request references, optional quantity, device, operator, metadata, and timestamp.

## Scan Validation Behavior

`tgd_record_handheld_picking_scan(input jsonb)` rejects closed sessions, verifies document and request references, records the barcode audit event, and inserts a handheld picking scan row.

Validation is `VALID` when the resolved entity matches the expected entity, or when no expected entity is supplied and the barcode resolves. Unresolved scans are `WARNING`. Mismatched, ambiguous, or errored scans are `INVALID`.

## Audit Behavior

Each scan is auditable through barcode scan events and handheld picking scan rows. Completing a handheld picking session writes an audit log with session, picking document, withdrawal request, and scan count.

## No Stock Updates in Sprint 4D

Sprint 4D does not update stock balances and does not post inventory movements. It records picking scan evidence only.

## Why PICK_CONFIRM Is Not Used Here

`PICK_CONFIRM` belongs to downstream goods issue behavior, not handheld scan capture. Handheld picking does not issue stock, confirm dispatch, or post outbound movements.

## Intentionally Not Included

Sprint 4D does not add handheld UI pages, Express sync, picking confirmation changes, dispatch posting, stock updates, direct movement posting, or legacy-reference changes.

## Next Sprint Recommendation

Sprint 4E should implement the Stock Count / Cycle Count Foundation.
