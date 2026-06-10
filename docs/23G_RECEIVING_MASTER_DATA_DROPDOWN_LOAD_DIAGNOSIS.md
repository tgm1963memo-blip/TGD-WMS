# 23G: Receiving Master Data Dropdown Load Diagnosis

## 1. Confirmed Supabase Master Data Exists
- **Products**: `tgd_products` has columns `id`, `sku`, `name`, `unit`. Example: `FSHR-001 / Frozen Shrimp / kg`.
- **Warehouses**: `tgd_warehouses` has columns `id`, `code`, `name`. Example: `WH-COLD-01 / TGM Cold Storage Warehouse 01`.

## 2. Playwright Dropdown Evidence
Playwright UAT execution revealed that `/operations/receiving/create` is reachable and the `Customer` dropdown loads correctly. However, the `Warehouse` and `Product` dropdowns only showed their placeholders (`Select warehouse` and `Select product` respectively), meaning they were populated with an empty array.

## 3. Root Cause
The core issue was that the data loader mapping/filtering assumed certain columns (like `is_active` or explicit codes) existed and tried to aggressively filter them using an `isActiveRow` function. In addition, the query structures in services like `masterDataService.js` mistakenly attempted to order by `product_code`, `warehouse_code`, and `customer_code`, which caused Supabase queries to reject/fail when referenced elsewhere or through similar patterns. If any lookup failed, the component swallowed the precise error string without console visibility, silently defaulting to empty arrays for that state segment. 

## 4. Exact Frontend Fix
1. Removed `isActiveRow` and `.filter(isActiveRow)` from `receivingService.js` master lookups since the `is_active` column is unsupported.
2. Removed incorrect references to `product_code`, `warehouse_code`, `customer_code`, and `is_active` from `masterDataService.js`.
3. Validated that `receivingService.js` properly queries `.select('id, sku, name, unit')` and maps labels dynamically (`code` + `name`).
4. Injected `console.error` logs directly into `ReceivingCreatePage.jsx` when specific `customers.error`, `products.error`, `warehouses.error` instances trigger to explicitly report query issues instead of silent omission.

## 5. Retest Command
```bash
npm test -- --run tests/unit/receiving-master-data-dropdown-load-diagnosis.test.js
npm run build
npx playwright test "tests/e2e/transaction-uat-round-1.spec.js" --headed
```

## 6. Security & Rollout Status
> [!WARNING]
> **Production Context**
> - **Production remains HOLD.**
> - **FINAL GO is NOT AUTHORIZED.**
