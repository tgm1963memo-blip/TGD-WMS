# Performance Report — TGD WMS Go-Live

**Date:** 2026-06-26

## Build Metrics

| Metric | Value |
|--------|-------|
| Modules transformed | 329 |
| Local build time | 2.2s |
| Vercel build time | 7.5s |
| Main JS bundle | 1,561 KB (gzip 435 KB) |
| CSS bundle | 44 KB (gzip 9 KB) |

## Runtime Observations

| Page | Load (E2E) | Notes |
|------|------------|-------|
| /inventory | ~12–18s | Includes login + permission queries |
| /reports/storage-aging | ~22–37s | 2 Supabase queries + location lookup |

## Database

- Stock balance query uses indexed `tgd_stock_balances` with lot join
- No N+1 detected in storage aging service (batch location lookup)
- 5 balance rows — performance not representative at scale

## Recommendations

1. **Code splitting** — `manualChunks` for reports vs operations vs customer portal
2. **Permission cache** — Already implemented; monitor TTL
3. **Indexes** — Verify indexes on `customer_id`, `lot_id`, `location_id` at production scale
4. **Lazy routes** — Convert heavy report pages to `React.lazy()`
