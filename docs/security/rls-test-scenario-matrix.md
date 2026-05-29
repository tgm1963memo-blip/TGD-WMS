# RLS Test Scenario Matrix

## Purpose

This matrix defines role-based backend/RLS test scenarios that must be evidenced before production readiness can be accepted.

## Scenario Matrix

| Scenario ID | Role | Area | Action | Expected result | Evidence required | Status | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| RLS-001 | admin | Master Data | Read and manage approved master data | Allowed according to admin scope | Screenshot/log/evidence | Not Tested / Pass / Fail / Blocked |  |
| RLS-002 | warehouse_manager | Master Data | Read master data | Allowed read access | Screenshot/log/evidence | Not Tested / Pass / Fail / Blocked |  |
| RLS-003 | warehouse_staff | Master Data | Attempt protected master data write | Denied unless explicitly approved | Denial evidence | Not Tested / Pass / Fail / Blocked |  |
| RLS-004 | accounting | Master Data | Read required reference data | Allowed read-only if required | Screenshot/log/evidence | Not Tested / Pass / Fail / Blocked |  |
| RLS-005 | viewer | Master Data | Attempt protected write | Denied | Denial evidence | Not Tested / Pass / Fail / Blocked |  |
| RLS-006 | unauthenticated | Master Data | Attempt access | Denied | Denial evidence | Not Tested / Pass / Fail / Blocked |  |
| RLS-007 | warehouse_staff | Receiving | Create/update within approved workflow | Allowed only within role/workflow scope | Workflow evidence | Not Tested / Pass / Fail / Blocked |  |
| RLS-008 | accounting | Receiving | Attempt write | Denied | Denial evidence | Not Tested / Pass / Fail / Blocked |  |
| RLS-009 | viewer | Receiving | Attempt write | Denied | Denial evidence | Not Tested / Pass / Fail / Blocked |  |
| RLS-010 | warehouse_staff | Putaway | Create/update within approved workflow | Allowed only within role/workflow scope | Workflow evidence | Not Tested / Pass / Fail / Blocked |  |
| RLS-011 | accounting | Putaway | Attempt write | Denied | Denial evidence | Not Tested / Pass / Fail / Blocked |  |
| RLS-012 | warehouse_staff | Transfer | Create/update within approved workflow | Allowed only within role/workflow scope | Workflow evidence | Not Tested / Pass / Fail / Blocked |  |
| RLS-013 | warehouse_manager | Adjustment | Create/review adjustment within approved scope | Allowed for approved manager scope | Workflow evidence | Not Tested / Pass / Fail / Blocked |  |
| RLS-014 | viewer | Adjustment | Attempt write | Denied | Denial evidence | Not Tested / Pass / Fail / Blocked |  |
| RLS-015 | warehouse_manager | Stock Count | Create/review stock count | Allowed for approved scope | Workflow evidence | Not Tested / Pass / Fail / Blocked |  |
| RLS-016 | accounting | Stock Count | Attempt warehouse write | Denied unless explicitly approved | Denial evidence | Not Tested / Pass / Fail / Blocked |  |
| RLS-017 | warehouse_staff | Customer Withdrawal | Create/update within approved workflow | Allowed only within role/workflow scope | Workflow evidence | Not Tested / Pass / Fail / Blocked |  |
| RLS-018 | accounting | Customer Withdrawal | Attempt write | Denied | Denial evidence | Not Tested / Pass / Fail / Blocked |  |
| RLS-019 | warehouse_staff | Allocation | Create/update within approved workflow | Allowed only within role/workflow scope | Workflow evidence | Not Tested / Pass / Fail / Blocked |  |
| RLS-020 | warehouse_staff | Picking | Create/update within approved workflow | Allowed only within role/workflow scope | Workflow evidence | Not Tested / Pass / Fail / Blocked |  |
| RLS-021 | warehouse_staff | Dispatch / Goods Issue | Create/update within approved workflow | Allowed only within role/workflow scope | Workflow evidence | Not Tested / Pass / Fail / Blocked |  |
| RLS-022 | accounting | Dispatch / Goods Issue | Attempt write | Denied | Denial evidence | Not Tested / Pass / Fail / Blocked |  |
| RLS-023 | viewer | Inventory Dashboard | Read approved report | Allowed read-only | Screenshot/log/evidence | Not Tested / Pass / Fail / Blocked |  |
| RLS-024 | viewer | Movement Ledger | Read approved report | Allowed read-only | Screenshot/log/evidence | Not Tested / Pass / Fail / Blocked |  |
| RLS-025 | viewer | Customer Storage Balance | Read approved report | Allowed read-only | Screenshot/log/evidence | Not Tested / Pass / Fail / Blocked |  |
| RLS-026 | viewer | Storage Aging | Read approved report | Allowed read-only | Screenshot/log/evidence | Not Tested / Pass / Fail / Blocked |  |
| RLS-027 | accounting | Monthly Storage Billing Summary | Read review-only report | Allowed read-only | Screenshot/log/evidence | Not Tested / Pass / Fail / Blocked |  |
| RLS-028 | warehouse_staff | Monthly Storage Billing Summary | Attempt accounting-only access | Denied or hidden unless approved | Denial evidence | Not Tested / Pass / Fail / Blocked |  |
| RLS-029 | accounting | Accounting Charge Review | Read review-only data | Allowed read-only | Screenshot/log/evidence | Not Tested / Pass / Fail / Blocked |  |
| RLS-030 | warehouse_staff | Accounting Charge Review | Attempt access | Denied or hidden | Denial evidence | Not Tested / Pass / Fail / Blocked |  |
| RLS-031 | admin | Audit Logs | Read audit logs | Allowed if approved | Screenshot/log/evidence | Not Tested / Pass / Fail / Blocked |  |
| RLS-032 | warehouse_staff | Audit Logs | Attempt edit or restricted read | Denied | Denial evidence | Not Tested / Pass / Fail / Blocked |  |
| RLS-033 | accounting | Audit Logs | Attempt restricted edit | Denied | Denial evidence | Not Tested / Pass / Fail / Blocked |  |
| RLS-034 | admin | Admin Config | Read admin config | Allowed | Screenshot/log/evidence | Not Tested / Pass / Fail / Blocked |  |
| RLS-035 | viewer | Admin Config | Attempt access | Denied | Denial evidence | Not Tested / Pass / Fail / Blocked |  |
| RLS-036 | unauthenticated | Admin Config | Attempt access | Denied | Denial evidence | Not Tested / Pass / Fail / Blocked |  |
