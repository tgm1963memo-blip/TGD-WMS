# Handheld Receiving Foundation

Sprint 4B adds the handheld receiving foundation for TGD WMS. It creates session and scan records that let handheld devices capture receiving scans while preserving barcode audit history.

## Relationship to Barcode Foundation

Every handheld receiving scan is logged through `tgd_log_barcode_scan()` with `scan_context = RECEIVING` and `scan_source = HANDHELD`. The barcode foundation remains the single resolver and audit trail for raw scan values.

## Relationship to Receiving Documents

Handheld receiving sessions attach to `tgd_receiving_documents`. Individual scan rows can attach to `tgd_receiving_lines` when the scan belongs to a known line. The workflow validates scanned entities against expected products, lots, pallets, or locations when those expectations are available.

## Scan Session Model

`tgd_handheld_receiving_sessions` tracks the device-ready receiving session, including document, warehouse, operator, device, status, start time, completion, cancellation, and remarks.

`tgd_handheld_receiving_scans` stores each scan step, raw value, barcode scan event, resolved entity, validation status, expected entity, optional quantity, operator, device, metadata, and timestamp.

## Scan Validation Behavior

`tgd_record_handheld_receiving_scan(input jsonb)` rejects closed sessions, confirms the receiving document belongs to the session, records the barcode audit event, and inserts a handheld scan row.

Validation returns `VALID` when the resolved entity matches the expected entity, or when no expected entity is provided and the barcode resolves. It returns `WARNING` for unresolved scans and `INVALID` for mismatched, ambiguous, or error scans.

## Audit Behavior

Each scan is auditable through `tgd_barcode_scan_events` and `tgd_handheld_receiving_scans`. Completing a handheld receiving session writes an audit log with the session, receiving document, and scan count.

## No Stock Updates in Sprint 4B

Sprint 4B does not update stock and does not create inventory movements. Physical stock increases continue to be controlled by the existing receiving posting flow. Handheld receiving only records and validates scan evidence.

## Intentionally Not Included

Sprint 4B does not add handheld UI pages, Express sync, receiving posting changes, putaway logic, stock updates, or direct inventory movement posting.

## Next Sprint Recommendation

Sprint 4C should implement the Handheld Putaway Workflow using the barcode and handheld receiving foundations.
