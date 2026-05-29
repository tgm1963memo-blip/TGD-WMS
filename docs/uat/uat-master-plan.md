# TGD WMS UAT Master Plan

## Purpose

User Acceptance Testing confirms that TGD WMS supports cold storage deposit, storage, customer withdrawal, reporting, and accounting charge summary review before production readiness approval.

## UAT Scope

- Cold storage receiving
- Putaway
- Location transfer
- Inventory adjustment
- Stock count / cycle count
- Customer withdrawal request
- Allocation
- Picking
- Dispatch / Goods Issue
- Movement ledger
- Inventory dashboard
- Customer storage balance report
- Storage aging report
- Warehouse operation performance report
- Monthly storage billing summary
- Accounting charge staging preview
- Accounting charge handoff review draft
- Role-based visibility
- Thai / English UI check
- Error boundary smoke check
- Config readiness check

## Out Of Scope

- Sales order
- Invoice generation
- Accounting posting
- ERP live connector
- Inventory sync with ERP
- Backend RLS production enforcement
- Express sync
- Database migration

## User Roles

- `admin`: controller/admin review, full navigation visibility.
- `warehouse_manager`: warehouse operation supervision and exception review.
- `warehouse_staff`: receiving, putaway, transfer, count, picking, dispatch execution.
- `accounting`: monthly storage billing summary and accounting charge review.
- `viewer`: read-only report and dashboard validation.

## Test Environment Assumptions

- UAT uses a non-production environment.
- Test data is prepared and can be reset.
- Test users exist for all UAT roles.
- Thai is the default language and English is available through the language toggle.
- Posting workflows may be tested only where already approved by existing workflow scope.
- No live ERP, Express sync, or accounting connector is enabled.

## Master Data Preparation

- Customers with active storage agreements.
- Products/SKUs with UOM and weight assumptions.
- Warehouses, rooms, zones, and locations.
- Pallets and lots for traceability.
- Opening stock for transfer, withdrawal, count, and reports.
- Sample receiving and withdrawal documents.
- Billing rate assumptions for review-only summary checks.

## Entry Criteria

- Approved Sprint 8 foundation is deployed to UAT.
- UAT users can log in or access the test role setup.
- Required master data is loaded.
- Full test and build evidence is available from builder validation.
- UAT test scripts and defect log templates are distributed.

## Exit Criteria

- All high-priority UAT scenarios are executed.
- No open Critical or High defects remain.
- Medium defects have accepted workarounds or approved follow-up plans.
- Accounting review confirms summary-only billing scope.
- Warehouse users confirm core operation flow usability.
- Controller/admin signs Go / No-Go decision.

## Defect Severity Levels

- Critical: Blocks UAT or corrupts stock, movement, permission, or accounting review data.
- High: Blocks a key warehouse or accounting workflow with no acceptable workaround.
- Medium: Workflow issue with workaround or limited impact.
- Low: Cosmetic, wording, layout, or minor usability issue.

## Go / No-Go Decision Process

1. UAT lead reviews execution coverage and open defects.
2. Warehouse manager confirms operation readiness.
3. Accounting confirms monthly storage billing summary review scope.
4. Admin/controller reviews role visibility, language, config, and deployment readiness checks.
5. Decision is recorded as Go, Conditional Go, or No-Go with required actions.
