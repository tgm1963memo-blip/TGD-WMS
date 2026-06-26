# Post-Deployment Checklist

## Immediate (0–2 hours)

- [x] Verify production URL loads: https://tgc-wms.vercel.app
- [x] Admin login smoke test
- [x] Inventory balance page functional
- [ ] Customer admin login smoke test
- [ ] Handheld PIN login smoke test
- [ ] Monitor Supabase error logs

## Day 1

- [ ] Run full post-uat suite against production with fresh UAT data seed
- [ ] Update legacy Vitest guardrail tests
- [ ] Address npm audit critical vulnerability
- [ ] Confirm COUNT_VARIANCE migration matches SQL file in repo

## Week 1

- [ ] Remove UAT banners after business sign-off
- [ ] Enable production monitoring/alerting
- [ ] User training using `docs/user-manual/`
- [ ] Backup verification
