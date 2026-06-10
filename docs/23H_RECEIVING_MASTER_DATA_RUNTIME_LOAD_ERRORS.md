# 23H: Receiving Master Data Runtime Load Errors

## 1. Playwright Evidence & Context
Playwright UAT execution against `https://tgd-wms.vercel.app` revealed that despite `ebe33b1` fixing the local build dropdown loaders:
- `Customer` loaded (`Demo Customer Alpha`).
- `Warehouse` remained `Select warehouse`.
- `Product` remained `Select product`.
The missing selector failure triggered the test termination safely.

## 2. Vercel Deployment Check Requirement
The most likely cause is that the Vercel production deployment has not yet built and deployed commit `ebe33b1`, meaning it's still running the older version with `.filter(isActiveRow)` or `order('product_code')`. 
Alternatively, if the commit *is* deployed, the database tables may have row-level security (RLS) silently blocking the read, or the `id, sku, name, unit` / `id, code, name` query still conflicts with a mismatched Supabase schema.

## 3. Safe Runtime Diagnostics Added
To explicitly surface *why* the arrays are empty, the following diagnostics were deployed to `ReceivingCreatePage`:
- **UAT Master Data Diagnostics Panel**: Only renders if `productsError` or `warehousesError` occurs.
- Displays:
  - Products loaded count
  - Warehouses loaded count
  - Explicit error string from Supabase (e.g., `PostgrestError`, `missing column`, `JWT`, `RLS policy`).
- **No Sensitive Expsoure**: Supabase keys and user tokens are kept secure. Only `error.message` is rendered.
- **Console Warnings**: Appended `console.error("Receiving products load failed", error.message)` to allow Playwright scraping.

## 4. Playwright Capture Updates
Added a `page.on('console')` listener in `tests/e2e/transaction-uat-round-1.spec.js` that listens specifically for "Receiving products load failed" or "Receiving warehouses load failed" and injects them directly into `22N_result.json` as `runtimeDiagnostics`.

## 5. Security & Rollout Status
> [!WARNING]
> **Production Context**
> - **Production remains HOLD.**
> - **FINAL GO is NOT AUTHORIZED.**
