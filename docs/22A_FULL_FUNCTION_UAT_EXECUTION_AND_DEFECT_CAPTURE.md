# Phase 22A: Full Function UAT Execution and Defect Capture

## 1. UAT Baseline & Environment Information

| Property | Value |
| --- | --- |
| **Commit Baseline** | `[LATEST_COMMIT_HASH]` |
| **Vercel URL** | `[VERCEL_URL]` |
| **Supabase Project** | `[SUPABASE_PROJECT_URL]` |
| **Tester** | `[TESTER_NAME]` |
| **Date / Time** | `[DATE_TIME]` |
| **Browser / Device** | `[BROWSER_INFO]` |
| **Test Data Set** | `[UAT_DATASET_IDENTIFIER]` |
| **Evidence Folder** | `[LINK_TO_SHARED_DRIVE_EVIDENCE]` |
| **Defect Log** | `[LINK_TO_JIRA_OR_SHARED_SHEET]` |

---

## 2. Full Function UAT Scenarios

| ID | Module | Test Step | Input Data | Expected Result | Actual Result | Evidence Link | Defect ID | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **UAT-001** | Login | User logs in with valid credentials | User: test_admin, Pass: valid | User successfully lands on Dashboard. | | | | `[ ]` |
| **UAT-002** | Role/Perm | User tries to access unauthorized page | Basic user accesses Settings | Access denied / redirected. | | | | `[ ]` |
| **UAT-003** | Dashboard | View operational summary | View dashboard | KPIs load correctly. | | | | `[ ]` |
| **UAT-004** | Master Data | View Item Master | Click Item Master | Items list loads. | | | | `[ ]` |
| **UAT-005** | Receiving | Create Receiving Doc | Customer A, Item B | Document created in DRAFT. | | | | `[ ]` |
| **UAT-006** | Receiving (Handheld) | Scan receive items | Barcode 123 | Item added to Receive line. | | | | `[ ]` |
| **UAT-007** | Putaway | Confirm putaway | Lot X, Location Y | Status changes to IN_STORAGE. | | | | `[ ]` |
| **UAT-008** | Transfer | Move stock to new bin | Location Y to Z | Location updated, movement logged. | | | | `[ ]` |
| **UAT-009** | Adjustment | Adjust stock qty | Lot X, -1 Qty | Balance reduced by 1, ledger logged. | | | | `[ ]` |
| **UAT-010** | Lot / Pallet | View Lot Details | Select Lot X | Displays history and current location. | | | | `[ ]` |
| **UAT-011** | Stock Balance | Verify total qty | Filter Customer A | Accurate available stock matches ledger. | | | | `[ ]` |
| **UAT-012** | Withdrawal | Create Request | Customer A, 10 Qty | Request DRAFT created. | | | | `[ ]` |
| **UAT-013** | Reservation | Allocate stock | Select Request | Stock reserved, Available Qty reduced. | | | | `[ ]` |
| **UAT-014** | Picking | Confirm Picking | Scan reserved barcode | Status PICKED, moved to staging. | | | | `[ ]` |
| **UAT-015** | Post Outbound | Dispatch shipment | Confirm Dispatch | Status DISPATCHED, stock deducted. | | | | `[ ]` |
| **UAT-016** | Dispatch History | View past outbound | Select dispatched doc | Details and timestamps accurate. | | | | `[ ]` |
| **UAT-017** | Barcode Center | Generate barcodes | Generate 5 labels | Labels generated successfully. | | | | `[ ]` |
| **UAT-018** | Barcode Alias | Map alias barcode | Scan alias | Alias resolves to master item. | | | | `[ ]` |
| **UAT-019** | Scan Logs | Verify scanner history | View Logs | Scanner actions accurately recorded. | | | | `[ ]` |
| **UAT-020** | Movement Ledger | Trace stock trail | Select Lot X | All ins and outs show correctly. | | | | `[ ]` |
| **UAT-021** | Stock Aging | Verify aging report | Run Aging Report | Days in storage calculated correctly. | | | | `[ ]` |
| **UAT-022** | Operation Summary | View summary report | Run Operation Summary | In/Out totals accurate. | | | | `[ ]` |
| **UAT-023** | Users and Roles | Manage user | Edit user | User permissions updated. | | | | `[ ]` |
| **UAT-024** | Audit Log | Verify tracking | View system audit | Actions logged with user & timestamp. | | | | `[ ]` |
| **UAT-025** | Reports | Preview / Print | Print Receiving Slip | Print layout loads cleanly. | | | | `[ ]` |

*(Status values: PASS / PASS WITH ISSUE / FAIL / BLOCKED)*

---

## 3. End-to-End Stock Flow Validation

| Phase | Action / Metric | Expected State | Actual State | Variance |
| --- | --- | --- | --- | --- |
| 1 | Opening Balance | 0 pallets | | |
| 2 | Receiving | 10 pallets received | | |
| 3 | Putaway | 10 pallets in Bin A | | |
| 4 | Transfer | 5 pallets moved to Bin B | | |
| 5 | Adjustment | 1 pallet lost (-1) | | |
| 6 | Withdrawal Request | Request 4 pallets | | |
| 7 | Reservation | 4 pallets reserved | | |
| 8 | Picking | 4 pallets picked | | |
| 9 | Post Outbound | 4 pallets dispatched | | |
| 10 | Expected Closing Bal | 5 pallets remaining (10 - 1 - 4) | | |
| 11 | Actual Closing Bal | System displays 5 pallets | | |
| 12 | **Final Variance** | **0** | | |

---

## 4. Defect Log

| Defect ID | Severity | Module | Description | Expected | Actual | Evidence | Owner | Workaround | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| DEF-001 | [Severity] | [Module] | [Brief Description] | [Expected] | [Actual] | [Link] | [Name] | [Workaround] | [Open/Closed] |

**Severity Levels:**
- **Critical:** System crash, data loss, stock balance error, unable to process core flow.
- **High:** Major function broken, no workaround available.
- **Medium:** Feature broken but acceptable workaround exists.
- **Low:** Cosmetic UI issue, minor text error.

---

## 5. Go Live Blocker Rules

The following issues are strict **BLOCKERS** for Production Go Live:
- ❌ Login failure.
- ❌ Missing schema or table structure.
- ❌ Stock balance mismatch against movement ledger.
- ❌ Movement ledger reporting incorrect history.
- ❌ Dispatch cannot successfully deduct stock.
- ❌ Storage reports cannot accurately verify stock movement.
- ❌ Any **Critical** severity defect.
- ❌ Any issue requiring uncontrolled direct SQL edits to resolve.

*If any blocker is triggered, the system remains on HOLD.*

---

## 6. Go Live Readiness Assessment

- `[ ]` **READY FOR CONTROLLED GO LIVE**: All UAT Scenarios Passed. No Critical/High defects. Zero stock variance.
- `[ ]` **READY WITH CONDITIONS**: Minor defects exist but have approved operational workarounds.
- `[ ]` **HOLD**: Critical/High defects exist, or stock variance detected.
- `[ ]` **NOT READY**: System fundamentally unstable or missing critical flows.

---

## 7. Safety Statements & Operational Directives

> [!CAUTION]
> - This UAT document **does not** authorize Production Go Live.
> - **FINAL GO is NOT AUTHORIZED.**
> - Production remains **HOLD** until formal UAT sign-off is approved by business stakeholders.
> - UI polish is explicitly **PAUSED** until functional UAT results are verified.
> - Any Critical defect automatically triggers a **HOLD** state.
> - No destructive SQL or manual stock alterations are permitted.
