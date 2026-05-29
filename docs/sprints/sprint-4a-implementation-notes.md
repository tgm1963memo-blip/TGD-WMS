# Sprint 4A Implementation Notes

Sprint 4A implements the Barcode Scan Foundation for TGD WMS handheld readiness.

## Purpose

The foundation gives the system a common way to resolve barcode values and audit scan attempts before workflow-specific handheld screens are built.

## Added database objects

- `tgd_barcode_aliases` stores barcode values that map to warehouse entities.
- `tgd_barcode_scan_events` stores auditable scan attempts.
- `tgd_resolve_barcode(p_scan_value text)` resolves a raw scan to an alias or master barcode entity.
- `tgd_log_barcode_scan(input jsonb)` resolves and logs one scan event.

## Supported entity types

Aliases support `PRODUCT`, `LOCATION`, `PALLET`, `LOT`, receiving, putaway, transfer, adjustment, withdrawal, allocation, picking, dispatch, `USER`, and `OTHER` entity categories.

## Alias and audit behavior

Alias lookup is active-record only and takes precedence over master barcode fields. Scan events store raw values, resolved results, context, source, user/device references, related documents, metadata, and resolver errors.

## Resolver behavior

The resolver rejects empty scan values, searches active aliases, falls back to `tgd_products.barcode`, `tgd_locations.barcode`, and `tgd_pallets.barcode`, and returns `RESOLVED`, `UNRESOLVED`, or `AMBIGUOUS`.

## Handheld readiness

The service layer exposes resolver, scan logger, alias listing, scan event listing, alias creation, and alias deactivation functions. React pages do not use this service yet.

## Why stock is not updated

Barcode scans are observations until a workflow gives them operational meaning. Sprint 4A intentionally avoids stock balance updates and inventory movement posting so receiving, putaway, picking, dispatch, and stock count rules can remain explicit in later workflow sprints.

## Intentionally not included

Sprint 4A does not create handheld UI pages, does not create Express sync, does not modify workflow migrations, does not modify legacy-reference files, and does not add business logic to React pages.

## Next sprint recommendation

Sprint 4B should implement the Handheld Receiving Workflow using `tgd_resolve_barcode` and `tgd_log_barcode_scan` as the scan foundation.
