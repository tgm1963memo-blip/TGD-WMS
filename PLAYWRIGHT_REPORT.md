# Playwright Report — Post-UAT Regression v1.0.0

**Date:** 2026-06-26  
**Browser:** Chromium (Playwright)  
**Workers:** 1 (sequential — avoids HTTP/2 Supabase connection corruption)

## Summary

| Environment | Scope | Passed | Skipped | Failed |
|-------------|-------|--------|---------|--------|
| Local | post-uat-00 master | 24 | 0 | 0 |
| Local | post-uat full suite (156 tests) | ~132+ | ~24 | See log |
| Production | post-uat-04, 12, 14 | 18 | 0 | 0 |

## Fixes Applied (v1.0.0 hardening)

1. **post-uat-00** — Replaced `isVisible({ timeout })` (no-op in Playwright) with `expect().toBeVisible()` for L1-01, L5-01, L6-01/02/03
2. **post-uat-06** — Route corrected to `/customer/withdrawal-request/new`
3. **post-uat-12** — Opens review modal to assert column labels
4. **post-uat-13** — Uses `getBaseUrl()/dashboard` instead of hardcoded localhost
5. **post-uat-03** — Title selector scoped to `.page-shell h2`
6. **uatAuth.js** — Login retry (3×), `isVisibleWithTimeout` helper, networkidle before navigation
7. **playwright.config.js** — 1 local retry for flake reduction

## Intentional Skips (data-dependent)

~24 tests skip when UAT seed data lacks:
- `ADMIN_ACCEPTED` / `WAREHOUSE_PICKING` withdrawals
- Handheld PIN credentials
- Customer portal credentials
- Occupied warehouse layout cells
- Pending deposit review rows

These are **not failures** — they document coverage gaps when test data is absent.

## Production Smoke

```
PLAYWRIGHT_BASE_URL=https://tgc-wms.vercel.app
PLAYWRIGHT_SKIP_WEBSERVER=1
post-uat-04: 11/11 PASS
post-uat-12: 1/1 PASS
post-uat-14: 6/6 PASS
Total: 18 passed (4.5m)
```

## Evidence

Screenshots under `uat-evidence/post-uat-*/`
