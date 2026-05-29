# Sprint 12G TGM Brand UI Integration Validation

## Summary

Sprint 12G integrates TGM visual branding into the WMS shell, layout components, common notices, and selected safe pages.

## Files Added/Updated

- `src/config/brandConfig.js`
- `src/components/layout/AppShell.jsx`
- `src/components/layout/Sidebar.jsx`
- `src/components/layout/Topbar.jsx`
- `src/components/layout/PageHeader.jsx`
- `src/components/layout/SectionCard.jsx`
- `src/components/common/LanguageToggle.jsx`
- `src/components/common/UserRoleDemoSelector.jsx`
- `src/components/common/PermissionDeniedNotice.jsx`
- `src/components/common/AppErrorBoundary.jsx`
- `src/features/reports/ReportsPage.jsx`
- `src/features/admin/AuthReadinessPage.jsx`
- `src/features/admin/DocumentBrandingAdminPage.jsx`
- `src/features/admin/DocumentBrandingPreviewPage.jsx`
- `src/features/receiving/ReceivingPage.jsx`
- `src/features/transfer/TransferPage.jsx`
- `src/features/adjustment/AdjustmentPage.jsx`
- `src/features/picking/PickingPage.jsx`
- `src/i18n/translationCatalog.js`
- `src/styles.css`
- `docs/ui/tgm-brand-ui-integration.md`
- `tests/unit/tgm-brand-ui-integration.test.jsx`

## Logo Integration Status

The TGM logo is shown in the sidebar and topbar from `/brand/tgm-logo.png`.

## Brand Color Status

Black, gold, gold soft, red, red soft, white, and gray are centralized in `brandConfig` and mirrored as CSS variables.

## Layout Status

Sidebar uses a premium black treatment. Active menu items use gold. The topbar uses a dark gradient with visible language controls.

## Component Polish Status

Cards, page headers, language toggle, demo role selector, permission denial, and error boundary now use TGM visual tokens.

## Thai-First Status

Thai remains the default language and English remains available through the existing toggle.

## Test Result

Passed. `.\node_modules\.bin\vitest.cmd run` completed with 48 test files and 380 tests passing.

## Build Result

Passed. `.\node_modules\.bin\vite.cmd build` completed successfully with 226 modules transformed.

## Scope Check

No database schema, RLS policy, migration, service calculation, warehouse workflow, stock posting, allocation, picking, dispatch, ERP connector, invoice generation, accounting post, inventory sync, package, script, Supabase, or environment changes were made.

## Known Gaps

This sprint is visual integration only. Full dashboard metric redesign and legacy text cleanup remain future work.

## Final Status

Pending QA Validation
