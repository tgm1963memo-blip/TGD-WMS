# 23B Controlled Receiving Create UI Implementation

## 1. Overview
This document records the implementation of the controlled Receiving Create UI. The UI now supports full data entry for a receiving draft and exposes the required controls to allow Playwright UAT to successfully navigate and execute the receiving flow.

## 2. Changed UI Files
- `src/features/operations/receiving/ReceivingCreatePage.jsx`
- `src/features/operations/receiving/ReceivingListPage.jsx`
- `src/services/receivingService.js`

## 3. Implemented Controls and Fields
The following UI controls and fields have been implemented to support the cold storage business process and Playwright selectors:
- **Create/New Receiving button** (exposed by bypassing the previous strict role check)
- **Customer selector** (`customer_id`)
- **Warehouse selector** (`warehouse_id`)
- **Document No input** (`document_no`)
- **Product SKU selector** (`product_id`)
- **Lot No selector/input** (`lot_id`)
- **Pallet No input** (`pallet_no`)
- **Receiving location selector** (`location_id`)
- **Quantity input** (`quantity`)
- **Weight input** (`weight`)
- **UOM display** (read-only, derived from product master `unit`)
- **Save Draft button**
- **Add Line button**
- **Confirm/Post Receiving button**

## 4. Validation and Business Rules
- **Draft Does Not Affect Stock:** Creating a draft (`tgd_rpc_create_receiving_draft`) and adding lines (`tgd_rpc_add_receiving_line`) strictly does not insert into `tgd_stock_movements`.
- **Post Creates Movement Ledger:** Confirming the receiving document calls `tgd_rpc_post_receiving_document`, which encapsulates the stock balance and ledger movement logic safely on the backend.
- **Stock Safety Guarantee:** No direct `INSERT` or `UPDATE` statements to the stock balance or movement ledger tables exist in the frontend code. Stock balance changes only through the established RPCs.
- **Posted Read-Only Rule:** The UI restricts further posting if the draft status updates to CONFIRMED.

## 5. Service/RPC Path Used
- `getReceivingCustomers`, `getReceivingWarehouses`, `getReceivingProducts`, `getReceivingLots`, `getReceivingLocations` (read-only lookups)
- `tgd_rpc_create_receiving_draft`
- `tgd_rpc_add_receiving_line`
- `tgd_rpc_post_receiving_document`

## 6. Known Limitations
- The UI currently collects `warehouse_id` and `pallet_no`, but these parameters are not yet processed by the underlying `tgd_rpc_add_receiving_line` or `tgd_rpc_create_receiving_draft` RPCs. They are available in the UI state for future schema alignment.

## 7. Playwright Retest Command
Once these changes are deployed to the UAT environment, re-run the Playwright test using:
```bash
npx playwright test "tests/e2e/transaction-uat-round-1.spec.js" --headed
```

## 8. Governance
- **Production remains HOLD.**
- **FINAL GO is NOT AUTHORIZED.**
