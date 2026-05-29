# Sprint 12C Thai Language Activation Audit

## Purpose

This audit records the Sprint 12C changes that activate Thai-first UI behavior for TGD WMS and make the language switch visible for users.

## Scope

The scope is limited to the existing frontend i18n foundation, shared language toggle, reports page text, audit documentation, and unit coverage. No database schema, RLS policy, integration, accounting, inventory sync, or warehouse workflow behavior is changed.

## Thai Default Language Decision

Thai is the default application language. English remains available as the secondary language. The current implementation uses in-memory language state through `LanguageProvider`; it does not use browser persistence.

## Language Toggle Placement

`LanguageToggle` is rendered globally from `src/app/App.jsx` inside `LanguageProvider`, so it is visible across major pages. `ReportsPage` also retains its page-level language toggle for the existing report navigation validation flow.

The toggle shows:

- Current language
- ไทย
- English

## Pages Updated

- `src/app/App.jsx` delegates the language wrapper to keep the app root small.
- `src/components/common/AppLanguageShell.jsx` wraps the app in `LanguageProvider` and renders the global language toggle.
- `src/components/common/LanguageToggle.jsx` uses the language context and switches between Thai and English.
- `src/features/reports/ReportsPage.jsx` uses translation keys for the page title, report action, and report card descriptions.

## Translation Keys Added

Sprint 12C added Thai/English keys for core navigation, operations, reports, common buttons, table labels, status labels, document branding, auth readiness, and report descriptions.

Key groups include:

- App shell and navigation: dashboard, reports, admin, warehouse, master data
- Warehouse operations: receiving, putaway, transfer, adjustment, stock count, customer withdrawal, allocation, picking, dispatch / goods issue
- Reports: inventory dashboard, movement ledger, customer storage balance, storage aging, monthly storage billing summary, accounting charge review
- Common UI: search, filter, reset, clear, view, edit, delete, back, next, previous, loading, no data, status, date, action, warning, error, success
- Preview/config: preview only, not saved to database, document branding, auth readiness

## Known Hardcoded Text Remaining

Some hardcoded English text remains outside this safe Sprint 12C pass:

- The main sidebar/topbar navigation definitions still contain English labels in existing app shell files that were outside the requested edit priority.
- Many operation list/detail/create pages still contain English field labels and empty state text.
- Some admin and document branding form labels remain partially hardcoded pending a dedicated i18n cleanup sprint.

These remaining items do not block the Thai default language activation, but they should be handled in a future full i18n cleanup pass.

## Future I18n Cleanup Backlog

- Move sidebar and topbar navigation labels fully to translation keys.
- Replace remaining hardcoded page titles, form labels, table headings, empty states, and warning messages in operational pages.
- Add Thai/English review for all admin and security readiness pages.
- Add copy review with warehouse, accounting, and admin/controller users during UAT.
