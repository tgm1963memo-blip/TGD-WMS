# SOP Overview

## Purpose

This SOP package guides business users during TGD WMS UAT and training. TGD WMS supports cold storage goods deposit, storage, customer withdrawal, warehouse operations, reporting, and accounting charge review for customer-owned inventory.

## Scope

- Master data review
- Receiving and putaway
- Internal transfer
- Inventory adjustment
- Stock count / cycle count
- Customer withdrawal
- Allocation
- Picking
- Dispatch / Goods Issue
- Operational reports
- Monthly Storage Billing Summary
- Accounting Charge Review
- Role-based navigation
- Thai / English language support
- Incident and support handling during UAT

## Target Users

- `admin`
- `warehouse_manager`
- `warehouse_staff`
- `accounting`
- `viewer`

## Role Responsibility Matrix

| Activity | admin | warehouse_manager | warehouse_staff | accounting | viewer |
|---|---|---|---|---|---|
| Master data review | Accountable | Responsible | Consulted | Consulted | View only |
| Receiving / Putaway | View | Accountable | Responsible | Consulted | View only |
| Transfer / Adjustment | View | Accountable | Responsible where assigned | Consulted | View only |
| Stock Count | View | Accountable | Responsible | Consulted | View only |
| Customer Withdrawal / Dispatch | View | Accountable | Responsible | Consulted | View only |
| Reports | Accountable | Responsible | Consulted | Responsible for accounting reports | View only |
| Role/language checks | Accountable | Consulted | Consulted | Consulted | Consulted |
| Defect reporting | Accountable | Responsible | Responsible | Responsible | Responsible |

## End-To-End Process Overview

1. Prepare master data for customers, products/SKUs, warehouses, rooms, zones, locations, pallets, and lots.
2. Receive customer goods as goods deposit.
3. Verify quantity, lot, pallet, and customer ownership.
4. Put away goods into cold storage room/location.
5. Move stock internally through transfer when needed.
6. Adjust stock only through approved adjustment procedures.
7. Perform stock count / cycle count and review variance.
8. Create customer withdrawal request.
9. Allocate stock, pick, and dispatch / goods issue.
10. Review stock balance, movement ledger, operational reports, and monthly storage billing support reports.
11. Accounting reviews charge summaries; final billing remains outside WMS.

## Document Control

| Field | Value |
|---|---|
| Document owner | TGD WMS Project Controller |
| Version | Draft 1 |
| Status | UAT / Training Draft |
| Reviewers | Warehouse manager, accounting lead, admin/controller |
| Approval | Pending final SOP approval |

## Change Control

- SOP changes must be logged with date, owner, reason, and affected section.
- UAT feedback should be recorded in the defect log or SOP comment log.
- Approved changes should be reflected before production training.

## Related UAT Documents

- `docs/uat/uat-master-plan.md`
- `docs/uat/uat-test-scenarios.md`
- `docs/uat/uat-detailed-test-scripts.md`
- `docs/uat/uat-defect-log-template.md`
- `docs/uat/uat-test-data-requirements.md`

## Important Business Scope Notes

- TGD WMS is a Cold Storage system for customer-owned inventory.
- TGD receives, stores, moves, counts, and dispatches goods owned by customers.
- The WMS supports Monthly Storage Billing Summary and Accounting Charge Review only.
- Invoice generation, accounting post, ERP inventory sync, and Express sync are not in scope for this SOP package.

## Control Points

- SOP users must follow approved UAT and training procedures.
- Customer-owned inventory must remain traceable by customer, product/SKU, lot, pallet, warehouse, and location where applicable.
- Stock-impacting operations must be verified against stock balance and movement ledger evidence.
- Accounting review remains review-only inside TGD WMS.
- Exceptions, defects, and workaround approvals must be recorded.

## Evidence / Record-keeping

- Keep transaction reference numbers for each UAT operation reviewed under this SOP package.
- Capture screenshot or evidence before and after key warehouse operations where applicable.
- Record movement ledger reference and stock balance evidence when validating inventory impact.
- Record operator name and timestamp for each executed UAT step.
- Record reviewer or approver name where warehouse manager, accounting, or admin review is required.
