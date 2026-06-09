# 22G Receiving RPC UAT Defect Diagnosis

## 1. Observed Evidence
- Playwright Browser UAT completed against `https://tgd-wms.vercel.app`.
- The UAT script specifically looks for the case-insensitive keywords `table not found`, `schema cache`, `RPC`, `failed`, `invalid` inside the `innerText` of the page `body`.
- `result.json` reported: `Found keyword "RPC" on https://tgd-wms.vercel.app/receiving`.

## 2. Suspected Root Cause (False Positive)
- A thorough inspection of the `ReceivingListPage.jsx` file (`src/features/operations/receiving/ReceivingListPage.jsx`), which renders the `/receiving` route, reveals static text containing the keyword "RPC".
- Specifically, there is a `warning-panel` section that says:
  > "Receiving creation is controlled draft mode only. Confirm/Post is available on draft page via RPC."
- Because the E2E test asserts the absence of the "RPC" keyword using `textContent.toLowerCase().includes('rpc')`, it correctly flags the presence of the static string `via RPC` on the page, leading to a **false-positive** defect detection.

## 3. Impacted Module
- Operations / Receiving (`src/features/operations/receiving/ReceivingListPage.jsx`)
- UAT E2E Test Suite (`tests/e2e/uat-round-1.spec.js`)

## 4. Severity
- **None** (False Positive).
- There is no actual runtime error, missing table, or failing RPC causing this issue on the page load.

## 5. Safe Diagnostic SQL
The following SQL queries safely identify all `tgd_%` routines and tables in the public schema without modifying data.

```sql
select routine_name
from information_schema.routines
where routine_schema = 'public'
  and routine_name like 'tgd_%'
order by routine_name;

select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name like 'tgd_%'
order by table_name;
```

## 6. Blocker Decision
- This is a **Non-Blocker** from a functional perspective because it is a false-positive in the test suite keyword detection.
- However, the UAT test will continue to fail until either the keyword check is refined or the static text is adjusted.

## 7. Recommended Next Action
- Modify the text in `ReceivingListPage.jsx` to remove the exact keyword "RPC" (e.g., change "via RPC" to "via background process" or "via system function") OR update the UAT script to be more precise in identifying actual error messages rather than static page content.
