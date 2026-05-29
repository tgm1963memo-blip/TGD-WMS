# Day 1 Monitoring Checklist

## Purpose

This checklist supports Day 1 controlled rollout monitoring for TGD WMS.

## Monitoring Checklist

| Check ID | Time | Area | Check item | Expected result | Actual result | Status | Owner | Evidence / notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| D1-001 | Start | App availability | Open TGD WMS app | App loads successfully |  | Pass / Fail / Blocked | IT / Technical |  |
| D1-002 | Start | Login/access | Verify Day 1 users can access system | Approved users can access system |  | Pass / Fail / Blocked | Admin / Controller |  |
| D1-003 | Start | Role visibility | Verify admin, warehouse, accounting, viewer visibility | Role navigation matches expected access |  | Pass / Fail / Blocked | Admin / Controller |  |
| D1-004 | Start | Language toggle | Switch Thai / English | Labels switch correctly and Thai remains default expectation |  | Pass / Fail / Blocked | Admin / Controller |  |
| D1-005 | Start | Document branding preview | Open branding preview/admin draft | Header/footer preview renders; no save/upload action required |  | Pass / Fail / Blocked | Admin / Controller |  |
| D1-006 | Operation | Receiving | Open and review Receiving | Receiving works within controlled scope |  | Pass / Fail / Blocked | Warehouse Manager |  |
| D1-007 | Operation | Putaway | Open and review Putaway | Putaway works within controlled scope |  | Pass / Fail / Blocked | Warehouse Manager |  |
| D1-008 | Operation | Transfer | Open and review Transfer | Transfer works within controlled scope |  | Pass / Fail / Blocked | Warehouse Manager |  |
| D1-009 | Operation | Adjustment | Open and review Adjustment | Adjustment works within controlled scope |  | Pass / Fail / Blocked | Warehouse Manager |  |
| D1-010 | Operation | Stock Count | Open and review Stock Count | Stock Count works within controlled scope |  | Pass / Fail / Blocked | Warehouse Manager |  |
| D1-011 | Operation | Customer Withdrawal | Open and review Customer Withdrawal | Customer Withdrawal works within controlled scope |  | Pass / Fail / Blocked | Warehouse Manager |  |
| D1-012 | Operation | Allocation | Open and review Allocation | Allocation works within controlled scope |  | Pass / Fail / Blocked | Warehouse Manager |  |
| D1-013 | Operation | Picking | Open and review Picking | Picking works within controlled scope |  | Pass / Fail / Blocked | Warehouse Manager |  |
| D1-014 | Operation | Dispatch / Goods Issue | Open and review Dispatch / Goods Issue | Dispatch / Goods Issue works within controlled scope |  | Pass / Fail / Blocked | Warehouse Manager |  |
| D1-015 | Report | Inventory Dashboard | Open dashboard | Customer-owned inventory summary loads |  | Pass / Fail / Blocked | Warehouse Manager |  |
| D1-016 | Report | Movement Ledger | Open Movement Ledger | Customer stock movement report loads |  | Pass / Fail / Blocked | Warehouse Manager |  |
| D1-017 | Accounting review | Monthly Storage Billing Summary | Open monthly summary | Review-only report loads |  | Pass / Fail / Blocked | Accounting |  |
| D1-018 | Accounting review | Accounting Charge Review | Open accounting review pages | Review-only pages load; no Accounting post action |  | Pass / Fail / Blocked | Accounting |  |
| D1-019 | Safety | Error boundary | Review safe fallback method | Safe fallback does not expose stack trace |  | Pass / Fail / Blocked | IT / Technical |  |
| D1-020 | Recovery | Backup/rollback readiness | Confirm rollback owner and backup evidence | Rollback owner and evidence are available |  | Pass / Fail / Blocked | IT / Technical |  |
| D1-021 | End | End-of-day summary | Complete daily summary and issue review | Summary completed and next-day decision recorded |  | Pass / Fail / Blocked | Business Owner |  |
