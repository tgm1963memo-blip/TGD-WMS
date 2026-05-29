# Business User UAT Short-Cycle Scripts

## Warehouse Script 1: Receiving To Putaway

| Field | Value |
|---|---|
| Script ID | BU-UAT-WH-001 |
| Role | Warehouse Staff / Warehouse Manager |
| Preconditions | Customer, product/SKU, lot, pallet, warehouse, and receiving data are ready. |
| Test data | Goods Deposit / Receiving sample |
| Sign-off by | Warehouse Manager |

| Step | Action | Expected result | Actual result | Status: Pass / Fail / Blocked | Evidence / Notes |
|---|---|---|---|---|---|
| 1 | Open Receiving page and select sample receiving document. | Receiving document loads. |  |  |  |
| 2 | Verify customer, product/SKU, lot, pallet, quantity, and UOM. | Data matches prepared test data. |  |  |  |
| 3 | Open Putaway page and select target cold storage location. | Putaway data is available and target location can be reviewed. |  |  |  |
| 4 | Review stock balance and movement ledger evidence where available. | Stock and movement evidence matches expected result. |  |  |  |

## Warehouse Script 2: Internal Transfer

| Field | Value |
|---|---|
| Script ID | BU-UAT-WH-002 |
| Role | Warehouse Staff / Warehouse Manager |
| Preconditions | Customer-owned inventory exists in a source location. |
| Test data | Transfer sample data |
| Sign-off by | Warehouse Manager |

| Step | Action | Expected result | Actual result | Status: Pass / Fail / Blocked | Evidence / Notes |
|---|---|---|---|---|---|
| 1 | Open Transfer page. | Transfer page loads. |  |  |  |
| 2 | Review source customer-owned inventory and target location. | Source and target data are clear. |  |  |  |
| 3 | Review expected stock balance by location. | Source/target location evidence can be reviewed. |  |  |  |
| 4 | Review movement ledger evidence where available. | Transfer movement evidence is traceable. |  |  |  |

## Warehouse Script 3: Stock Count / Cycle Count

| Field | Value |
|---|---|
| Script ID | BU-UAT-WH-003 |
| Role | Warehouse Staff / Warehouse Manager |
| Preconditions | Stock count sample data is ready. |
| Test data | Stock Count sample case |
| Sign-off by | Warehouse Manager |

| Step | Action | Expected result | Actual result | Status: Pass / Fail / Blocked | Evidence / Notes |
|---|---|---|---|---|---|
| 1 | Open Stock Count page. | Stock Count page loads. |  |  |  |
| 2 | Review count scope and sample item. | Product/location/lot/pallet data is visible where prepared. |  |  |  |
| 3 | Review expected vs counted quantity behavior. | Variance can be reviewed where applicable. |  |  |  |
| 4 | Confirm any adjustment remains controlled by approved workflow. | No uncontrolled stock update occurs. |  |  |  |

## Warehouse Script 4: Customer Withdrawal To Dispatch / Goods Issue

| Field | Value |
|---|---|
| Script ID | BU-UAT-WH-004 |
| Role | Warehouse Staff / Warehouse Manager |
| Preconditions | Customer Withdrawal, Allocation, Picking, and Dispatch sample data are ready. |
| Test data | Customer Withdrawal to Dispatch sample |
| Sign-off by | Warehouse Manager |

| Step | Action | Expected result | Actual result | Status: Pass / Fail / Blocked | Evidence / Notes |
|---|---|---|---|---|---|
| 1 | Open Customer Withdrawal page and review sample request. | Customer Withdrawal request loads and uses correct terminology. |  |  |  |
| 2 | Review Allocation and Picking pages. | Allocated/picked customer-owned inventory is traceable. |  |  |  |
| 3 | Open Dispatch / Goods Issue page. | Dispatch page loads and references withdrawal/picking data. |  |  |  |
| 4 | Review expected stock reduction and movement ledger evidence. | Goods issue evidence is traceable where available. |  |  |  |

## Accounting Script 1: Monthly Storage Billing Summary

| Field | Value |
|---|---|
| Script ID | BU-UAT-ACC-001 |
| Role | Accounting |
| Preconditions | Billing period, stock movement, and billing assumptions are prepared. |
| Test data | Monthly Storage Billing Summary sample |
| Sign-off by | Accounting |

| Step | Action | Expected result | Actual result | Status: Pass / Fail / Blocked | Evidence / Notes |
|---|---|---|---|---|---|
| 1 | Open Monthly Storage Billing Summary. | Report loads. |  |  |  |
| 2 | Review deposit, withdrawal, remaining, and chargeable quantity/weight preview. | Summary fields are visible. |  |  |  |
| 3 | Review missing data or warning rows. | Review issues are visible where applicable. |  |  |  |

## Accounting Script 2: Accounting Charge Staging Preview

| Field | Value |
|---|---|
| Script ID | BU-UAT-ACC-002 |
| Role | Accounting |
| Preconditions | Operation Charge assumptions are prepared. |
| Test data | Accounting Charge Staging Preview sample |
| Sign-off by | Accounting |

