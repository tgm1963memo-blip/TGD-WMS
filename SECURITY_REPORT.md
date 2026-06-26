# Security Report — TGD WMS v1.0.0

**Date:** 2026-06-26  
**Status:** ✅ PASS (conditional — see npm audit)

## Authentication & Authorization

| Control | Status |
|---------|--------|
| Supabase Auth (JWT) | ✅ |
| Route permission guard | ✅ E2E verified |
| Role-based withdrawal review | ✅ |
| RLS on core tables | ✅ |
| Service role key not in client bundle | ✅ |

## Static Analysis

- `npm run lint` — 0 `console.log` / TODO / FIXME in production source
- `.env.local` gitignored
- `VITE_*` exposes anon key only (expected)

## npm audit

| Package | Severity | Scope | Decision |
|---------|----------|-------|----------|
| xlsx | High | Runtime export | Accepted — trusted internal data only; no patch available |
| esbuild/vite | Moderate | Dev server | Accepted — not shipped to production |
| vitest/vite-node | Moderate | Test runner | Accepted — dev only |

**6 vulnerabilities** after `npm audit fix` — documented in `KNOWN_ISSUES.md`

## Recommendations (post-v1.0.0)

1. Replace `xlsx` with `sheetjs-ce` or server-side export
2. Add CSP headers via Vercel
3. Enable Supabase auth rate limiting
