# 22L Transaction UAT Round 1 Actual Execution Record

## 1. Execution Summary
- **Execution Status:** PENDING ACTUAL EXECUTION
- **Tester:** [TESTER_NAME_PLACEHOLDER]
- **Date:** [DATE_PLACEHOLDER]
- **Environment:** Production-like Staging
- **Base URL:** https://tgd-wms.vercel.app
- **Browser:** Chromium / Google Chrome
- **Test data used:** [TEST_DATA_REF_PLACEHOLDER]
- **Evidence folder:** `uat-evidence/transaction-round-1/`
- **Overall result:** PENDING

## 2. Actual Result Table

| Scenario ID | Module | Expected result | Actual result | Evidence filename | Status | Defect ID | Retest required |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| 1 | Receiving | Draft created | | `22K_01_receiving_draft.png` | PENDING | | |
| 2 | Receiving | Line added | | `22K_02_receiving_line.png` | PENDING | | |
| 3 | Receiving | Document posted successfully | | `22K_03_receiving_post.png` | PENDING | | |
| 4 | Movement Ledger | Receiving entry logged | | `22K_04_receiving_ledger.png` | PENDING | | |
| 5 | Stock Balance | Balance increased at location | | `22K_05_stock_balance_after_receiving.png` | PENDING | | |
| 6 | Putaway | Putaway session created | | `22K_06_putaway_create.png` | PENDING | | |
| 7 | Putaway | Putaway complete | | `22K_07_putaway_confirm.png` | PENDING | | |
| 8 | Stock Balance | Location updated | | `22K_08_location_balance_after_putaway.png` | PENDING | | |
| 9 | Transfer | Transfer document drafted | | `22K_09_transfer_create.png` | PENDING | | |
| 10 | Transfer | Transfer posted | | `22K_10_transfer_post.png` | PENDING | | |
| 11 | Stock Balance | From -, To + location balance updated | | `22K_11_transfer_balance_check.png` | PENDING | | |
| 12 | Adjustment | Stock increased (Adj IN) | | `22K_12_adjustment_in.png` | PENDING | | |
| 13 | Adjustment | Stock decreased (Adj OUT) | | `22K_13_adjustment_out.png` | PENDING | | |
| 14 | Movement Ledger | Adjustments logged | | `22K_14_adjustment_ledger_check.png` | PENDING | | |
| 15 | Stock Aging | Aging reflects correct data | | `22K_15_stock_aging.png` | PENDING | | |
| 16 | System | Final summary ready | | `22K_16_final_summary.png` | PENDING | | |

*Note: Status options are PENDING / PASS / FAIL / BLOCKED.*

## 3. Defect Summary Table

| Defect ID | Scenario ID | Severity | Description | Evidence | Owner | Status | Retest result |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| | | | | | | | |

## 4. Final Decision
- **Transaction UAT Round 1:** PENDING ACTUAL EXECUTION
- **Browser Smoke:** PASSED
- **Production:** HOLD
- **FINAL GO:** NOT AUTHORIZED
