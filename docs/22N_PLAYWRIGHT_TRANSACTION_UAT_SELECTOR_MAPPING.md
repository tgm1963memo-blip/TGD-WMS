# 22N Playwright Transaction UAT Selector Mapping

## 1. Scope
This document outlines the UI selector mapping implemented for the Playwright Transaction UAT Automation.
The scope of this phase is restricted strictly to the **Receiving** module. Other modules remain skipped until their UIs are stabilized.

## 2. Governance & Constraints
- **No Direct DB Writes:** The automation MUST NOT directly insert, update, or delete database records using SQL or direct Supabase client calls.
- **Real User Interaction:** UAT data may only be created through the real browser UI and the existing application service/RPC flows.
- **Missing Selectors = BLOCKED:** If a required UI selector (field, button, table row) is missing or not visible within the timeout, the scenario is marked as `BLOCKED`. The automation must NOT fake a `PASS` status.
- **Movement Ledger Evidence:** Verification of stock movement against the movement ledger UI is strictly required.
- **Stock Balance Evidence:** Verification of stock balance against the stock balance UI is strictly required.
- **Final Decision Governance:**
  - Production remains **HOLD**.
  - FINAL GO is **NOT AUTHORIZED**.

## 3. Implemented Scenarios & Selectors

### A. Login
- Handled successfully.

### B. Receiving Draft Creation
- **Navigation:** `/receiving`
- **Create Button Selectors:**
  - `button:has-text("Create")`
  - `button:has-text("New")`
  - `button:has-text("Add")`
  - `button:has-text("สร้าง")`
  - `button:has-text("เพิ่ม")`
  - `a:has-text("Create")`
  - `a:has-text("New")`

### C. Receiving Line Entry
- **Product Field:** `input[name="product_code"]`, `input[placeholder*="product" i]`, `input[placeholder*="สินค้า" i]`, `select[name="product_code"]`
- **Quantity Field:** `input[name="quantity"]`, `input[name="qty"]`, `input[placeholder*="qty" i]`, `input[placeholder*="quantity" i]`, `input[placeholder*="จำนวน" i]`
- **Lot Field:** `input[name="lot_no"]`, `input[name="lot_number"]`, `input[placeholder*="lot" i]`
- **Pallet Field:** `input[name="pallet_no"]`, `input[name="pallet_number"]`, `input[placeholder*="pallet" i]`
- **Location Field:** `input[name="location_code"]`, `input[placeholder*="location" i]`, `input[placeholder*="ตำแหน่ง" i]`, `select[name="location_code"]`

### D. Receiving Post/Confirm
- **Post/Save Button:**
  - `button:has-text("Save")`
  - `button:has-text("บันทึก")`
  - `button:has-text("Post")`
  - `button:has-text("Confirm")`
  - `button:has-text("ยืนยัน")`
  - `button:has-text("รับเข้า")`

### E. Verify Receiving Movement Ledger
- **Navigation:** `/movement-ledger`
- **Table Row Matching:** Locates a `tr` containing the dynamically passed `process.env.UAT_PRODUCT_CODE`.

### F. Verify Stock Balance Increase
- **Navigation:** `/stock-balance`
- **Table Row Matching:** Locates a `tr` containing the dynamically passed `process.env.UAT_PRODUCT_CODE`.

## 4. Final Result Handling
Outputs are generated in `uat-evidence/transaction-round-1/22N_result.json` which dynamically tracks `missingSelectors` if any UI component is absent.
