# 22J Transaction UAT Round 1 Preparation

## 1. Objective
Prepare a controlled Transaction UAT Round 1 plan for testing real operational workflows through the browser, including document creation, posting, and verification against the movement ledger and stock balance.

## 2. Environment
- **Base URL:** https://tgd-wms.vercel.app
- **Browser:** Chromium via Playwright / Manual Tester
- **Execution Mode:** UI execution

## 3. Execution Details
- **Tester:** [TESTER_NAME_PLACEHOLDER]
- **Date/Time:** [DATE_TIME_PLACEHOLDER]

## 4. Preconditions & Strict Rules
- **No direct stock balance update:** Under no circumstances should the stock balance be manually updated or edited via the database.
- **Strict rule:** All stock changes must come from RPC calls or the movement ledger.
- The environment must be accessible, and the tester must have appropriate permissions to perform receiving, putaway, transfer, and adjustment operations.

## 5. Required Test Data
| Field | Value |
| :--- | :--- |
| **Product** | [PRODUCT_PLACEHOLDER] |
| **Customer** | [CUSTOMER_PLACEHOLDER] |
| **Warehouse** | [WAREHOUSE_PLACEHOLDER] |
| **Receiving Location** | [RECEIVING_LOCATION_PLACEHOLDER] |
| **Putaway Location** | [PUTAWAY_LOCATION_PLACEHOLDER] |
| **Transfer From Location**| [TRANSFER_FROM_LOCATION_PLACEHOLDER] |
| **Transfer To Location** | [TRANSFER_TO_LOCATION_PLACEHOLDER] |
| **Lot Number** | [LOT_NUMBER_PLACEHOLDER] |
| **Pallet Number** | [PALLET_NUMBER_PLACEHOLDER] |
| **Quantity** | [QUANTITY_PLACEHOLDER] |
| **UOM** | [UOM_PLACEHOLDER] |
| **Reason Code** | [REASON_CODE_PLACEHOLDER] |

## 6. Scenario-by-Scenario Checklist
1. [ ] **Receiving draft creation:** Create a new receiving document in draft status.
2. [ ] **Receiving line entry:** Add item lines to the receiving draft with valid quantities and lot numbers.
3. [ ] **Receiving post/confirm:** Post the receiving document to finalize inbound transaction.
4. [ ] **Verify receiving movement ledger:** Check the movement ledger to ensure the receiving transaction was logged correctly.
5. [ ] **Verify stock balance increase:** Check the stock balance report to confirm inventory increased at the receiving location.
6. [ ] **Putaway document/session:** Create or initiate a putaway session.
7. [ ] **Putaway confirm:** Confirm the putaway movement from the receiving location to the storage location.
8. [ ] **Verify location movement:** Verify the stock balance reflects the correct storage location and the receiving location is decremented.
9. [ ] **Transfer document:** Create a transfer document to move stock between storage locations.
10. [ ] **Transfer post:** Post the transfer document to execute the movement.
11. [ ] **Verify from/to location balance:** Confirm stock balance decreased at the 'from' location and increased at the 'to' location.
12. [ ] **Adjustment IN:** Create and post an adjustment document to increase stock for a specific reason.
13. [ ] **Adjustment OUT:** Create and post an adjustment document to decrease stock for a specific reason.
14. [ ] **Verify movement ledger after adjustment:** Check the movement ledger to ensure adjustment transactions were logged correctly.
15. [ ] **Stock Aging report check:** Verify that stock aging reflects the newly received and adjusted inventory accurately.
16. [ ] **Final transaction evidence summary:** Compile all screenshots and logs as final evidence.

## 7. Evidence Required
| Screenshot Filename | Page/Module | Action Performed | Expected Result | Actual Result | Status | Remarks |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `01_recv_draft.png` | Receiving | Create Draft | Draft created | | | |
| `02_recv_line.png` | Receiving | Add Line | Line added | | | |
| `03_recv_post.png` | Receiving | Post Document | Document posted | | | |
| `04_recv_ledger.png` | Movement Ledger | Check Ledger | Entry exists | | | |
| `05_recv_balance.png` | Stock Balance | Check Balance | Balance increased | | | |
| `06_putaway_create.png`| Putaway | Create Session | Session active | | | |
| `07_putaway_post.png` | Putaway | Confirm Putaway | Location moved | | | |
| `08_putaway_balance.png`| Stock Balance | Check Balance | Location updated | | | |
| `09_transfer_doc.png` | Transfer | Create Document | Transfer drafted | | | |
| `10_transfer_post.png` | Transfer | Post Transfer | Stock moved | | | |
| `11_transfer_balance.png`| Stock Balance | Check Balance | Balance updated | | | |
| `12_adj_in.png` | Adjustment | Post Adj IN | Stock increased | | | |
| `13_adj_out.png` | Adjustment | Post Adj OUT | Stock decreased | | | |
| `14_adj_ledger.png` | Movement Ledger | Check Ledger | Adj logged | | | |
| `15_stock_aging.png` | Stock Aging | View Report | Aging correct | | | |

## 8. Defect Log
| Defect ID | Module | Severity | Observed Result | Expected Result | Evidence | Owner | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| | | | | | | | |

## 9. Rollback/Cleanup Rule
If any severe blocking issue occurs, testing should be halted. No manual SQL deletes or truncates are allowed. Revert to a clean snapshot if a reset is required.

## 10. Final Decision
- **Transaction UAT:** PENDING EXECUTION
- **Production:** HOLD
- **FINAL GO:** NOT AUTHORIZED
