# Phase 23Q: Verify Receiving Draft Id and Enable Lot No Line Add

## Objective
Harden the Receiving UAT flow to ensure that a Receiving Draft is verifiably created before attempting to add lines, and enable the use of new lot numbers (Lot No) during inbound receiving without requiring a pre-existing Lot ID.

## Analysis
- **Scenario B Pass Anomaly**: Playwright previously considered Scenario B a `PASS` if it clicked "Save Draft" without encountering a crash. However, the backend could fail (e.g., duplicate document) resulting in no draft ID being returned. The missing draft ID caused Scenario C to fail because the "Add Line" button relies on a valid document ID to become enabled.
- **Lot Number Entry**: Receiving operations often deal with new lots that haven't been created in the master data yet. To handle this, `tgd_rpc_resolve_or_create_lot` was previously introduced. However, the UI's `canAddLine` check still required `selectedLotId`, preventing users from submitting lines with only a newly typed `Lot No`.

## Implementation Details

### 1. Enforcing Draft ID Verification
- **Frontend Guard**: In `ReceivingCreatePage.jsx`, the `handleSaveDraft` function now strictly verifies that a non-empty `documentId` is returned by the RPC (`getCreatedDocumentId`). If the ID is missing, it explicitly sets an error: `Save draft succeeded but returned no document id (DRAFT_ID_MISSING)`.
- **Playwright Enforcement**: `transaction-uat-round-1.spec.js` now actively waits for the `Draft Created` header to appear. If it does not appear, it explicitly fails the test, parsing any visible page error for `DRAFT_ID_MISSING`.

### 2. Enabling Lot No Line Add
- **UI Enablement**: The `canAddLine` rule in `ReceivingCreatePage.jsx` has been updated to explicitly accept either `lineForm.lot_id` OR `lineForm.lot_no`.
- **Diagnostics**: `ReceivingCreatePage.jsx` now clearly exposes `addLineDisabledReason` which details exactly why the Add Line button might be disabled (e.g., `Missing lot id or lot no`, `Missing document id`, etc.). This greatly assists UAT troubleshooting.

### 3. Safety Boundaries Maintained
- No direct stock updates or movement ledger bypasses occur.
- Production state remains HOLD.
- FINAL GO is NOT AUTHORIZED.
