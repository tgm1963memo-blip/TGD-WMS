# Day 1 Support Checklist

## Purpose

This checklist supports Day 1 controlled rollout monitoring for TGD WMS.

## Support Owner

| Support role | Name | Contact |
| --- | --- | --- |
| Primary support owner | To be filled | To be filled |
| Warehouse support | To be filled | To be filled |
| Accounting support | To be filled | To be filled |
| Admin / Controller support | To be filled | To be filled |
| IT / Technical support | To be filled | To be filled |

## Contact Channel Placeholder

| Channel | Detail |
| --- | --- |
| Primary support channel | To be filled |
| Emergency escalation channel | To be filled |
| Evidence storage location | To be filled |

## Start-of-day Checks

| Check ID | Check | Owner | Actual result | Status | Evidence / notes |
| --- | --- | --- | --- | --- | --- |
| D1-SOD-001 | Confirm environment URL is accessible | IT / Technical |  | Pass / Fail / Blocked |  |
| D1-SOD-002 | Confirm latest approved release is deployed | IT / Technical |  | Pass / Fail / Blocked |  |
| D1-SOD-003 | Confirm support contacts are available | Admin / Controller |  | Pass / Fail / Blocked |  |
| D1-SOD-004 | Confirm rollback plan is available | IT / Technical |  | Pass / Fail / Blocked |  |

## User Login / Access Checks

| Check ID | User group | Expected result | Actual result | Status | Evidence / notes |
| --- | --- | --- | --- | --- | --- |
| D1-ACC-001 | Warehouse Manager | Can access assigned warehouse operation areas |  | Pass / Fail / Blocked |  |
| D1-ACC-002 | Warehouse Staff | Can access assigned operation pages |  | Pass / Fail / Blocked |  |
| D1-ACC-003 | Accounting | Can access accounting review reports |  | Pass / Fail / Blocked |  |
| D1-ACC-004 | Admin / Controller | Can review role visibility and config status |  | Pass / Fail / Blocked |  |
| D1-ACC-005 | Viewer | Can access approved read-only reports only |  | Pass / Fail / Blocked |  |

## Role Visibility Checks

| Check ID | Check | Expected result | Actual result | Status | Evidence / notes |
| --- | --- | --- | --- | --- | --- |
| D1-ROLE-001 | Admin report visibility | Admin sees all approved report cards |  | Pass / Fail / Blocked |  |
| D1-ROLE-002 | Accounting report visibility | Accounting sees general reports and Accounting Charge Review |  | Pass / Fail / Blocked |  |
| D1-ROLE-003 | Viewer report visibility | Viewer sees read-only reports only |  | Pass / Fail / Blocked |  |
| D1-ROLE-004 | Warehouse Staff accounting visibility | Warehouse Staff does not see accounting-only review cards |  | Pass / Fail / Blocked |  |

## Document Branding Preview Check

| Check ID | Check | Expected result | Actual result | Status | Evidence / notes |
| --- | --- | --- | --- | --- | --- |
| D1-BRAND-001 | Thai branding preview | Thai company/document branding preview renders |  | Pass / Fail / Blocked |  |
| D1-BRAND-002 | English branding preview | English company/document branding preview renders |  | Pass / Fail / Blocked |  |
| D1-BRAND-003 | Missing logo fallback | Preview remains usable if no logo is configured |  | Pass / Fail / Blocked |  |

## Core Operation Checks

| Check ID | Operation | Expected result | Actual result | Status | Evidence / notes |
| --- | --- | --- | --- | --- | --- |
| D1-OPS-001 | Receiving | Receiving page and selected records can be reviewed |  | Pass / Fail / Blocked |  |
| D1-OPS-002 | Putaway | Putaway page and selected records can be reviewed |  | Pass / Fail / Blocked |  |
| D1-OPS-003 | Transfer | Transfer page and selected records can be reviewed |  | Pass / Fail / Blocked |  |
| D1-OPS-004 | Adjustment | Adjustment page and selected records can be reviewed |  | Pass / Fail / Blocked |  |
| D1-OPS-005 | Stock Count | Stock Count page and selected records can be reviewed |  | Pass / Fail / Blocked |  |
| D1-OPS-006 | Customer Withdrawal | Customer Withdrawal page and selected records can be reviewed |  | Pass / Fail / Blocked |  |
| D1-OPS-007 | Picking | Picking page and selected records can be reviewed |  | Pass / Fail / Blocked |  |
| D1-OPS-008 | Dispatch / Goods Issue | Dispatch / Goods Issue page and selected records can be reviewed |  | Pass / Fail / Blocked |  |

## Report Checks

| Check ID | Report | Expected result | Actual result | Status | Evidence / notes |
| --- | --- | --- | --- | --- | --- |
| D1-RPT-001 | Inventory Dashboard | Loads and shows customer-owned inventory summary |  | Pass / Fail / Blocked |  |
| D1-RPT-002 | Movement Ledger | Loads Customer Stock Movement rows |  | Pass / Fail / Blocked |  |
| D1-RPT-003 | Customer Storage Balance | Loads balance report for customer-owned inventory |  | Pass / Fail / Blocked |  |
| D1-RPT-004 | Storage Aging | Loads lot, expiry, and chargeable days preview |  | Pass / Fail / Blocked |  |
| D1-RPT-005 | Monthly Storage Billing Summary | Loads review-only billing summary |  | Pass / Fail / Blocked |  |

## Accounting Review Checks

| Check ID | Check | Expected result | Actual result | Status | Evidence / notes |
| --- | --- | --- | --- | --- | --- |
| D1-ACC-REV-001 | Accounting Charge Review visible to accounting | Accounting can review charge summary data |  | Pass / Fail / Blocked |  |
| D1-ACC-REV-002 | Review-only behavior | No invoice generation or accounting post action exists |  | Pass / Fail / Blocked |  |
| D1-ACC-REV-003 | Manual handoff assumption | Accounting notes are captured for external review process |  | Pass / Fail / Blocked |  |

## Issue Logging

| Issue ID | Time | User | Area | Description | Severity | Owner | Status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| D1-ISS-001 |  |  |  |  | Critical / High / Medium / Low |  | Open |

## Escalation Rules

| Severity | Escalation rule |
| --- | --- |
| Critical | Stop affected operation and notify Business Owner, Admin / Controller, and IT / Technical immediately |
| High | Notify Admin / Controller and module owner within the same support window |
| Medium | Log and assign owner; continue only if workaround is accepted |
| Low | Log for improvement backlog |

## End-of-day Summary

| Summary item | Result | Notes |
| --- | --- | --- |
| Total issues logged | To be filled |  |
| Critical issues | To be filled |  |
| High issues | To be filled |  |
| Operations completed | To be filled |  |
| Reports reviewed | To be filled |  |
| Accounting review completed | To be filled |  |
| Rollback considered? | Yes / No |  |

## Next-day Improvement List

| Item ID | Improvement | Owner | Target date | Status |
| --- | --- | --- | --- | --- |
| D1-IMP-001 | To be filled | To be filled | To be filled | Open |
