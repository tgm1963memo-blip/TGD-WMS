# 13J-AN Receiving UAT Script

## 1. Purpose
The purpose of this document is to provide a controlled User Acceptance Testing (UAT) script for warehouse operators. This script verifies the end-to-end Receiving functionality—including master pickers, frontend validation, error handling, document draft creation, line addition, and controlled stock confirmation.

## 2. Scope
This UAT covers the Receiving Create and Detail pages in the frontend UI. It specifically tests:
- Master data lookups
- UI validation rules (required fields, zero/negative restrictions, format checks)
- The controlled workflow (Draft -> Add Lines -> Confirm/Post)
- Visibility of document status and line counting
- Idempotency and duplicate prevention

## 3. Test Environment
- **Environment:** Staging ONLY
- **Database:** Supabase Staging Database
- **Warning:** DO NOT execute these tests in Production. Production remains fully locked.

## 4. Pre-test Checklist
- [ ] Ensure you are logged into the Staging environment.
- [ ] Verify you have an operator or admin account with Receiving permissions.
- [ ] Confirm the Staging environment has baseline master data (Customers, Products, Lots, Locations).

## 5. Test Data Required
- At least one active **Customer**.
- At least one active **Product**.
- At least one active **Lot** (associated with the product).
- At least one active **Location**.

## 6. Operator Instructions
- **What to screenshot:**
  - Any error messages (red alerts) that appear.
  - The "Draft Created" summary box.
  - The final state showing "Status: CONFIRMED".
- **What to report:**
  - Any unexpected behavior, missing master data in dropdowns, or unhandled crashes.
- **What NOT to click:**
  - Do not use manual UUID entry unless executing Scenario 12.
- **Critical Rule:**
  - Do not touch Production under any circumstances.

## 7. Safety Rules
- **No direct writes:** The UI must not use direct Supabase table inserts/updates/deletes.
- **RPC-only:** All writes go through the verified RPC wrappers (`createReceivingDocument`, `addReceivingLine`, `postReceivingDocument`).
- **Data Integrity:** No existing stock movement logic or stock balance logic has been altered.

---

## 8. UAT Scenarios

### Scenario 1: Master Pickers Load
- **Action:** Open the Receiving Create page.
- **Expected:** The customer dropdown populates. The message "Use read-only master pickers for receiving IDs" is displayed.

### Scenario 2: Save Draft Without Customer
- **Action:** Leave the Customer dropdown empty. Enter a Document No. Click "Save Draft".
- **Expected:** The action is blocked or a clear error ("Customer is required") is shown.

### Scenario 3: Save Draft With Whitespace Document No
- **Action:** Select a Customer. Enter spaces into Document No (e.g., `"   "`). Click "Save Draft".
- **Expected:** The action is blocked or a clear error ("Document No is required and cannot be only whitespace") is shown.

### Scenario 4: Create Valid Receiving Draft
- **Action:** Select a valid Customer and enter a valid Document No. Click "Save Draft".
- **Expected:** 
  - The draft document ID is shown.
  - Status is displayed as `DRAFT`.
  - The "Add Line" section becomes enabled.

### Scenario 5: Add Line Without Product/Lot/Location
- **Action:** After creating a draft, leave Product/Lot/Location empty and click "Add Line".
- **Expected:** The action is blocked or a clear error ("Product, lot, and location are required") is shown.

### Scenario 6: Add Line With Quantity = 0
- **Action:** Select valid product, lot, and location. Enter `0` for Quantity. Click "Add Line".
- **Expected:** The action is blocked or a clear error ("Quantity must be a number greater than 0") is shown.

### Scenario 7: Add Line With Negative Weight
- **Action:** Change Quantity to `10`. Enter `-5` for Weight. Click "Add Line".
- **Expected:** The action is blocked or a clear error ("Weight must be a number greater than or equal to 0") is shown.

### Scenario 8: Add Valid Line
- **Action:** Change Weight to a valid positive number or leave empty. Click "Add Line".
- **Expected:**
  - The line ID is shown ("Last receiving line id...").
  - The line count increases.
  - No stock movement occurs yet.

