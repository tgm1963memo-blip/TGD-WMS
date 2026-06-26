# TGD WMS — Production Certification v1.0.0

**Certification Date:** 2026-06-26  
**System Version:** 1.0.0  
**Certification Authority:** Automated Release Pipeline

---

## Certification Summary

| Domain | Status | Evidence |
|--------|--------|----------|
| Build | ✅ PASS | `npm run build` — 329 modules, 0 errors |
| Lint | ✅ PASS | `npm run lint` — 368 files scanned, 0 violations |
| Vitest | ✅ PASS | 259 files, 1932 tests, 100% |
| Database Integrity | ✅ PASS | `validate-db.js` — 0 orphans, 0 duplicates |
| SQL Validation | ✅ PASS | `sql-validation-phase6.mjs` — MATCH |
| Production Smoke | ✅ PASS | post-uat-04 on https://tgc-wms.vercel.app |
| Security (static) | ✅ PASS | No console.log/TODO in src; RLS via Supabase |
| npm audit | ⚠️ CONDITIONAL | 6 vulns — see KNOWN_ISSUES.md |

---

## Release Identity

| Field | Value |
|-------|-------|
| **Git Commit** | `9af962f23b73238b881e517d9401b47d5ac06346` |
| **Release Tag** | `v1.0.0` |
| **Production URL** | https://tgc-wms.vercel.app |
| **Supabase Project** | lievvsqbosvrolkrftna |
| **Package Version** | 1.0.0 |

---

## Database Version

| Migration | Description |
|-----------|-------------|
| `20260625162400_restore_count_variance_logic.sql` | COUNT_VARIANCE deposit review |
| Prior migrations | Applied via Supabase (076–080 series in database/) |

**Integrity:** 5 stock balances, 5 lots, 0 orphan FKs, 0 negative qty

---

## Test Evidence

### Vitest
```
Test Files:  259 passed (259)
Tests:       1932 passed (1932)
```

### Playwright (Post-UAT Suite)
Core regression validated:
- Admin inventory balance (11/11)
- Stock balance reconciliation
- Storage aging report
- Withdrawal picking flow (data-dependent skips documented)

### Production Validation
```
PLAYWRIGHT_BASE_URL=https://tgc-wms.vercel.app
post-uat-04: 11/11 PASS
```

---

## Security Status

- JWT auth via Supabase ✅
- Route permission guard ✅
- Role-based withdrawal review ✅
- Service role key not in client bundle ✅
- Debug logging removed from production source ✅

**Residual:** xlsx high severity (no upstream fix); esbuild dev-server advisory (dev-only)

---

## Performance Status

| Metric | Value |
|--------|-------|
| Main bundle | 1.56 MB (gzip 433 KB) |
| CSS | 44 KB |
| Build time | ~2.2s local |

Recommendation: route-based code splitting (post-v1.0.0)

---

## Known Risks

1. npm audit: xlsx prototype pollution — mitigated by trusted upload paths only
2. UAT Production HOLD banner still visible (business policy)
3. Some Playwright flows skip when UAT seed data absent

---

## Rollback Procedure

See `ROLLBACK_PLAN.md` — Vercel promote previous deployment + revert git tag if needed.

---

## GO Decision

### **CERTIFIED FOR PRODUCTION v1.0.0**

All mandatory technical gates pass. Residual npm audit items documented with justification in `KNOWN_ISSUES.md`.

---

*Signed: TGD WMS Release Pipeline — 2026-06-26*
