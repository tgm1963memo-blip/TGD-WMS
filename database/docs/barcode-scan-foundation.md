# Barcode Scan Foundation

Sprint 4A adds the barcode foundation for handheld-ready warehouse workflows. It introduces barcode aliases, scan event auditing, and database functions that resolve and log scans without changing inventory.

## Supported entity types

Barcode aliases can point to products, locations, pallets, lots, inbound documents and lines, transfer documents and lines, adjustment documents and lines, withdrawal requests and lines, allocation records, picking documents and lines, dispatch documents and lines, users, or other future entities.

## Barcode alias model

`tgd_barcode_aliases` allows multiple barcode values to identify one warehouse entity. Each alias stores the barcode value, target entity type and id, barcode type, optional label, active flag, creator, and timestamps.

The alias table supports primary labels, supplier labels, customer labels, internal labels, handheld labels, and other operational labels. Inactive aliases are ignored by the resolver, but remain in the database for traceability.

## Scan event audit model

`tgd_barcode_scan_events` stores one audit row per logged scan. Each row records the raw scan value, resolved entity, context, result, source, device id, user identifiers, related document references, optional metadata, error message, and scan timestamp.

This model lets handheld and web workflows log scan attempts even when the barcode is unresolved, ambiguous, or invalid.

## Resolver behavior

`tgd_resolve_barcode(p_scan_value)` rejects empty values, then checks active aliases first. One alias match resolves to that alias target. Multiple alias matches return `AMBIGUOUS` with match details.

If no alias matches, the resolver searches the master barcode fields on `tgd_products`, `tgd_locations`, and `tgd_pallets`. One master match resolves to that entity. Multiple master matches return `AMBIGUOUS`. No matches return `UNRESOLVED`.

## Handheld readiness

`tgd_log_barcode_scan(input jsonb)` wraps resolver behavior and writes an auditable scan event. It accepts scan context, scan source, device id, user ids, related document references, and metadata so later handheld workflows can attach scans to receiving, putaway, picking, dispatch, and stock count processes.

## No stock updates in Sprint 4A

Sprint 4A only identifies and logs scanned entities. It does not update stock balances and does not post inventory movements. Stock-changing behavior belongs in workflow-specific sprints after scan intent, validation rules, and user interactions are defined.

## Intentionally not included

Sprint 4A does not add handheld UI pages, Express sync, receiving behavior, putaway behavior, picking behavior, dispatch behavior, stock updates, or inventory movement posting.

## Next sprint recommendation

Sprint 4B should implement the Handheld Receiving Workflow using this foundation for scan resolution and scan event auditing.
