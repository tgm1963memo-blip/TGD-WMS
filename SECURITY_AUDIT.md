# Security Audit Summary — TGD WMS Go-Live

**Date:** 2026-06-26

## Authentication & Authorization

| Control | Status |
|---------|--------|
| Supabase Auth (JWT) | ✅ Active |
| Route permission guard | ✅ Verified in E2E |
| Role-based withdrawal review | ✅ warehouse_staff blocked from ACCEPT/REJECT |
| RLS on core tables | ✅ Enforced via Supabase |
| Service role key in `.env.local` only | ✅ Not in client bundle |

## Input Validation

- RPC functions use `security definer` with role checks
- Withdrawal/deposit decisions validated server-side

## Secret Exposure

- `.env.local` gitignored ✅
- `VITE_*` keys are anon key only (expected public)
- Service role key present in validation scripts — **do not commit**

## npm audit

9 vulnerabilities (1 critical) — **remediation required post-go-live**

## Recommendations

1. Rotate service role key if ever exposed in logs
2. Enable Supabase rate limiting for auth endpoints
3. Add CSP headers via Vercel configuration
4. Resolve critical npm dependency vulnerability
