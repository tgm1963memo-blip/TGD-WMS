# 23L: Controlled Receiving Lot Entry

## 1. Current Blocker
The Receiving UAT is currently blocked at the line entry phase (`Scenario C`) because the user needs to receive a new lot (`UAT-LOT-001`), but the UI only provides a dropdown for existing lots. This causes a `MISSING_OPTION` error in Playwright.

## 2. Business Context
Inbound receiving operations frequently involve receiving entirely new batches or lots from suppliers. Requiring the lot to be pre-created before receiving contradicts standard warehouse workflows, as the receiving process itself is typically the origin point for new lot numbers.

## 3. Implementation Path & Blocker Diagnosis
We inspected `ReceivingCreatePage.jsx` and `receivingService.js`, specifically the `addReceivingLine` payload and the database RPC `tgd_rpc_add_receiving_line`.

- **Finding**: The database RPC (`023_tgd_wms_receiving_add_line_location_rpc_patch.sql` and `018_tgd_wms_receiving_rpc_contract.sql`) explicitly requires `p_lot_id uuid`. It does not accept a `lot_no` text parameter.
- **Decision**: Because the underlying schema and RPC strictly mandate a pre-existing `lot_id` UUID, **we cannot safely implement a "Lot No" text input** in the UI without faking IDs or bypassing the ledger, which violates our strict boundaries. 
- **Action**: The UI fix is NOT SUPPORTED without a database RPC migration to allow `lot_no` (and auto-create the lot). Therefore, we documented this blocker and do not fake the data.

## 4. Playwright Updates
Playwright has been updated to theoretically prefer `input[aria-label="Lot No"]` if it exists, falling back to `select[aria-label="Lot"]`. Because the input cannot be built yet, it correctly falls back to the select and encounters a `MISSING_OPTION` blocker, correctly classifying the scenario as `BLOCKED` rather than `FAIL`.

## 5. Remaining Risks
- Receiving UAT cannot complete until the RPC `tgd_rpc_add_receiving_line` is updated to accept `lot_no` instead of `lot_id` and internally handle lot creation.

## 6. Security & Rollout Boundaries
> [!WARNING]
> **Production Context**
> - **No direct DB writes or seed data were used to bypass this issue.**
> - **Production remains HOLD.**
> - **FINAL GO is NOT AUTHORIZED.**
