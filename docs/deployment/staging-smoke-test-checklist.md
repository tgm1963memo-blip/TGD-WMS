# Staging Smoke Test Checklist

| Test ID | Area | Test step | Expected result | Actual result | Status: Pass / Fail / Blocked | Evidence / notes |
|---|---|---|---|---|---|---|
| STG-SMOKE-001 | App | Open staging URL. | App loads without crash. |  |  |  |
| STG-SMOKE-002 | Access | Confirm login/auth placeholder or current access assumption. | User can access staging according to current approved access model. |  |  |  |
| STG-SMOKE-003 | Error Boundary | Trigger or review documented safe fallback method. | Generic fallback can appear without stack trace exposure. |  |  |  |
| STG-SMOKE-004 | Language | Toggle Thai / English. | Thai and English labels switch as expected. |  |  |  |
| STG-SMOKE-005 | Role Visibility | Review report cards by role. | Admin, viewer, accounting, and warehouse roles see expected report cards. |  |  |  |
| STG-SMOKE-006 | Master Data | Open master data page. | Master data page loads. |  |  |  |
| STG-SMOKE-007 | Receiving | Open Receiving page. | Receiving page loads. |  |  |  |
| STG-SMOKE-008 | Putaway | Open Putaway page. | Putaway page loads. |  |  |  |
| STG-SMOKE-009 | Transfer | Open Transfer page. | Transfer page loads. |  |  |  |
| STG-SMOKE-010 | Adjustment | Open Adjustment page. | Adjustment page loads. |  |  |  |
| STG-SMOKE-011 | Stock Count | Open Stock Count page. | Stock count page loads. |  |  |  |
| STG-SMOKE-012 | Customer Withdrawal | Open Customer Withdrawal page. | Customer withdrawal page loads. |  |  |  |
| STG-SMOKE-013 | Allocation | Open Allocation page. | Allocation page loads. |  |  |  |
| STG-SMOKE-014 | Picking | Open Picking page. | Picking page loads. |  |  |  |
| STG-SMOKE-015 | Dispatch / Goods Issue | Open Dispatch / Goods Issue page. | Dispatch / Goods Issue page loads. |  |  |  |
| STG-SMOKE-016 | Reports | Open Reports page. | Reports page loads. |  |  |  |
| STG-SMOKE-017 | Monthly Storage Billing Summary | Open Monthly Storage Billing Summary. | Report loads in review-only mode. |  |  |  |
| STG-SMOKE-018 | Accounting Charge Staging Preview | Open Accounting Charge Staging Preview. | Preview loads in review-only mode. |  |  |  |
| STG-SMOKE-019 | Accounting Charge Handoff Review Draft | Open Accounting Charge Handoff Review Draft. | Handoff review draft loads in review-only mode. |  |  |  |
| STG-SMOKE-020 | Forbidden Scope | Check for invoice generation actions. | No invoice generation action is available. |  |  |  |
| STG-SMOKE-021 | Forbidden Scope | Check for accounting post actions. | No accounting post action is available. |  |  |  |
| STG-SMOKE-022 | Forbidden Scope | Check for ERP live connector behavior. | No ERP live connector is available. |  |  |  |
| STG-SMOKE-023 | Forbidden Scope | Check for inventory sync behavior. | No inventory sync action is available. |  |  |  |
