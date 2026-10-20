# Known Limitations — TGD WMS v1.0.0 Go-Live

1. **Production HOLD banner** — Visible in UAT; final production authorization not yet granted.
2. **Legacy Vitest guardrails** — 97 tests fail due to outdated file-path assertions, not runtime bugs.
3. **Bundle size** — Single 1.56 MB JS chunk; no route-based code splitting yet.
4. **Lint gate** — ESLint intentionally deferred (Sprint 0B).
5. **npm audit** — 9 known vulnerabilities including 1 critical in dependency tree.
6. **Supabase CLI** — Windows host cannot spawn `supabase.exe`; use Dashboard for DDL.
7. **Data-dependent E2E** — Withdrawal picking flow tests skip without seeded `ADMIN_ACCEPTED` documents.
8. **Expiry demo data** — All 5 stock lots have no expiry date; NEAR_EXPIRY/EXPIRED UI paths untested with live data.
9. **Handheld PIN flow** — post-uat-05 not executed in this session.
10. **Transfer/Adjustment/Reservation** — Sidebar items removed or gated; not in current nav.
