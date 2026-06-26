# Changelog

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
