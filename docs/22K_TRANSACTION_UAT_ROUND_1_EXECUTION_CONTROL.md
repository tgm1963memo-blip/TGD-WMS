# 22K Transaction UAT Round 1 Execution Control

## 1. Execution Status
- **Execution Status:** PENDING
- **Tester:** [TESTER_NAME_PLACEHOLDER]
- **Date:** [DATE_PLACEHOLDER]
- **Environment:** Production-like Staging
- **Base URL:** https://tgd-wms.vercel.app
- **Browser:** Chromium / Google Chrome
- **Test data set:** Standard Round 1 Data
- **Evidence folder:** `uat-evidence/transaction-round-1/`
- **Final decision:** PENDING

## 2. Strict Pass/Fail Rules
- **PASS:** Only when the browser action succeeds AND ledger/balance evidence exactly matches expectations.
- **FAIL:** When UI action fails, RPC fails, data is not saved, or expected ledger/balance is missing or incorrect.
- **BLOCKED:** When prerequisite master data, user role, or environment is unavailable.
- **Rule 1:** Stock movement cannot be marked PASS without movement ledger evidence.
- **Rule 2:** Stock balance cannot be marked PASS without balance verification evidence.
- **Rule 3:** Report screen cannot be marked PASS if it shows schema/RPC/table/permission errors.

## 3. Scenario Execution Table

| Scenario ID | Module | Action | Test data | Expected result | Actual result | Evidence screenshot | Status | Defect ID |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| 1 | Receiving | Draft creation | [DATA] | Draft created | | 22K_01_receiving_draft.png | PENDING | |
| 2 | Receiving | Line entry | [DATA] | Line added | | 22K_02_receiving_line.png | PENDING | |
| 3 | Receiving | Post/confirm | [DATA] | Posted successfully | | 22K_03_receiving_post.png | PENDING | |
| 4 | Movement Ledger | Verification | N/A | Entry logged | | 22K_04_receiving_ledger.png | PENDING | |
| 5 | Stock Balance | Increase verification | N/A | Balance increased | | 22K_05_stock_balance_after_receiving.png | PENDING | |
| 6 | Putaway | Document/session | [DATA] | Session created | | 22K_06_putaway_create.png | PENDING | |
| 7 | Putaway | Confirm | [DATA] | Putaway complete | | 22K_07_putaway_confirm.png | PENDING | |
| 8 | Stock Balance | Location movement verification | N/A | Location updated | | 22K_08_location_balance_after_putaway.png | PENDING | |
| 9 | Transfer | Document creation | [DATA] | Document drafted | | 22K_09_transfer_create.png | PENDING | |
| 10 | Transfer | Post | [DATA] | Transfer posted | | 22K_10_transfer_post.png | PENDING | |
| 11 | Stock Balance | From/to location balance verification | N/A | From -, To + | | 22K_11_transfer_balance_check.png | PENDING | |
| 12 | Adjustment | IN creation | [DATA] | Stock increased | | 22K_12_adjustment_in.png | PENDING | |
| 13 | Adjustment | OUT creation | [DATA] | Stock decreased | | 22K_13_adjustment_out.png | PENDING | |
| 14 | Movement Ledger | After adjustment check | N/A | Adj logged | | 22K_14_adjustment_ledger_check.png | PENDING | |
| 15 | Reports | Stock Aging report check | N/A | Aging correct | | 22K_15_stock_aging.png | PENDING | |
| 16 | System | Final transaction evidence summary | N/A | Summary ready | | 22K_16_final_summary.png | PENDING | |

## 4. Defect Log Table

| Defect ID | Scenario ID | Module | Severity | Observed result | Expected result | Evidence | Owner | Status | Retest required |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| | | | | | | | | | |

## 5. Final Decision
- **Transaction UAT Round 1:** PENDING EXECUTION
- **Browser Smoke:** PASSED
- **Production:** HOLD
- **FINAL GO:** NOT AUTHORIZED
