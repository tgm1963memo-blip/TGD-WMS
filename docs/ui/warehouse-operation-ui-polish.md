# Sprint 12E Warehouse Operation UI Polish

## Purpose

Sprint 12E improves warehouse operation page readability and Thai-first usability for TGD WMS. The focus is UI consistency for receiving, putaway, transfer, adjustment, stock count, customer withdrawal, allocation, picking, and dispatch / goods issue foundations.

## Scope

This sprint is limited to frontend visual polish and Thai text cleanup. It does not change warehouse workflow logic, service calculations, stock posting behavior, allocation logic, dispatch logic, database schema, RLS policies, SQL, ERP integration, invoice generation, accounting posting, inventory sync, or persistence behavior.

## Operation Pages Reviewed

The repository contains operation pages primarily under:

- `src/features/operations/*`
- `src/features/operations/receiving/*`
- `src/features/operations/putaway/*`
- `src/features/operations/transfer/*`
- `src/features/operations/adjustment/*`
- `src/features/operations/withdrawal/*`
- `src/features/operations/allocation/*`
- `src/features/operations/picking/*`
- `src/features/operations/dispatch/*`
- `src/features/stock-count/*`

The repository also contains lightweight legacy/foundation pages under:

- `src/features/receiving/*`
- `src/features/transfer/*`
- `src/features/adjustment/*`
- `src/features/picking/*`

## Pages Updated

The safest high-impact updates were applied through reusable operation components used across operation pages:

- `DocumentToolbar`
- `DocumentFilterBar`
- `DocumentLineTable`
- `DocumentSection`
- `DocumentStatusCard`
- `DraftLineEditor`
- `QuantitySummaryCard`
- `ReadOnlyField`

The lightweight receiving, transfer, adjustment, and picking foundation pages were also updated to use `PageHeader` and `SectionCard`.

## Thai-First Cleanup Performed

Added Thai/English operation translation keys for operation names, statuses, quantities, locations, scan labels, document references, owner fields, empty states, and operation notes.

Updated shared operation components to show Thai-first labels for:

- Search/filter fields
- Draft creation action
- Refresh action
- Draft line editor fields
- Empty line table message
- Document lines section

## Responsive / Handheld Considerations

- Operation filter fields use a wrapping grid.
- Draft line entry fields wrap into smaller columns.
- Toolbar actions wrap and use larger touch targets.
- Cards have clearer spacing and borders.
- Tables are wrapped with horizontal overflow where the shared line table is used.

## Business Logic Preservation

No service calls, RPC names, movement types, stock posting logic, allocation logic, dispatch logic, validation calculations, role rules, or route paths were changed.

## Known Remaining Hardcoded Labels

- Many operation list/detail/create pages still define table column labels directly in page files.
- Some empty messages from shared `DataTable` usage remain English where passed directly by pages.
- Full Thai cleanup of every operation page should be handled in a future deeper page-by-page i18n sprint.

## Future UI Backlog

- Convert all operation page table columns to translation keys.
- Wrap all operation list/detail/create pages with modern `PageHeader` and `SectionCard` where safe.
- Add responsive table containers to all list pages.
- Add consistent status badge language mapping.
- Review all Thai labels with warehouse users during UAT.
