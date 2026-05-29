# Pre-UAT Execution Checklist

| Check ID | Module | Role | Test step | Expected result | Actual result | Status: Pass / Fail / Blocked | Severity if failed | Evidence / notes |
|---|---|---|---|---|---|---|---|---|
| PUAT-APP-001 | App startup and navigation | viewer | Open staging/UAT app URL. | App loads without crash. |  |  |  |  |
| PUAT-APP-002 | App startup and navigation | viewer | Open main navigation and move between dashboard, operations, reports, and settings. | Navigation works and pages load. |  |  |  |  |
| PUAT-ROLE-001 | Role-based visibility | admin | Open Reports page. | Admin sees all report cards. |  |  |  |  |
| PUAT-ROLE-002 | Role-based visibility | viewer | Open Reports page. | Viewer sees only general read-only reports. |  |  |  |  |
| PUAT-ROLE-003 | Role-based visibility | accounting | Open Reports page. | Accounting sees general reports plus Accounting Charge Review cards. |  |  |  |  |
| PUAT-ROLE-004 | Role-based visibility | warehouse_staff | Open Reports page. | Warehouse staff does not see Accounting Charge Review cards. |  |  |  |  |
| PUAT-LANG-001 | Thai / English language | viewer | Open app fresh. | Thai is default language where translations exist. |  |  |  |  |
| PUAT-LANG-002 | Thai / English language | viewer | Switch to English and back to Thai. | Labels switch language and return correctly. |  |  |  |  |
| PUAT-BRAND-001 | Document branding preview | admin | Open `/admin/document-branding-preview`. | Branding preview page loads. |  |  |  |  |
| PUAT-BRAND-002 | Document branding preview | admin | Review Thai and English preview sections. | Header/footer show company branding preview in both languages. |  |  |  |  |
| PUAT-MD-001 | Master data readiness | warehouse_manager | Open customer, product, warehouse, and location pages. | Master data pages load and show UAT data where prepared. |  |  |  |  |
| PUAT-INB-001 | Receiving to Putaway | warehouse_staff | Execute Receiving sample flow. | Goods Deposit / Receiving sample can be reviewed or processed according to approved workflow. |  |  |  |  |
| PUAT-INB-002 | Receiving to Putaway | warehouse_staff | Execute Putaway sample flow. | Putaway sample can be reviewed or processed according to approved workflow. |  |  |  |  |
| PUAT-TRF-001 | Internal Transfer | warehouse_staff | Execute transfer sample from source to target location. | Transfer flow behaves as expected and stock/location evidence can be reviewed. |  |  |  |  |
| PUAT-ADJ-001 | Adjustment | warehouse_manager | Execute positive and negative adjustment samples where approved. | Adjustment samples follow approved workflow and are traceable. |  |  |  |  |
| PUAT-STC-001 | Stock Count | warehouse_staff | Execute Stock Count sample case. | Count can be recorded/reviewed and variance behavior is visible. |  |  |  |  |
| PUAT-OUT-001 | Customer Withdrawal to Dispatch | warehouse_staff | Create or review Customer Withdrawal sample. | Customer Withdrawal uses customer-owned inventory terminology and expected data. |  |  |  |  |
| PUAT-OUT-002 | Customer Withdrawal to Dispatch | warehouse_manager | Review Allocation, Picking, and Dispatch / Goods Issue sample flow. | Flow can be reviewed or processed according to approved workflow. |  |  |  |  |
| PUAT-REP-001 | Reports review | viewer | Open Inventory Dashboard. | Dashboard loads. |  |  |  |  |
| PUAT-REP-002 | Reports review | viewer | Open Movement Ledger Report. | Customer stock movement rows are visible where data exists. |  |  |  |  |
| PUAT-REP-003 | Reports review | viewer | Open Customer Storage Balance Report. | Customer-owned inventory balance is visible where data exists. |  |  |  |  |
| PUAT-REP-004 | Reports review | viewer | Open Storage Aging Report. | Aging and expiry sections load. |  |  |  |  |
| PUAT-REP-005 | Reports review | warehouse_manager | Open Warehouse Operation Performance Report. | Operation performance report loads. |  |  |  |  |
| PUAT-BIL-001 | Monthly Storage Billing Summary | accounting | Open Monthly Storage Billing Summary. | Report loads in review-only mode. |  |  |  |  |
| PUAT-BIL-002 | Accounting Charge Staging Preview | accounting | Open Accounting Charge Staging Preview. | Preview loads in review-only mode. |  |  |  |  |
| PUAT-BIL-003 | Accounting Charge Handoff Review Draft | accounting | Open Accounting Charge Handoff Review Draft. | Handoff review draft loads in review-only mode. |  |  |  |  |
| PUAT-ERR-001 | Error boundary smoke check | admin | Use documented safe method or review error boundary behavior. | Generic fallback does not expose stack trace. |  |  |  |  |
| PUAT-CONFIG-001 | Config readiness check | admin | Review public config readiness evidence. | No secret-like frontend values are exposed. |  |  |  |  |
| PUAT-FORBID-001 | Forbidden scope check | admin | Check for invoice generation actions. | No invoice generation action exists. |  |  |  |  |
| PUAT-FORBID-002 | Forbidden scope check | admin | Check for accounting post actions. | No accounting post action exists. |  |  |  |  |
| PUAT-FORBID-003 | Forbidden scope check | admin | Check for ERP live connector / inventory sync actions. | No ERP live connector or inventory sync action exists. |  |  |  |  |
| PUAT-FORBID-004 | Forbidden scope check | admin | Check for Express sync actions. | No Express sync action exists. |  |  |  |  |
