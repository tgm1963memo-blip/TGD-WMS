# Phase 22D: UAT Execution Round 1 - Core Flow Testing

## 1. Actual Environment Baseline

| Property | Value |
| --- | --- |
| **Commit Baseline** | `[LATEST_COMMIT_HASH]` |
| **Vercel URL** | `[VERCEL_URL]` |
| **Supabase Project** | `[SUPABASE_PROJECT_URL]` |
| **Tester** | `[TESTER_NAME]` |
| **Test Date / Time** | `[DATE_TIME]` |
| **Browser / Device** | `[BROWSER_INFO]` |
| **Evidence Folder** | `[LINK_TO_SHARED_DRIVE_EVIDENCE]` |

---

## 2. Round 1 Core Flow Execution Result

| Run ID | Scenario ID | Module | Actual Action Performed | Expected Result | Actual Result | Evidence Link | Defect ID | Status | Tester | Tested At |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| R1-001 | UAT-001 | Login | [Action] | Lands on Dashboard | [Actual] | [Link] | [Defect] | `[ ]` | [Name] | [Time] |
| R1-002 | UAT-002 | Role/Perm | [Action] | Correct menu visibility | [Actual] | [Link] | [Defect] | `[ ]` | [Name] | [Time] |
| R1-003 | UAT-004 | Master Data | [Action] | Master items populated | [Actual] | [Link] | [Defect] | `[ ]` | [Name] | [Time] |
| R1-004 | UAT-005 | Receiving | [Action] | Receive lines saved | [Actual] | [Link] | [Defect] | `[ ]` | [Name] | [Time] |
| R1-005 | UAT-007 | Putaway | [Action] | Status -> IN_STORAGE | [Actual] | [Link] | [Defect] | `[ ]` | [Name] | [Time] |
| R1-006 | UAT-011 | Stock Balance | [Action] | Balances match Putaway | [Actual] | [Link] | [Defect] | `[ ]` | [Name] | [Time] |
| R1-007 | UAT-008 | Transfer | [Action] | Moved to new bin | [Actual] | [Link] | [Defect] | `[ ]` | [Name] | [Time] |
| R1-008 | UAT-009 | Adjustment | [Action] | Qty adjusted, ledger logged| [Actual] | [Link] | [Defect] | `[ ]` | [Name] | [Time] |
| R1-009 | UAT-020 | Movement Ledger | [Action] | Ledger matches physical | [Actual] | [Link] | [Defect] | `[ ]` | [Name] | [Time] |
| R1-010 | UAT-025 | Basic Report | [Action] | Report preview loads | [Actual] | [Link] | [Defect] | `[ ]` | [Name] | [Time] |

*(Status values: PASS / PASS WITH ISSUE / FAIL / BLOCKED)*

---

## 3. Core Stock Flow Result

| Phase | Metric | Expected Balance | Actual Balance | Variance | Status |
| --- | --- | --- | --- | --- | --- |
| 1 | Opening Balance | [Expected] | [Actual] | [Variance] | `[ ]` |
| 2 | Receiving Qty | [Expected] | [Actual] | [Variance] | `[ ]` |
| 3 | Putaway Qty | [Expected] | [Actual] | [Variance] | `[ ]` |
| 4 | Transfer Qty | [Expected] | [Actual] | [Variance] | `[ ]` |
| 5 | Adjustment In/Out | [Expected] | [Actual] | [Variance] | `[ ]` |
| 6 | **Final Core Flow Balance**| **[Expected]** | **[Actual]** | **[Variance]** | `[ ]` |

*(Status values: PASS / FAIL)*

---

## 4. Movement Ledger Verification Check

| Document No | Movement Type | Product | Lot | Qty | Expected Ledger | Actual Ledger | Status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| [RCV-001] | RECEIVE | [Product A] | [Lot X] | [+10] | +10 in Staging | [Actual] | `[ ]` |
| [PTW-001] | PUTAWAY | [Product A] | [Lot X] | [0] | Move from Staging to Bin | [Actual] | `[ ]` |
| [TRF-001] | TRANSFER | [Product A] | [Lot X] | [0] | Move from Bin A to Bin B | [Actual] | `[ ]` |
| [ADJ-001] | ADJ_OUT | [Product A] | [Lot X] | [-1] | -1 in Bin B | [Actual] | `[ ]` |

*(Status values: PASS / FAIL)*

---

## 5. Round 1 Blocker Log

| Blocker ID | Module | Description | Severity | Impact | Owner | Workaround | Status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| BLK-R1-01 | [Module] | [Description] | [Severity] | [Impact Details] | [Name] | [Workaround] | [Open/Closed] |

---

## 6. Round 1 Decision

- `[ ]` **CONTINUE TO ROUND 2**: Core flows passed with no critical variance.
- `[ ]` **CONTINUE WITH ISSUES**: Core flows passed but minor bugs/UI issues need tracking.
- `[ ]` **HOLD FOR FIX**: Critical defect found in core logic or stock variance detected.
- `[ ]` **NOT READY**: System crashed during core flow test.

---

## 7. Safety Statements & Operational Directives

> [!CAUTION]
> - This UAT round **does not** authorize Production Go Live.
> - **FINAL GO is NOT AUTHORIZED.**
> - Production remains **HOLD** until formal UAT sign-off is approved by business stakeholders.
> - Any Critical defect automatically triggers a **HOLD** state.
> - Stock mismatch triggers **HOLD**.
> - Schema/table missing error triggers **HOLD**.
