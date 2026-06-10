# 23F: Receiving Select Option Diagnostics

## 1. Current MISSING_OPTION Result
During Playwright UAT execution for Receiving transactions, the automation successfully reaches `/operations/receiving/create`. However, it encounters failures when attempting to select Warehouse and Product data:
- `MISSING_OPTION` is thrown for `WH-COLD-01` in the Warehouse select field.
- `MISSING_OPTION` is thrown for `FSHR-001` in the Product select field.

## 2. Likely Reason: Select Value/Text Mismatch
The UI dropdowns for Warehouse and Product likely display names (e.g., "TGM Cold Storage Warehouse 01") or internal database IDs as their `value` attribute, rather than the raw codes provided by the UAT specification. As a result, Playwright's strict option matcher fails to find an option exactly matching the raw string like `WH-COLD-01` or `FSHR-001`.

## 3. Diagnostics Behavior
To diagnose and self-heal during tests, `tests/e2e/transaction-uat-round-1.spec.js` was updated to:
- Dynamically collect all available options (`value`, `text`, `index`) when encountering a `<select>`.
- Perform advanced matching: exact value, exact text, partial text match, partial value match, and case-insensitive matching.
- Append a detailed `selectDiagnostics` array into the output `22N_result.json` containing the selector, attempted value, and full list of available options for post-mortem analysis.

## 4. Environment Fallback Recommendation
To align the Playwright test with what is actually rendered in the UI, it is recommended to set explicit Name environment variables alongside the Code variables. The test now preferentially uses these variables:
- `UAT_PRODUCT_NAME` (fallback for `UAT_PRODUCT_CODE`)
- `UAT_WAREHOUSE_NAME` (fallback for `UAT_WAREHOUSE_CODE`)

**Recommended Safe Example Environment Variables:**
```env
UAT_PRODUCT_CODE=FSHR-001
UAT_PRODUCT_NAME=Frozen Shrimp
UAT_WAREHOUSE_CODE=WH-COLD-01
UAT_WAREHOUSE_NAME=TGM Cold Storage Warehouse 01
```

## 5. Security & Rollout Status
> [!WARNING]
> **Production Context**
> - **Production remains HOLD.**
> - **FINAL GO is NOT AUTHORIZED.**
