# Sprint 5A Implementation Notes

Sprint 5A starts the operational UI foundation for TGD WMS.

## UI Structure

`App.jsx` remains small and delegates routing to `src/app/routes.jsx`. Layout is split into `AppLayout`, `Sidebar`, and `Topbar`. Reusable UI primitives live under `src/components/ui`.

## Route Structure

The route tree includes dashboard, master data, operations, handheld, stock count, reports, and settings sections. Legacy smoke-test aliases remain routed to safe read-only or placeholder pages.

## Layout Approach

The shell uses a persistent topbar and sidebar with section navigation from `src/app/navigation.js`. Feature pages render inside the layout outlet.

## Master Data Scope

Customers, products, warehouses, and locations are read-only list foundations. They call `masterDataService` read functions only.

## Why Transaction Posting Is Not Included

Sprint 5A intentionally excludes posting buttons, workflow actions, stock updates, movement posting, handheld scan UI, report queries, and create/update/delete master data actions. Operational business behavior remains in the service and database layers until later UI sprints define safe workflows.

## Next Sprint Recommendation

Sprint 5B should add read-only operational document list pages for receiving, putaway, transfer, adjustment, withdrawal, allocation, picking, dispatch, and stock count.