| Step | Action | Expected result | Actual result | Status: Pass / Fail / Blocked | Evidence / Notes |
|---|---|---|---|---|---|
| 1 | Open Accounting Charge Staging Preview. | Preview page loads. |  |  |  |
| 2 | Review customer, billing period, Operation Charge summary, and validation status. | Review fields are visible. |  |  |  |
| 3 | Confirm preview is review-only. | No save/post/finalize action is available. |  |  |  |

## Accounting Script 3: Accounting Charge Handoff Review Draft

| Field | Value |
|---|---|
| Script ID | BU-UAT-ACC-003 |
| Role | Accounting |
| Preconditions | Handoff review draft data is available or preview page can load. |
| Test data | Accounting Charge Handoff Review Draft sample |
| Sign-off by | Accounting |

| Step | Action | Expected result | Actual result | Status: Pass / Fail / Blocked | Evidence / Notes |
|---|---|---|---|---|---|
| 1 | Open Accounting Charge Handoff Review Draft. | Handoff review draft loads. |  |  |  |
| 2 | Review handoff content and validation status. | Data is readable for accounting review. |  |  |  |
| 3 | Confirm no invoice generation. | No invoice generation action exists. |  |  |  |
| 4 | Confirm no accounting post. | No accounting post action exists. |  |  |  |

## Admin / Controller Script 1: Role-Based Navigation

| Field | Value |
|---|---|
| Script ID | BU-UAT-ADM-001 |
| Role | Admin / Controller |
| Preconditions | Test roles are available. |
| Test data | Role setup checklist |
| Sign-off by | Admin / Controller |

| Step | Action | Expected result | Actual result | Status: Pass / Fail / Blocked | Evidence / Notes |
|---|---|---|---|---|---|
| 1 | Check admin report visibility. | Admin sees all report cards. |  |  |  |
| 2 | Check viewer report visibility. | Viewer sees general read-only reports only. |  |  |  |
| 3 | Check accounting report visibility. | Accounting sees accounting review cards. |  |  |  |
| 4 | Check warehouse_staff report visibility. | Warehouse staff does not see accounting review cards. |  |  |  |

## Admin / Controller Script 2: Thai / English Language Toggle

| Field | Value |
|---|---|
| Script ID | BU-UAT-ADM-002 |
| Role | Admin / Controller |
| Preconditions | Language toggle is available. |
| Test data | N/A |
| Sign-off by | Admin / Controller |

| Step | Action | Expected result | Actual result | Status: Pass / Fail / Blocked | Evidence / Notes |
|---|---|---|---|---|---|
| 1 | Open app fresh. | Thai is default where translations exist. |  |  |  |
| 2 | Switch to English. | English labels appear where translated. |  |  |  |
| 3 | Switch back to Thai. | Thai labels return. |  |  |  |

## Admin / Controller Script 3: Document Branding Preview

| Field | Value |
|---|---|
| Script ID | BU-UAT-ADM-003 |
| Role | Admin / Controller |
| Preconditions | Sprint 10A preview route is available. |
| Test data | Default document branding config |
| Sign-off by | Admin / Controller |

| Step | Action | Expected result | Actual result | Status: Pass / Fail / Blocked | Evidence / Notes |
|---|---|---|---|---|---|
| 1 | Open Document Branding Preview. | Preview page loads. |  |  |  |
| 2 | Review Thai preview. | Thai company/header/footer preview is visible. |  |  |  |
| 3 | Review English preview. | English company/header/footer preview is visible. |  |  |  |
| 4 | Confirm no save/upload action. | Preview remains foundation-only. |  |  |  |

## Admin / Controller Script 4: Error Boundary / Support Process

| Field | Value |
|---|---|
| Script ID | BU-UAT-ADM-004 |
| Role | Admin / Controller / IT Technical |
| Preconditions | Error boundary behavior is documented. |
| Test data | N/A |
| Sign-off by | Admin / Controller |

| Step | Action | Expected result | Actual result | Status: Pass / Fail / Blocked | Evidence / Notes |
|---|---|---|---|---|---|
| 1 | Review documented error fallback behavior. | Support process is understood. |  |  |  |
| 2 | Confirm screenshot/evidence process. | Users know how to report issues. |  |  |  |
| 3 | Confirm defect log handoff. | Issues can be captured for fix sprint. |  |  |  |

## Admin / Controller Script 5: Config Readiness Review

| Field | Value |
|---|---|
| Script ID | BU-UAT-ADM-005 |
| Role | Admin / Controller / IT Technical |
| Preconditions | Staging config evidence is available. |
| Test data | Config readiness evidence |
| Sign-off by | Admin / Controller |

| Step | Action | Expected result | Actual result | Status: Pass / Fail / Blocked | Evidence / Notes |
|---|---|---|---|---|---|
| 1 | Review public frontend config readiness. | Required public config is present. |  |  |  |
| 2 | Confirm no secret exposure. | No prohibited frontend secrets are visible. |  |  |  |
| 3 | Confirm staging/production separation. | UAT does not use production data by mistake. |  |  |  |
