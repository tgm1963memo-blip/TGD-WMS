# UAT Detailed Test Scripts

## Flow 1: Receiving To Putaway

| Field | Value |
|---|---|
| Test case ID | UAT-FLOW-001 |
| Module | Receiving / Putaway |
| Role | warehouse_staff, warehouse_manager |
| Preconditions | Customer, product, lot, pallet, warehouse, and receiving sample data exist. |

| Step | Action | Expected Result | Actual Result | Result (Pass / Fail / Blocked) | Evidence / Notes |
|---|---|---|---|---|---|
| 1 | Create or open a receiving document for customer goods deposit. | Receiving header shows customer, warehouse, receiving type, and reference data. |  |  |  |
| 2 | Confirm receiving lines include product, lot, pallet, quantity, UOM, and initial location if applicable. | Line data matches test data. |  |  |  |
| 3 | Execute approved receiving confirmation method if included in UAT environment. | Receiving status and movement behavior match approved workflow. |  |  |  |
| 4 | Create or open putaway document from received goods. | Putaway document references the received stock. |  |  |  |
| 5 | Select cold room/location for putaway. | Target warehouse/location is captured correctly. |  |  |  |
| 6 | Execute approved putaway confirmation method if included in UAT environment. | Putaway status and movement behavior match approved workflow. |  |  |  |
| 7 | Open inventory dashboard or customer storage balance report. | Stock balance reflects customer-owned goods in the target location. |  |  |  |
| 8 | Open movement ledger filtered by receiving/putaway reference. | Receiving and putaway movements are visible with correct quantity and reference. |  |  |  |

## Flow 2: Internal Transfer

| Field | Value |
|---|---|
| Test case ID | UAT-FLOW-002 |
| Module | Transfer |
| Role | warehouse_staff, warehouse_manager |
| Preconditions | Existing customer-owned stock is available in a source location. |

| Step | Action | Expected Result | Actual Result | Result (Pass / Fail / Blocked) | Evidence / Notes |
|---|---|---|---|---|---|
| 1 | Select existing stock by customer, product, lot, pallet, and source location. | Source stock is identifiable. |  |  |  |
| 2 | Create transfer draft from source location to target location. | Transfer draft captures source and target locations. |  |  |  |
| 3 | Execute approved transfer posting method if included in UAT environment. | Transfer completes according to approved workflow. |  |  |  |
| 4 | Review stock balance by location. | Source location decreases and target location increases by transfer quantity. |  |  |  |
| 5 | Review movement ledger. | Transfer movement is recorded with source and target references. |  |  |  |

## Flow 3: Adjustment

| Field | Value |
|---|---|
| Test case ID | UAT-FLOW-003 |
| Module | Adjustment |
| Role | warehouse_manager |
| Preconditions | Product/location stock exists for negative adjustment; product/location exists for positive adjustment. |

| Step | Action | Expected Result | Actual Result | Result (Pass / Fail / Blocked) | Evidence / Notes |
|---|---|---|---|---|---|
| 1 | Create a positive adjustment draft for a selected product/location. | Draft captures adjustment-in quantity and reason. |  |  |  |
| 2 | Execute approved adjustment posting method if included in UAT environment. | Stock increases only through approved adjustment workflow. |  |  |  |
| 3 | Create a negative adjustment draft for existing stock. | Draft captures adjustment-out quantity and reason. |  |  |  |
| 4 | Verify approval/role assumption if applicable in the environment. | Only permitted role can proceed according to current role model. |  |  |  |
| 5 | Execute approved negative adjustment method if included in UAT environment. | Stock decreases only through approved adjustment workflow. |  |  |  |
| 6 | Review movement ledger. | Adjustment movements are visible with correct direction and reference. |  |  |  |

## Flow 4: Stock Count / Cycle Count

| Field | Value |
|---|---|
| Test case ID | UAT-FLOW-004 |
| Module | Stock Count |
| Role | warehouse_staff, warehouse_manager |
| Preconditions | Stock count test stock exists. |

| Step | Action | Expected Result | Actual Result | Result (Pass / Fail / Blocked) | Evidence / Notes |
|---|---|---|---|---|---|
| 1 | Start or open a stock count / cycle count document. | Count document shows warehouse and count type. |  |  |  |
| 2 | Record counted quantity for selected product/lot/location/pallet. | Counted quantity is captured for review. |  |  |  |
| 3 | Compare system expected quantity versus counted quantity. | Variance is visible where counted quantity differs. |  |  |  |
| 4 | Create adjustment draft from count variance if applicable. | Adjustment is draft/review only until approved posting. |  |  |  |
| 5 | Execute approved adjustment posting method if included in UAT environment. | Final stock reflects approved adjustment only. |  |  |  |
| 6 | Review final stock and movement ledger. | Final balance and adjustment movement match approved outcome. |  |  |  |

## Flow 5: Customer Withdrawal To Dispatch

| Field | Value |
|---|---|
| Test case ID | UAT-FLOW-005 |
| Module | Customer Withdrawal / Allocation / Picking / Dispatch |
| Role | warehouse_staff, warehouse_manager |
| Preconditions | Customer-owned stock exists and is available for withdrawal. |

