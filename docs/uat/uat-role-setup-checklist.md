# UAT Role Setup Checklist

This checklist is for planning and verification only. It does not change permission logic.

## Role List And Expectations

| Role | User account placeholder | Permission expectation | Reports visibility expectation | Accounting review visibility expectation | Thai/English access expectation | Admin/controller expectation | Status | Notes |
|---|---|---|---|---|---|---|---|---|
| admin | `uat.admin@tgd.test` | Full admin/controller review access | All report cards visible | Accounting review cards visible | Can review Thai and English labels | Can support Go/No-Go and config review | Not Prepared |  |
| warehouse_manager | `uat.wh.manager@tgd.test` | Warehouse operation supervision and exception review | Warehouse operation and general reports visible | Accounting review cards hidden unless explicitly allowed | Can review Thai and English labels | Can sign warehouse readiness | Not Prepared |  |
| warehouse_staff | `uat.wh.staff@tgd.test` | Warehouse operation execution | General operational visibility only | Accounting review cards hidden | Can use Thai and English where needed | No admin/controller function | Not Prepared |  |
| accounting | `uat.accounting@tgd.test` | Accounting Charge Review and billing summary review | General reports visible | Accounting review cards visible | Can review Thai and English labels | Can sign accounting readiness | Not Prepared |  |
| viewer | `uat.viewer@tgd.test` | Read-only viewing | General read-only reports visible | Accounting review cards hidden | Can review Thai and English labels | No admin/controller function | Not Prepared |  |

## Role Setup Verification Steps

| Step | Action | Expected Result | Actual Result | Status: Pass / Fail / Blocked | Evidence / Notes |
|---|---|---|---|---|---|
| 1 | Prepare test account for each role. | All role accounts are available. |  |  |  |
| 2 | Sign in or switch to admin role. | Admin sees all report cards and admin/controller review areas. |  |  |  |
| 3 | Sign in or switch to warehouse_manager role. | Warehouse manager sees warehouse operation areas and expected reports. |  |  |  |
| 4 | Sign in or switch to warehouse_staff role. | Warehouse staff can access assigned warehouse operation pages and does not see accounting review cards. |  |  |  |
| 5 | Sign in or switch to accounting role. | Accounting sees general reports plus accounting review cards. |  |  |  |
| 6 | Sign in or switch to viewer role. | Viewer sees general read-only reports only. |  |  |  |
| 7 | Check Thai default language for each role. | Thai labels are available by default. |  |  |  |
| 8 | Switch to English for each role. | English labels are available for review. |  |  |  |
| 9 | Record role visibility evidence. | Screenshots/evidence are attached to UAT records. |  |  |  |
