# Rollback Plan — TGD WMS

## Frontend (Vercel)

1. Open https://vercel.com/tgm1963memo-blips-projects/tgc-wms/deployments
2. Find last known-good deployment (e.g. `87jzkGoK3aWZZQFv8uQRSEGg9cXT` cache parent)
3. Click **⋯** → **Promote to Production**
4. Verify https://tgc-wms.vercel.app loads and login works

**CLI alternative:**
```bash
vercel rollback
```

## Database (Supabase)

1. Do NOT drop tables in production.
2. To revert RPC changes, re-apply previous function definition from `database/migrations/` history.
3. For `tgd_review_customer_deposit_request`, restore pre-COUNT_VARIANCE version from migration `076` if needed.

## Git

```bash
git revert <release-commit-hash>
git push origin main
```

## Verification After Rollback

- Login as admin
- `/inventory` shows balance data
- `/customer/stock-balance` loads
- No 500 errors in browser console
