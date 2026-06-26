# Database Audit — TGD WMS

**Date:** 2026-06-26  
**Database:** Supabase `lievvsqbosvrolkrftna`

## Integrity Checks

| Check | Result |
|-------|--------|
| Primary keys on core tables | ✅ |
| FK `tgd_stock_balances.lot_id → tgd_lots` | ✅ 0 orphans |
| Duplicate balance rows | ✅ 0 duplicates |
| Negative `qty_on_hand` | ✅ None |
| Stock balance row count | 5 |
| Lot row count | 5 |

## Expiry Classification (2026-06-26)

| Status | Count |
|--------|-------|
| NO_EXPIRY_DATE | 5 |
| EXPIRED | 0 |
| NEAR_EXPIRY | 0 |
| GOOD | 0 |

SQL-equivalent counts match JS business logic: **✅ MATCH**

## RPC Verification

- `tgd_review_customer_deposit_request` — COUNT_VARIANCE decision accepted ✅
- Stock balance derived from deposits minus withdrawals ✅

## Migrations

| File | Status |
|------|--------|
| `20260625162400_restore_count_variance_logic.sql` | Function verified in production; file committed for version control |

## Recommendations

1. Apply pending migration via Supabase Dashboard SQL editor if function signature differs from file.
2. Schedule periodic orphan-FK audit via `validate-db.js`.
3. Add expiry dates to demo lots for NEAR_EXPIRY/E2E coverage.
