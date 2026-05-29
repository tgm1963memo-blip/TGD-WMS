# Recovery Drill Checklist

## Purpose

This checklist captures execution evidence for the TGD WMS backup, restore, and recovery drill.

## Checklist

| Check ID | Area | Step | Expected result | Actual result | Status | Evidence / notes | Owner |
| --- | --- | --- | --- | --- | --- | --- | --- |
| RCV-001 | Backup availability | Confirm backup exists for selected environment | Backup record is available |  | Pass / Fail / Blocked |  | IT / Technical |
| RCV-002 | Backup timestamp verification | Confirm backup timestamp | Timestamp is within expected RPO assumption |  | Pass / Fail / Blocked |  | IT / Technical |
| RCV-003 | Database restore readiness | Confirm restore target and owner | Restore target is approved and owner assigned |  | Pass / Fail / Blocked |  | IT / Technical |
| RCV-004 | Application deployment rollback readiness | Confirm previous approved application version | Rollback target is known |  | Pass / Fail / Blocked |  | IT / Technical |
| RCV-005 | Environment variable/config readiness | Review required env/config values | Environment values are present without exposing secrets |  | Pass / Fail / Blocked |  | IT / Technical |
| RCV-006 | Role/access verification | Verify admin access | Admin can access admin review pages |  | Pass / Fail / Blocked |  | Admin / Controller |
| RCV-007 | Role/access verification | Verify warehouse roles | Warehouse roles can access assigned operation areas |  | Pass / Fail / Blocked |  | Admin / Controller |
| RCV-008 | Role/access verification | Verify accounting role | Accounting can access Monthly Storage Billing Summary and Accounting Charge Review |  | Pass / Fail / Blocked |  | Accounting |
| RCV-009 | Role/access verification | Verify viewer role | Viewer sees approved read-only reports only |  | Pass / Fail / Blocked |  | Admin / Controller |
| RCV-010 | Core warehouse workflow smoke check | Open Receiving and Putaway pages | Pages load and show expected records or empty states |  | Pass / Fail / Blocked |  | Warehouse Manager |
| RCV-011 | Core warehouse workflow smoke check | Open Transfer, Adjustment, and Stock Count pages | Pages load and show expected records or empty states |  | Pass / Fail / Blocked |  | Warehouse Manager |
| RCV-012 | Core warehouse workflow smoke check | Open Customer Withdrawal, Picking, and Dispatch / Goods Issue pages | Pages load and show expected records or empty states |  | Pass / Fail / Blocked |  | Warehouse Manager |
| RCV-013 | Reports smoke check | Open Inventory Dashboard and Movement Ledger | Reports load without forbidden actions |  | Pass / Fail / Blocked |  | Warehouse Manager |
| RCV-014 | Reports smoke check | Open Customer Storage Balance and Storage Aging | Reports load expected sections |  | Pass / Fail / Blocked |  | Warehouse Manager |
| RCV-015 | Accounting review smoke check | Open Monthly Storage Billing Summary | Report loads and remains review-only |  | Pass / Fail / Blocked |  | Accounting |
| RCV-016 | Accounting review smoke check | Open Accounting Charge Review pages | Review pages load with no Accounting post or invoice action |  | Pass / Fail / Blocked |  | Accounting |
| RCV-017 | Document branding preview check | Open document branding preview/admin pages | Preview renders; no save/upload action is required for recovery |  | Pass / Fail / Blocked |  | Admin / Controller |
| RCV-018 | Error boundary check | Trigger or review documented safe fallback method | Error fallback does not expose stack trace |  | Pass / Fail / Blocked |  | IT / Technical |
| RCV-019 | Rollback communication | Confirm support channel and decision owner | Communication path is available |  | Pass / Fail / Blocked |  | Admin / Controller |
| RCV-020 | Post-drill sign-off | Complete drill result and sign-off | Required roles sign off or record conditions |  | Pass / Fail / Blocked |  | Business Owner |
