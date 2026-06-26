# Changelog

## [1.0.1] — 2026-06-26

### Fixed
- **Dashboard ยอดคงเหลือ**: count query now filters `qty_on_hand > 0` so zero-balance rows are excluded
- **Warehouse map auto-update**: added Supabase realtime subscription on `tgd_stock_balances` so the map refreshes automatically on any stock change
- **Dashboard KPI auto-update**: added Supabase realtime subscription so all KPI counters refresh automatically when stock changes

## [1.0.0] — 2026-06-26 (final hardening)

### Fixed
- Playwright post-uat-00: `expect().toBeVisible()` instead of non-waiting `isVisible({ timeout })`
- Playwright post-uat-05: handheld staff list waits for RPC + clears localStorage session
- `uatAuth.js`: `isVisibleWithTimeout` helper; playwright.config local retry

### Documentation
- Updated TEST_REPORT, PLAYWRIGHT_REPORT, PRODUCTION_CERTIFICATION, RELEASE_NOTES, GO_LIVE_REPORT, SECURITY_REPORT

## [1.0.0] — 2026-06-26

### Added
- Production lint gate (`scripts/lint-check.mjs`)
- `PRODUCTION_CERTIFICATION.md`, `KNOWN_ISSUES.md`
- `systemRouteExpectations` export for E2E route fixtures

### Fixed
- **1932/1932 Vitest tests passing** — legacy guardrail tests updated for current architecture
- Removed debug `console.log` from auth, profile, and billing services
- Playwright `systemRoutes.js` fixture export for pre-user UAT
- Package version bumped to 1.0.0

### Security
- npm audit fix applied (react-router); residual xlsx/esbuild documented

## [1.0.0-go-live] — 2026-06-26

### Added
- Post-UAT Playwright regression suite (`post-uat-00` through `post-uat-14`)
- `storageAgingReportService` unit tests (22 cases)
- `customerWithdrawalStatusLabels` unit tests (6 cases)
- Database validation scripts (`validate-db.js`, `sql-validation-phase6.mjs`)
- Go-live documentation pack

### Fixed
- Storage Aging Report infinite loading when filter options load after data fetch
- Customer portal live banner mock missing `getAdminPortalCustomerId` export
- Withdrawal status label display and line picking status derivation
- Role permission cache staleness on profile updates

### Deployed
- Vercel production: https://tgc-wms.vercel.app (deployment `dpl_Gfi2HLEnCSsYH6uPzVMEey9LUCEm`)

### Known Issues
- 97 legacy Vitest guardrail tests require update (see TEST_REPORT.md)
