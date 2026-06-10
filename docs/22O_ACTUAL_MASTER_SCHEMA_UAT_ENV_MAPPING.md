# 22O Actual Master Schema UAT Env Mapping

## 1. Objective
Align the Playwright Transaction UAT environment mapping with the actual master schema in Supabase before attempting real transaction posting. This mapping avoids false negatives where automated tests fail due to mismatched assumptions rather than application bugs.

## 2. Actual Schema Mappings
- **`UAT_PRODUCT_CODE`** maps to `tgd_products.sku`
- **`UAT_CUSTOMER_CODE`** currently maps to `tgd_customers.name` (because no `customer_code` column exists)
- **`UAT_WAREHOUSE_CODE`** maps to `tgd_warehouses.code`
- **`UAT_*_LOCATION`** maps to `tgd_locations.code`
- **`UAT_UOM`** maps to `tgd_products.unit`
- **`UAT_REASON_CODE`** is currently not backed by `tgd_reason_codes` because the table does not exist. Adjustment scenarios will be BLOCKED.

## 3. Safe UAT Example Mapping
```bash
UAT_PRODUCT_CODE=FSHR-001
UAT_CUSTOMER_CODE="Demo Customer Alpha"
UAT_WAREHOUSE_CODE=WH-COLD-01
UAT_RECEIVING_LOCATION=QC-HOLD-01
UAT_PUTAWAY_LOCATION=FZ-A-01-01
UAT_TRANSFER_FROM_LOCATION=FZ-A-01-01
UAT_TRANSFER_TO_LOCATION=FZ-A-01-02
UAT_QTY=1
UAT_UOM=kg
UAT_REASON_CODE="UAT but Adjustment may be BLOCKED until reason code master exists"
```

## 4. Missing Master Data Gap List
The following gaps have been identified that prevent full Transaction UAT completion:
- **Customer code column missing:** `tgd_customers` only has `id`, `name`, `contact_email`. UAT_CUSTOMER_CODE forces a reliance on exact name strings.
- **UOM master table missing:** `tgd_uoms` does not exist, relying entirely on `tgd_products.unit`.
- **Reason code master table missing:** `tgd_reason_codes` does not exist.
- **Customer Register UI required for real operation:** A dedicated UI is needed to safely add customers for the actual operation.
- **Reason Code Register or fixed adjustment reason policy required before Adjustment UAT PASS:** Adjustments cannot reliably pass until the adjustment reason logic is finalized.

## 5. Transaction UAT Proceed Status
**Transaction UAT can proceed.** However, Adjustment scenarios will safely report as `BLOCKED` instead of `FAIL`.

## 6. Governance
- **Runtime app unchanged:** Yes.
- **No schema changes:** Yes.
- **No direct DB writes:** Yes.
- Production remains **HOLD**.
- FINAL GO is **NOT AUTHORIZED**.
