# Sprint 4B Implementation Notes

Sprint 4B implements the Handheld Receiving Workflow Foundation.

## Purpose

The sprint prepares TGD WMS for device-driven receiving by adding durable session and scan tables, validation functions, service wrappers, constants, tests, and documentation.

## Added Database Objects

- `tgd_handheld_receiving_sessions`
- `tgd_handheld_receiving_scans`
- `tgd_record_handheld_receiving_scan(input jsonb)`
- `tgd_complete_handheld_receiving_session(p_session_id uuid, p_completed_by uuid default null)`

## Barcode Foundation Relationship

Handheld receiving does not resolve barcode values itself. It calls `tgd_log_barcode_scan()` so every receiving scan is recorded in the barcode scan audit table with receiving context and handheld source.

## Receiving Document Relationship

Sessions are linked to receiving documents and warehouses. Scan rows can link to receiving lines, which allows product, lot, pallet, and location scans to be validated against line expectations when available.

## Validation Behavior

The record function marks scans as `VALID`, `WARNING`, or `INVALID` based on the barcode result and expected entity match. Session completion is blocked if any scan is invalid.

## Audit Behavior

Scan-level audit is stored in barcode scan events and handheld receiving scan rows. Session completion writes an audit log through `tgd_write_audit_log`.

## Why Stock Is Not Updated

Handheld receiving scans are operational evidence, not physical inventory posting. Actual stock increase remains in the existing receiving posting workflow, so Sprint 4B avoids stock balance writes and inventory movement posting.

## Intentionally Not Included

Sprint 4B does not build handheld UI pages, modify existing receiving posting behavior, create Express sync, update stock balances, post inventory movements, implement putaway, or alter legacy-reference files.

## Next Sprint Recommendation

Sprint 4C should implement the Handheld Putaway Workflow.
