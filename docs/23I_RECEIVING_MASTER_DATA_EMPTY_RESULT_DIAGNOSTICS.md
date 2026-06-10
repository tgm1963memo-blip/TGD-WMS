# 23I: Receiving Master Data Empty Result Diagnostics

## 1. Context & Motivation
Following the implementation in `d220f61`, Playwright UAT evidence confirmed that while the UI correctly loaded the customer dropdown, the product and warehouse dropdowns remained functionally empty (default placeholder only). Crucially, the captured `runtimeDiagnostics` were empty `[]`, meaning the loader did not crash and no explicit Postgrest errors were swallowed.

## 2. Hypothesis
Since there are no frontend crashes, the loaders are either:
A. Not returning data because they are completely blocked by RLS policies that evaluate safely to `0 rows`.
B. Passing `0 rows` due to an undiscovered secondary database table constraint.
C. Mismatched deployment: The Vercel app is not aligned with `d220f61` and continues to use older filters.

## 3. Implemented Diagnostic Tracking (23I)
To pinpoint where the data vanishes, we integrated the following metrics:
- Added explicit `console.info` statements measuring exactly when the service calls are initiated.
- Modified `receivingService.js` to return `rawCount` (length of array returned directly from `supabase.from().select()`) and `filteredCount` (length post frontend manipulation).
- Intercepted all `Receiving products...` and `Receiving warehouses...` console events inside the Playwright execution script to definitively scrape the true payload sizes.
- Added a permanent `Diagnostic version: 23I` UI panel inside `ReceivingCreatePage.jsx` that explicitly prints the counts and `called` status. Playwright now scrapes this HTML directly into `22N_result.json` as `pageDiagnostics`.

## 4. Playwright Execution Result Updates
The `transaction-uat-round-1.spec.js` will now automatically yield:
- `runtimeDiagnostics`: Console outputs confirming the exact sizes returned by the database.
- `pageDiagnostics`: HTML text from `#diagnostic-23i` containing frontend mapped quantities.

## 5. Security & Rollout Status
> [!WARNING]
> **Production Context**
> - **Production remains HOLD.**
> - **FINAL GO is NOT AUTHORIZED.**
