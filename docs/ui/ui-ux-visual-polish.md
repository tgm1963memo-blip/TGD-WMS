# Sprint 12D UI/UX Visual Polish

## Purpose

Sprint 12D improves the visual foundation of TGD WMS so the application feels cleaner, more modern, and easier to use for warehouse, accounting, and admin/controller users.

## Scope

The sprint updates safe frontend layout and shared UI components only. It does not change warehouse workflow logic, service calculations, database schema, RLS policies, accounting posting, invoice generation, ERP connector behavior, or inventory sync behavior.

## Design Direction

- Thai-first enterprise WMS interface
- Clean dashboard-style layout
- Clear module grouping for warehouse users and accounting users
- Restrained colors, readable cards, clear buttons, and warning panels
- Desktop and tablet-friendly spacing with touch-friendly controls

## Layout Components Added/Updated

- `AppShell` provides the consistent application shell around topbar, sidebar, and routed content.
- `Sidebar` groups navigation into Dashboard, Warehouse Operations, Reports, and Administration.
- `Topbar` shows the current area, app name, and global language toggle.
- `PageHeader` provides consistent page title, description, and action placement.
- `SectionCard` provides reusable card styling for report and admin sections.

## Pages Updated

- Reports page uses the modern page header and section card layout for report cards.
- Auth readiness page uses the modern page header and card sections.
- Document branding admin and preview pages use the modern page header and card sections for previews.

## Responsive Considerations

The layout keeps the existing responsive shell behavior and avoids adding a new UI framework. Cards use wrapping grid layouts, buttons use larger touch targets, and the sidebar remains grouped for easier scanning.

## Thai-First UI Consideration

Thai remains the default language. The language toggle remains visible in the topbar and still allows switching to English. New navigation and visual polish keys were added with Thai and English values.

## Known Remaining UI Gaps

- Some deeper operation pages still use older page-level layouts and hardcoded English labels.
- Some table components need a future dedicated polish pass for sticky headers, density controls, and better mobile overflow behavior.
- The document branding form still has preview-only behavior and no persistence or upload action by design.

## Future UI Backlog

- Apply `PageHeader` and `SectionCard` consistently to all operation list/detail/create pages.
- Standardize table styling across all data tables.
- Add responsive table wrappers for handheld/tablet review.
- Review all Thai labels with warehouse and accounting users during UAT.
- Add density and accessibility review after controlled rollout feedback.
