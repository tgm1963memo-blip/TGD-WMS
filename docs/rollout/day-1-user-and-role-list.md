# Day 1 User And Role List

## Purpose

This document records the Day 1 controlled rollout users, departments, expected roles, allowed modules, exclusions, training status, UAT participation, and access verification.

## User And Role Table

| User ID | Name | Department | Role | Expected system role | Allowed modules | Not allowed modules | Training completed | UAT participated | Access verified | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| U-ADMIN-001 | To be filled | Admin / Controller | Admin / Controller | admin | All approved Day 1 modules and admin review pages | Invoice generation; Accounting post; ERP inventory sync; Express sync; production logo upload | Yes / No | Yes / No | Yes / No |  |
| U-WHM-001 | To be filled | Warehouse | Warehouse Manager | warehouse_manager | Master Data review; Receiving; Putaway; Transfer; Adjustment; Stock Count; Customer Withdrawal; Allocation; Picking; Dispatch / Goods Issue; reports | Accounting post; Invoice generation; ERP inventory sync; production branding persistence | Yes / No | Yes / No | Yes / No |  |
| U-WHS-001 | To be filled | Warehouse | Warehouse Staff | warehouse_staff | Receiving; Putaway; Transfer; Customer Withdrawal; Allocation; Picking; Dispatch / Goods Issue as assigned | Accounting Charge Review; admin pages; Accounting post; Invoice generation | Yes / No | Yes / No | Yes / No |  |
| U-ACC-001 | To be filled | Accounting | Accounting | accounting | Reports; Monthly Storage Billing Summary; Accounting Charge Review as review-only | Warehouse mutation outside approved scope; Invoice generation; Accounting post; ERP connector | Yes / No | Yes / No | Yes / No |  |
| U-VIEW-001 | To be filled | Management / Review | Viewer | viewer | Approved read-only reports | Operation entry; admin pages; Accounting post; Invoice generation | Yes / No | Yes / No | Yes / No |  |
| U-IT-001 | To be filled | IT / Technical | IT / Technical support | admin or support role to be confirmed | Support, monitoring, issue triage, rollback support | Unapproved data changes; SQL execution without approval; production data changes | Yes / No | Yes / No | Yes / No |  |

## Required Role Groups

- admin
- warehouse_manager
- warehouse_staff
- accounting
- viewer
- IT / Technical support

## Verification Notes

- Each user must have access verified before Day 1 starts.
- Users without completed training should not operate live controlled workflow.
- Role mismatch must be logged as a rollout issue.
- Demo role selector must not be treated as production authentication.
