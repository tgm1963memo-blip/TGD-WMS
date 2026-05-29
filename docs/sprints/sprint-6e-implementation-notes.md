# Sprint 6E Implementation Notes

## Report Purpose

Sprint 6E adds the Warehouse Operation Performance Report foundation. The report helps monitor cold storage workload across receiving, putaway, transfer, adjustment, customer withdrawal, allocation, picking, and dispatch workflows.

It also previews warehouse service activity that may support monthly storage billing preparation, such as lifting, repack, sorting, labeling, and palletizing.

## Cold Storage Business Scope

TGD WMS is a cold storage deposit, storage, and customer withdrawal system. TGD stores customer-owned inventory and does not sell stored goods.

The report is an operational workload report, not commercial order analysis.

## Customer-Owned Inventory Rule

Operational volume is tied to customer-owned inventory handling. The report does not change inventory ownership, stock balances, workflow status, or accounting state.

## Operation Performance Metrics

The report summarizes:

- total operations
- receiving count
- putaway count
- transfer count
- adjustment count
- withdrawal request count
- picking count
- dispatch count
- pending operations
- completed operations
- operation charge activity count placeholder

## Operation Status Breakdown Logic

The service groups rows by document status. Draft, open, pending, and in-progress statuses are treated as pending workload. Completed, posted, confirmed, and dispatched statuses are treated as completed workload for reporting only.

## Operation Charge Activity Preview Boundary

Operation charge activity is a preview sourced through read-only service logic. It is intended to help identify handling work that may later support billing review.

This sprint does not price charges, approve charges, or create billing records.

## Read-Only Query Approach

`warehouseOperationPerformanceService.js` reads existing operation document tables and combines rows into normalized report data. It may also read operation charge activity through the read-only operation charge log service.

The service uses select-only access and does not write data, call RPC functions, update stock balances, or call workflow action functions.

## Service Usage

`WarehouseOperationPerformanceReportPage.jsx` calls:

- `getOperationPerformanceRows`
- `getOperationPerformanceSummary`
- `getOperationStatusBreakdown`
- `getOperationVolumeByCustomer`
- `getOperationVolumeByWarehouse`
- `getOperationChargeActivityPreview`

The page renders report data only and does not include operational action buttons.

## Summary Card Logic

Summary cards count normalized operation rows by operation type and status. Operation charge activity count is a placeholder for handling activity review and is not a final billable amount.

## Table Columns

The operation performance table includes:

- operation date
- operation type
- document number
- customer
- warehouse
- status
- quantity / weight if available
- charge type if available
- reference
- created date
- created by
- billing relevance note placeholder

## Billing Support Boundary

Sprint 6E does not include invoice generation because accounting documents are outside this report foundation.

Sprint 6E does not include a billing engine because rate cards, billing periods, charge rules, approval workflow, and accounting handoff require a later approved scope.

Sprint 6E does not include export file generation because this sprint only creates read-only report screens.

Sprint 6E does not include confirm, post, or complete workflow actions because this report is for monitoring only.

## Next Sprint Recommendation

Recommended next sprint: Sprint 6F Monthly Storage Billing Summary Foundation.