### Scenario 9: Confirm/Post With Line
- **Action:** Scroll to the "Controlled Confirm/Post" section and click "Confirm/Post Receiving".
- **Expected:**
  - The document status updates to `CONFIRMED`.
  - The "Confirm/Post Receiving" button is disabled or hidden.
  - A success message is displayed.
  - A backend stock movement is securely generated.

### Scenario 10: Refresh Detail Page
- **Action:** Navigate to the Receiving Detail page for this document (or refresh if already on it).
- **Expected:**
  - Status remains `CONFIRMED`.
  - The stock movement is visible in the ledger.
  - There are no duplicate movements.

### Scenario 11: Duplicate Post Prevention
- **Action:** On the Detail page, verify the Confirm/Post button behavior. If exposed to a race condition (or manually triggering the API), attempt a duplicate post.
- **Expected:**
  - UI prevents duplicate clicks (button disabled/hidden).
  - The database only registers one movement for the document, rejecting duplicates with "Document is already CONFIRMED".

### Scenario 12: Manual UUID Fallback Invalid UUID
- **Action:** Check "Use manual UUID entry". Enter an invalid string (e.g., `invalid-id`) into Customer ID or Product ID. Click Save Draft or Add Line.
- **Expected:** The action is blocked before the API call with an "Invalid UUID format" error.

---

## 9. UAT Result Logging Table

| No | Scenario | Tester | Result (Pass/Fail) | Screenshot Provided? | Issue Noted | Severity | Owner |
|---|---|---|---|---|---|---|---|
| 1 | Master Pickers Load | | | | | | |
| 2 | Draft without Customer | | | | | | |
| 3 | Draft with Whitespace Doc No | | | | | | |
| 4 | Create Valid Draft | | | | | | |
| 5 | Line without Product/Lot/Loc | | | | | | |
| 6 | Line with Quantity = 0 | | | | | | |
| 7 | Line with Negative Weight | | | | | | |
| 8 | Add Valid Line | | | | | | |
| 9 | Confirm/Post with Line | | | | | | |
| 10 | Refresh Detail Page | | | | | | |
| 11 | Duplicate Post Prevention | | | | | | |
| 12 | Manual UUID Fallback Invalid | | | | | | |

---

## 10. Pass/Fail Criteria
**PASS:** All scenarios execute as expected. Data is accurately reflected in Staging. No direct un-controlled DB writes occur.
**FAIL:** Any validation bypass, incorrect stock mutation, UI crash, or missing error feedback.

---

## 11. Issues Log Template
*Use this template to record bugs discovered during UAT.*

- **Issue ID:** `[Auto-increment number]`
- **Scenario:** `[Scenario Number]`
- **Description:** `[What went wrong]`
- **Steps to Reproduce:** `[1, 2, 3]`
- **Expected Result:** `[What should happen]`
- **Actual Result:** `[What actually happened]`
- **Status:** `[Open / Resolved]`

---

## Appendix: Controller SQL Verification (CONTROLLER ONLY)
*Important: This section is for Controller backend verification only. Operators must not execute these steps.*

```sql
-- 1. Document Status Check
SELECT id, document_no, status, created_at
FROM tgd_receiving_documents
WHERE document_no = 'TEST-DOC-NO';

-- 2. Line Check
SELECT id, document_id, product_id, expected_qty, received_qty
FROM tgd_receiving_lines
WHERE document_id = (SELECT id FROM tgd_receiving_documents WHERE document_no = 'TEST-DOC-NO');

-- 3. Stock Movement Check
SELECT id, reference, movement_type, product_id, quantity, to_location_id
FROM tgd_stock_movements
WHERE reference = (SELECT id FROM tgd_receiving_documents WHERE document_no = 'TEST-DOC-NO');

-- 4. Stock Balance Check
SELECT product_id, lot_id, location_id, quantity
FROM tgd_stock_balances
WHERE product_id = 'TARGET-PRODUCT-ID' AND lot_id = 'TARGET-LOT-ID';

-- 5. Idempotency Check (Confirm only 1 movement exists per line)
SELECT reference, COUNT(*) as movement_count
FROM tgd_stock_movements
WHERE reference = (SELECT id FROM tgd_receiving_documents WHERE document_no = 'TEST-DOC-NO')
GROUP BY reference;
```
