# Release Notes — TGD WMS v1.0.0

**Release Date:** 2026-06-26  
**Production URL:** https://tgc-wms.vercel.app

## Overview

Production Grade v1.0.0 final release for TGD Cold Storage Warehouse Management System. This release hardens the go-live deployment with full test coverage, lint gates, and documented security/performance posture.

## Highlights

- **1932/1932 Vitest tests** passing
- **Production smoke** 18/18 on Vercel
- **Post-UAT Playwright** regression suite (15 specs, 156 tests)
- **Database integrity** validated — 0 orphans, 0 duplicates
- **Lint gate** — zero `console.log`, `TODO`, `FIXME` in `src/`

## Critical Fixes

- Storage Aging Report loading race (filter options vs data fetch)
- Withdrawal review role guard and status labels
- Legacy guardrail tests aligned to current routes and navigation
- Playwright flake fixes (`expect().toBeVisible`, handheld staff list wait)

## Known Limitations

See `KNOWN_ISSUES.md` — npm audit residuals (xlsx, esbuild dev), bundle size >500KB, data-dependent E2E skips.

## Upgrade Notes

No database migration required beyond already-applied `20260625162400_restore_count_variance_logic.sql`.

## Rollback

See `ROLLBACK_PLAN.md` — promote previous Vercel deployment.
