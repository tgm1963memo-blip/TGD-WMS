# End‑to‑End UAT Script

## Purpose
Execute a full end‑to‑end scenario covering the complete operational flow of the TGD WMS from Receiving through Post‑Outbound.

## Prerequisites
- Test environment with staging data loaded.
- User accounts with appropriate roles (Receiver, Putaway, Transfer, Picker, Outbound).
- Barcode scanner / handheld device simulated.

## Steps
1. **Receiving**
   - Scan inbound shipment barcode.
   - Create receipt and verify inventory quantity.
2. **Putaway**
   - Assign storage location.
   - Confirm stock balance reflects putaway.
3. **Transfer**
   - Initiate transfer to target location.
   - Verify source and destination balances.
4. **Adjustment**
   - Perform a positive adjustment of +5 units.
   - Perform a negative adjustment of -2 units.
5. **Outbound Draft**
   - Create outbound draft for 10 units.
   - Generate reservation and pick list.
6. **Reservation**
   - Reserve the 10 units.
   - Validate reservation status is *Reserved*.
7. **Pick Confirmation**
   - Scan each pick barcode.
   - Confirm pick quantity matches reservation.
8. **Post Outbound**
   - Run post‑outbound processing.
   - Verify stock movement journal entries.
9. **Barcode / Handheld**
   - Use handheld scanner mock to scan each step.
10. **Role & Permission Checks**
    - Attempt each step with unauthorized role and confirm access denied.
11. **Error Cases**
    - Simulate out‑of‑stock during pick; verify error handling.
    - Simulate network latency; verify retry logic.

## Evidence Required
- Screenshots or logs for each step.
- Exported CSV of transaction records.

## Acceptance Criteria
- All steps complete with **PASS** status.
- No unexpected errors or data inconsistencies.
- FINAL GO phrase is **not** executed; only present as a gate reference.
