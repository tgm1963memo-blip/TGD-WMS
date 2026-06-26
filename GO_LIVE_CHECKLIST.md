# Go-Live Checklist

- [x] Production build succeeds
- [x] Database integrity validated (0 orphans, 0 duplicates, 0 negative stock)
- [x] SQL validation gate green
- [x] Storage aging report E2E (5/6)
- [x] Admin inventory balance E2E (11/11 local + production)
- [x] Stock balance reconciliation E2E (7/8)
- [x] Withdrawal review role guard E2E
- [x] Vercel production deploy
- [x] Production smoke test (11/11)
- [x] Go-live documentation generated
- [x] Git commit and push
- [ ] Full Vitest suite 100% (97 legacy failures remain)
- [ ] Full post-uat-00 master orchestrator green
- [ ] npm audit critical resolved
- [ ] Remove Production HOLD banner (business authorization)
- [ ] Supabase migration CLI apply (use Dashboard workaround)
