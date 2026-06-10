# 23A Receiving Business Process Review and UI Requirement

## 1. Current Blocker Summary
- **Browser UAT Smoke:** PASSED.
- **Playwright Transaction UAT:** Executed. Login PASSED, Receiving page REACHABLE.
- **Receiving Transaction:** BLOCKED. The Receiving UI is missing write controls (Create/New/Add button, Product input/select, Save/Post/Confirm button).
- **Evidence:** No movement ledger or stock balance evidence was generated because no receiving transaction was posted.
- **Adjustment:** BLOCKED because the `tgd_reason_codes` table does not exist.
- **22P Decision:** HOLD FOR RECEIVING UI IMPLEMENTATION.

## 2. Recommended Receiving Business Flow
To align with cold storage WMS requirements, the Receiving UI must support the following flow:
1. **Open Receiving page**
2. **Click Create Receiving**
3. **Select Customer**
4. **Select Warehouse**
5. **Select Receiving Location**
6. **Add Line Items:**
   - Product SKU
   - Lot No
   - Pallet No
   - Quantity
   - UOM
7. **Save Draft** (status: DRAFT)
8. **Confirm/Post Receiving**
   - System posts the RECEIVING movement.
   - Stock balance increases at the receiving location.
   - Movement ledger displays the receiving movement.
   - Document status becomes POSTED or CONFIRMED.
   - The posted document becomes read-only.

## 3. Required UI Controls
- **Create/New Receiving Button:** Visible on the main Receiving list page.
- **Customer Selection:** Dropdown or autocomplete.
- **Warehouse Selection:** Dropdown or autocomplete.
- **Location Selection:** Dropdown or autocomplete.
- **Product Selection:** Dropdown or autocomplete.
- **Quantity Input:** Numeric field.
- **Save Draft Button:** To persist the document without affecting stock.
- **Post/Confirm Button:** To finalize the transaction, execute the RPC, and update stock.

## 4. Required Fields
- **Customer** (Header)
- **Warehouse** (Header)
- **Receiving Location** (Header/Line)
- **Product SKU** (Line)
- **Product Name** (Line - display only)
- **Lot No** (Line)
- **Pallet No** (Line)
- **Qty** (Line)
- **UOM** (Line)
- **Remark** (Optional)

## 5. Required Statuses
- **DRAFT:** Initial state, fully editable.
- **POSTED / CONFIRMED:** Final state, read-only.

## 6. Business and Validation Rules
- **Quantity:** Must be greater than `0`.
- **Master Data:** Product, Customer, Warehouse, and Location must exist in their respective master tables.
- **UOM Validation:** Must match `product.unit` or be validated against a UOM conversion table (once implemented).
- **Traceability:** Lot No and Pallet No are required for strict cold storage traceability.

## 7. Posting and Movement Ledger Rules
- **Draft Does Not Affect Stock:** A document in DRAFT status has no impact on inventory or movement ledger.
- **No Stock Balance Update Before Post:** Stock balances remain entirely unchanged until the Post action is executed.
- **Post Creates Movement Ledger:** Confirming/Posting a receiving transaction immediately creates a corresponding positive IN entry in the movement ledger.

## 8. Stock Balance Rules
- **Stock Balance Changes Only Through RPC:** Stock balances can only change through the existing RPC/movement ledger flow. Direct database writes or manual balance updates are strictly prohibited.
- **Increase at Receiving Location:** Stock balance increases explicitly at the designated receiving location.

## 9. Read-Only and Audit Rules
- **Posted Document Read-Only:** A posted receiving document cannot be edited directly.
- **Correction Protocol:** Corrections to a posted receiving must be performed via an adjustment or reversal process.
- **Blocked Actions Before Posting:** Printing official pallet tags or moving stock (Putaway) is blocked until the Receiving document is POSTED.

## 10. Barcode / Handheld Future Extension
- The UI and business flow must support future extension for barcode scanning and handheld operations, allowing fields like Product, Lot, and Pallet to be populated via scan.

## 11. Playwright UAT Acceptance Criteria
Before the Receiving module can achieve a PASS in Transaction UAT, the following must be true:
- Create button is visible and clickable.
- Customer field is fillable/selectable.
- Product field is fillable/selectable.
- Qty field is fillable with numeric values.
- Save Draft action works without errors.
- Post/Confirm action works and updates status.
- Ledger evidence explicitly appears in the movement ledger view.
- Stock balance evidence explicitly appears in the stock balance view.
- No RPC, schema, or permission errors occur during execution.

## 12. Governance
- **Production remains HOLD.**
- **FINAL GO is NOT AUTHORIZED.**
