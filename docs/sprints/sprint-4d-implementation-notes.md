# Sprint 4D Implementation Notes

Sprint 4D implements the Handheld Picking Workflow Foundation.

## Purpose

The sprint prepares TGD WMS for device-driven picking by adding durable session and scan tables, validation functions, service wrappers, constants, tests, and documentation.

## Added Database Objects

- `tgd_handheld_picking_sessions`
- `tgd_handheld_picking_scans`
- `tgd_record_handheld_picking_scan(input jsonb)`
- `tgd_complete_handheld_picking_session(p_session_id uuid, p_completed_by uuid default null)`

## Barcode Foundation Relationship

Handheld picking calls `tgd_log_barcode_scan()` for every scan. Scans are recorded with `PICKING` context and `HANDHELD` source.

## Picking Document Relationship

Sessions are linked to picking documents, withdrawal requests, and warehouses. Scan rows can link to picking lines, withdrawal request lines, and allocation lines for traceability.

## Withdrawal Allocation Relationship

The foundation preserves allocation line references from the picking line when available. It does not allocate inventory and does not change existing allocation movement behavior.

## Validation Behavior

The record function marks scans as `VALID`, `WARNING`, or `INVALID` based on the barcode result and expected entity match. Session completion is blocked if any scan is invalid.

## Audit Behavior

Scan-level audit is stored in barcode scan events and handheld picking scan rows. Session completion writes an audit log through `tgd_write_audit_log`.

## Why Stock Is Not Updated

Handheld picking scans are operational evidence. Sprint 4D does not issue stock, update stock balances, post inventory movements, confirm picking documents, or dispatch goods.

## Why PICK_CONFIRM Is Not Used

`PICK_CONFIRM` represents outbound goods issue movement behavior. Handheld picking capture must stay separate from stock issue and dispatch posting.

## Intentionally Not Included

Sprint 4D does not build handheld UI pages, modify existing picking confirmation behavior, create Express sync, update stock balances, post inventory movements, dispatch goods, or alter legacy-reference files.

## Next Sprint Recommendation

Sprint 4E should implement the Stock Count / Cycle Count Foundation.
