# Test Report — TGD WMS Go-Live

**Date:** 2026-06-26

## Vitest

```
Total:   1938 tests
Passed:  1841 (95.0%)
Failed:  97 (5.0%)
Files:   259 (208 pass, 51 fail)
```

### Critical New Tests (100% pass)

- `tests/unit/storageAgingReportService.test.js` — 22 tests
- `src/utils/customerWithdrawalStatusLabels.test.js` — 6 tests

### Failure Root Causes

1. **Removed files** — Tests reference `ReceivingCreatePage.jsx` (deprecated)
2. **Route drift** — `App.test.jsx` uses legacy paths (`/customers`, `/products`)
3. **Navigation labels** — Sidebar restructured; guardrail tests not updated
4. **Permission catalog** — `routePermissionCatalog.js` evolved; billing/route tests stale

### Recommendation

Update or archive Sprint-era guardrail tests. Business-logic tests for go-live paths are green.

## Playwright

See PLAYWRIGHT_REPORT.md — core post-UAT paths green on local and production.

## Build

`npm run build` — ✅ Success (2.2s local, 7.5s Vercel)