| Step | Action | Expected Result | Actual Result | Result (Pass / Fail / Blocked) | Evidence / Notes |
|---|---|---|---|---|---|
| 1 | Create customer withdrawal request draft. | Request uses customer withdrawal terminology and captures requested dispatch date. |  |  |  |
| 2 | Allocate available stock by product, lot, pallet, and location. | Allocation references available customer-owned stock. |  |  |  |
| 3 | Create picking document from allocation. | Picking lines reference allocated stock. |  |  |  |
| 4 | Confirm picking if included in approved UAT workflow. | Picked quantity is visible without issuing stock. |  |  |  |
| 5 | Create dispatch / goods issue document. | Dispatch references withdrawal request and picking document. |  |  |  |
| 6 | Confirm dispatch / goods issue if included in approved UAT workflow. | Stock is reduced only through approved dispatch/goods issue workflow. |  |  |  |
| 7 | Review stock balance. | Customer-owned stock is reduced by dispatched quantity. |  |  |  |
| 8 | Review movement ledger. | Goods issue movement is visible with withdrawal/dispatch reference. |  |  |  |

## Flow 6: Reports Review

| Field | Value |
|---|---|
| Test case ID | UAT-FLOW-006 |
| Module | Reports |
| Role | viewer, warehouse_manager |
| Preconditions | Stock, movement, lot, and operation data exists. |

| Step | Action | Expected Result | Actual Result | Result (Pass / Fail / Blocked) | Evidence / Notes |
|---|---|---|---|---|---|
| 1 | Open inventory dashboard. | Summary cards and stock balance table render. |  |  |  |
| 2 | Open movement ledger. | Customer stock movement rows are visible and filterable. |  |  |  |
| 3 | Open customer storage balance report. | Customer-owned inventory is grouped by customer/product/lot/location. |  |  |  |
| 4 | Open storage aging report. | Aging buckets, expiry status, and chargeable-day preview fields are visible. |  |  |  |
| 5 | Open warehouse operation performance report. | Operation volume and status summaries are visible. |  |  |  |

## Flow 7: Monthly Billing / Accounting Review

| Field | Value |
|---|---|
| Test case ID | UAT-FLOW-007 |
| Module | Monthly Billing / Accounting Review |
| Role | accounting |
| Preconditions | Movement, storage balance, operation charge, and rate assumptions exist. |

| Step | Action | Expected Result | Actual Result | Result (Pass / Fail / Blocked) | Evidence / Notes |
|---|---|---|---|---|---|
| 1 | Open monthly storage billing summary. | Deposit, withdrawal, remaining, chargeable, and missing-data fields are visible. |  |  |  |
| 2 | Review operation charge preview section. | Lifting, repack, sorting, labeling, palletizing or other activity examples are visible if data exists. |  |  |  |
| 3 | Open accounting charge staging preview. | Rows are review-only with validation status. |  |  |  |
| 4 | Open accounting charge handoff review draft. | Handoff payload preview is visible. |  |  |  |
| 5 | Confirm no invoice generation action exists. | No invoice action is available. |  |  |  |
| 6 | Confirm no accounting post action exists. | No accounting post action is available. |  |  |  |

## Flow 8: Role-Based Navigation

| Field | Value |
|---|---|
| Test case ID | UAT-FLOW-008 |
| Module | Role Permission / Navigation |
| Role | admin, viewer, accounting, warehouse_staff |
| Preconditions | Role switching or role-specific users are available. |

| Step | Action | Expected Result | Actual Result | Result (Pass / Fail / Blocked) | Evidence / Notes |
|---|---|---|---|---|---|
| 1 | Log in or switch to admin. | Admin sees all report cards. |  |  |  |
| 2 | Log in or switch to viewer. | Viewer sees only general read-only reports. |  |  |  |
| 3 | Log in or switch to accounting. | Accounting sees general reports plus accounting review cards. |  |  |  |
| 4 | Log in or switch to warehouse_staff. | Warehouse staff does not see accounting review cards. |  |  |  |

## Flow 9: Thai / English UI

| Field | Value |
|---|---|
| Test case ID | UAT-FLOW-009 |
| Module | Thai / English UI |
| Role | viewer |
| Preconditions | Language toggle is available. |

| Step | Action | Expected Result | Actual Result | Result (Pass / Fail / Blocked) | Evidence / Notes |
|---|---|---|---|---|---|
| 1 | Open app fresh. | Default language is Thai. |  |  |  |
| 2 | Open reports page. | Report labels are shown in Thai where translated. |  |  |  |
| 3 | Switch to English. | Report labels change to English. |  |  |  |
| 4 | Switch back to Thai. | Thai labels return. |  |  |  |

## Flow 10: Production Readiness Smoke Test

| Field | Value |
|---|---|
| Test case ID | UAT-FLOW-010 |
| Module | Production Readiness |
| Role | admin |
| Preconditions | UAT deployment and builder validation evidence are available. |

| Step | Action | Expected Result | Actual Result | Result (Pass / Fail / Blocked) | Evidence / Notes |
|---|---|---|---|---|---|
| 1 | Open application URL. | App loads without crash. |  |  |  |
| 2 | Use documented method to trigger error boundary fallback if available. | Safe fallback appears without stack trace. |  |  |  |
| 3 | Review config validation summary or deployment checklist evidence. | Missing/unsafe config is identified; no secret exposure is visible. |  |  |  |
| 4 | Review builder evidence. | Full test and build results are available. |  |  |  |
| 5 | Confirm no live ERP connector, invoice generation, accounting post, Express sync, or inventory sync is active. | Out-of-scope production behaviors are absent. |  |  |  |
