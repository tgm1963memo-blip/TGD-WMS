# Phase 22E: UAT Round 1 Actual Execution Result

## 1. Actual Environment Baseline

| Property | Value |
| --- | --- |
| **Commit Baseline** | `663ae0c Fix sticky layout report panels and compact visual balance` |
| **Vercel URL** | `[VERCEL_URL]` |
| **Supabase Project** | `[SUPABASE_PROJECT_URL]` |
| **Tester** | `[TESTER_NAME]` |
| **Test Date / Time** | `[DATE_TIME]` |
| **Browser / Device** | `[BROWSER_INFO]` |
| **Evidence Folder** | `[LINK_TO_SHARED_DRIVE_EVIDENCE]` |

---

## 2. Actual Round 1 Core Flow Execution Result

| Run ID | Scenario ID | Module | Actual Action Performed | Expected Result | Actual Result | Evidence Link | Defect ID | Status | Tester | Tested At |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| R1-001 | UAT-001 | Login | [Action] | Lands on Dashboard | [Actual] | [Link] | [Defect] | `[ ]` | [Name] | [Time] |
| R1-002 | UAT-002 | Role/Perm | [Action] | Correct menu visibility | [Actual] | [Link] | [Defect] | `[ ]` | [Name] | [Time] |
| R1-003 | UAT-004 | Master Data | [Action] | Master items populated | [Actual] | [Link] | [Defect] | `[ ]` | [Name] | [Time] |
| R1-004 | UAT-005 | Receiving | [Action] | Receive lines saved | [Actual] | [Link] | [Defect] | `[ ]` | [Name] | [Time] |
| R1-005 | UAT-007 | Putaway | [Action] | Status -> IN_STORAGE | [Actual] | [Link] | [Defect] | `[ ]` | [Name] | [Time] |
| R1-006 | UAT-011 | Stock Balance | [Action] | Balances match Putaway | [Actual] | [Link] | [Defect] | `[ ]` | [Name] | [Time] |
| R1-007 | UAT-008 | Transfer | [Action] | Moved to new bin | [Actual] | [Link] | [Defect] | `[ ]` | [Name] | [Time] |
| R1-008 | UAT-009 | Adjustment | [Action] | Qty adjusted, ledger logged | [Actual] | [Link] | [Defect] | `[ ]` | [Name] | [Time] |
| R1-009 | UAT-020 | Movement Ledger | [Action] | Ledger matches physical | [Actual] | [Link] | [Defect] | `[ ]` | [Name] | [Time] |
| R1-010 | UAT-025 | Basic Report | [Action] | Report preview loads | [Actual] | [Link] | [Defect] | `[ ]` | [Name] | [Time] |

*(Status values: PASS / PASS WITH ISSUE / FAIL / BLOCKED / NOT EXECUTED)*

---

## 3. Actual Core Stock Flow Result

| Phase | Metric | Expected Balance | Actual Balance | Variance | Status |
| --- | --- | --- | --- | --- | --- |
| 1 | Opening Balance | [Expected] | [Actual] | [Variance] | `[ ]` |
| 2 | Receiving Qty | [Expected] | [Actual] | [Variance] | `[ ]` |
| 3 | Putaway Qty | [Expected] | [Actual] | [Variance] | `[ ]` |
| 4 | Transfer Qty | [Expected] | [Actual] | [Variance] | `[ ]` |
| 5 | Adjustment In/Out | [Expected] | [Actual] | [Variance] | `[ ]` |
| 6 | **Final Core Flow Balance** | **[Expected]** | **[Actual]** | **[Variance]** | `[ ]` |

*(Status values: PASS / FAIL)*

---

## 4. Actual Movement Ledger Verification Check

| Document No | Movement Type | Product | Lot | Qty | Expected Ledger | Actual Ledger | Status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| [RCV-001] | RECEIVE | [Product] | [Lot] | [+Qty] | Staging Increased | [Actual] | `[ ]` |
| [PTW-001] | PUTAWAY | [Product] | [Lot] | [0] | Staging to Bin | [Actual] | `[ ]` |
| [TRF-001] | TRANSFER | [Product] | [Lot] | [0] | Bin A to Bin B | [Actual] | `[ ]` |
| [ADJ-001] | ADJ_OUT | [Product] | [Lot] | [-Qty] | Bin Reduced | [Actual] | `[ ]` |

*(Status values: PASS / FAIL)*

---

## 5. Actual Blocker Log

| Blocker ID | Module | Description | Severity | Impact | Owner | Workaround | Status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| BLK-001 | [Module] | [Description] | [Severity] | [Impact] | [Name] | [Workaround] | [Open/Closed] |

---

## 6. Actual Defect Log

| Defect ID | Severity | Module | Expected | Actual | Evidence | Owner | Required before Go Live? | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| DEF-001 | [Severity] | [Module] | [Expected] | [Actual] | [Link] | [Name] | [Yes/No] | [Open/Closed] |

---

## 7. Execution Summary

| Result Type | Count |
| --- | --- |
| **Total Scenarios** | 10 |
| **PASS** | 0 |
| **PASS WITH ISSUE** | 0 |
| **FAIL** | 0 |
| **BLOCKED** | 0 |
| **NOT EXECUTED** | 0 |
| **Critical Defects** | 0 |
| **High Defects** | 0 |
| **Medium Defects** | 0 |
| **Low Defects** | 0 |

---

## 8. Round 1 Decision

- `[ ]` **CONTINUE TO ROUND 2**: Core flows passed with no critical variance.
- `[ ]` **CONTINUE WITH ISSUES**: Core flows passed but minor bugs/UI issues need tracking.
- `[ ]` **HOLD FOR FIX**: Critical defect found in core logic or stock variance detected.
- `[ ]` **NOT READY**: System crashed during core flow test.

---

## 9. Safety Statements & Operational Directives

> [!CAUTION]
> - This UAT result **does not** authorize Production Go Live.
> - **FINAL GO is NOT AUTHORIZED.**
> - Production remains **HOLD** until formal UAT sign-off is approved by business stakeholders.
> - Any Critical defect automatically triggers a **HOLD** state.
> - Stock mismatch triggers **HOLD**.
> - Schema/table missing error triggers **HOLD**.
