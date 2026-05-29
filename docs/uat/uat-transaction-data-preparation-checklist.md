# UAT Transaction Data Preparation Checklist

This checklist plans sample transactions only. It does not insert data and does not create seed scripts.

## Receiving Sample Data

| Item | Expected | Owner | Status: Not Prepared / Prepared / Verified | Notes |
|---|---|---|---|---|
| Goods Deposit receiving sample | Customer, product, lot, pallet, qty, UOM | Warehouse Staff | Not Prepared |  |
| Receiving reference | Unique UAT receiving reference | Warehouse Staff | Not Prepared |  |

## Putaway Sample Data

| Item | Expected | Owner | Status: Not Prepared / Prepared / Verified | Notes |
|---|---|---|---|---|
| Putaway target location | Cold room/location prepared | Warehouse Staff | Not Prepared |  |
| Putaway source reference | Linked to receiving sample | Warehouse Staff | Not Prepared |  |

## Transfer Sample Data

| Item | Expected | Owner | Status: Not Prepared / Prepared / Verified | Notes |
|---|---|---|---|---|
| Transfer source stock | Customer-owned stock in source location | Warehouse Staff | Not Prepared |  |
| Transfer target location | Empty or valid target location | Warehouse Staff | Not Prepared |  |

## Adjustment Sample Data

| Item | Expected | Owner | Status: Not Prepared / Prepared / Verified | Notes |
|---|---|---|---|---|
| Positive adjustment case | Product/location for gain adjustment | Warehouse Manager | Not Prepared |  |
| Negative adjustment case | Existing stock for loss adjustment | Warehouse Manager | Not Prepared |  |
| Adjustment reason | Reason/evidence placeholder | Warehouse Manager | Not Prepared |  |

## Stock Count Sample Data

| Item | Expected | Owner | Status: Not Prepared / Prepared / Verified | Notes |
|---|---|---|---|---|
| Count with no variance | Expected equals counted | Warehouse Manager | Not Prepared |  |
| Count with variance | Expected differs from counted | Warehouse Manager | Not Prepared |  |

## Customer Withdrawal Sample Data

| Item | Expected | Owner | Status: Not Prepared / Prepared / Verified | Notes |
|---|---|---|---|---|
| Customer Withdrawal request | Customer, product, qty, requested date | Warehouse Staff | Not Prepared |  |
| Available stock | Stock available for allocation | Warehouse Manager | Not Prepared |  |

## Allocation Sample Data

| Item | Expected | Owner | Status: Not Prepared / Prepared / Verified | Notes |
|---|---|---|---|---|
| Allocation line | Product/lot/pallet/location allocation | Warehouse Manager | Not Prepared |  |
| Allocation quantity | Does not exceed available stock | Warehouse Manager | Not Prepared |  |

## Picking Sample Data

| Item | Expected | Owner | Status: Not Prepared / Prepared / Verified | Notes |
|---|---|---|---|---|
| Picking document sample | Linked to allocation | Warehouse Staff | Not Prepared |  |
| Picking location | Matches allocated location | Warehouse Staff | Not Prepared |  |

## Dispatch / Goods Issue Sample Data

| Item | Expected | Owner | Status: Not Prepared / Prepared / Verified | Notes |
|---|---|---|---|---|
| Dispatch document sample | Linked to withdrawal/picking | Warehouse Staff | Not Prepared |  |
| Transport placeholder | Vehicle/driver/test remark if needed | Warehouse Staff | Not Prepared |  |

## Monthly Billing Review Sample Data

| Item | Expected | Owner | Status: Not Prepared / Prepared / Verified | Notes |
|---|---|---|---|---|
| Billing period | Month/year for UAT | Accounting | Not Prepared |  |
| Storage rate assumption | Rate/basis for sample customer | Accounting | Not Prepared |  |
| Chargeable qty/weight assumption | Quantity/weight for billing summary review | Accounting | Not Prepared |  |

## Accounting Charge Review Sample Data

| Item | Expected | Owner | Status: Not Prepared / Prepared / Verified | Notes |
|---|---|---|---|---|
| Operation Charge sample | Lifting/Repack/Sorting/Labeling/Palletizing assumption | Accounting | Not Prepared |  |
| Missing-data sample | Row missing rate or weight for warning review | Accounting | Not Prepared |  |

## Expected Stock Movement Result

| Flow | Expected Stock Result | Owner | Verification Status | Evidence / Notes |
|---|---|---|---|---|
| Receiving / Putaway | Customer-owned stock appears in target location | Warehouse Manager | Not Prepared |  |
| Transfer | Source location decreases and target location increases | Warehouse Manager | Not Prepared |  |
| Adjustment | Stock changes only through approved adjustment workflow | Warehouse Manager | Not Prepared |  |
| Dispatch / Goods Issue | Customer-owned stock decreases after approved goods issue | Warehouse Manager | Not Prepared |  |

## Expected Movement Ledger Result

| Flow | Expected Ledger Result | Owner | Verification Status | Evidence / Notes |
|---|---|---|---|---|
| Receiving | Receiving movement visible with reference | Warehouse Manager | Not Prepared |  |
| Putaway | Putaway movement visible with location reference | Warehouse Manager | Not Prepared |  |
| Transfer | Transfer movement visible with source/target references | Warehouse Manager | Not Prepared |  |
| Adjustment | Adjustment movement visible with reason/reference | Warehouse Manager | Not Prepared |  |
| Dispatch / Goods Issue | Goods issue movement visible with withdrawal/dispatch reference | Warehouse Manager | Not Prepared |  |
