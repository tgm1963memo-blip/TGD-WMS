# Sprint 4C Implementation Notes

Sprint 4C implements the Handheld Putaway Workflow Foundation.

## Purpose

The sprint prepares TGD WMS for device-driven putaway by adding durable session and scan tables, validation functions, service wrappers, constants, tests, and documentation.

## Added Database Objects

- `tgd_handheld_putaway_sessions`
- `tgd_handheld_putaway_scans`
- `tgd_record_handheld_putaway_scan(input jsonb)`
- `tgd_complete_handheld_putaway_session(p_session_id uuid, p_completed_by uuid default null)`

## Barcode Foundation Relationship

Handheld putaway calls `tgd_log_barcode_scan()` for every scan. Scans are recorded with `PUTAWAY` context and `HANDHELD` source.

## Putaway Document Relationship

Sessions are linked to putaway documents and warehouses. Scan rows can link to putaway lines, which allows validation against product, lot, pallet, from-location, and to-location expectations.

## Validation Behavior

The record function marks scans as `VALID`, `WARNING`, or `INVALID` based on the barcode result and expected entity match. Session completion is blocked if any scan is invalid.

## Audit Behavior

Scan-level audit is stored in barcode scan events and handheld putaway scan rows. Session completion writes an audit log through `tgd_write_audit_log`.

## Why Stock Is Not Updated

Handheld putaway scans are operational evidence. Actual stock movement remains in the existing putaway posting workflow, so Sprint 4C avoids stock balance writes and inventory movement posting.

## Intentionally Not Included

Sprint 4C does not build handheld UI pages, modify existing putaway posting behavior, create Express sync, update stock balances, post inventory movements, implement picking, or alter legacy-reference files.

## Next Sprint Recommendation

Sprint 4D should implement the Handheld Picking Workflow.
