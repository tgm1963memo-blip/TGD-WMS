# UAT Master Checklist

## Overview
This checklist is used to validate the end‑to‑end functionality of the TGD WMS before go‑live. Each item is marked **PASS**, **HOLD**, or **FAIL**.

## Sections
### Receiving
- Verify receipt creation
- Validate barcode scan
- Confirm inventory update

### Putaway
- Confirm location assignment
- Verify stock balance reflects putaway

### Transfer
- Ensure transfer record creation
- Validate source and destination balances

### Adjustment
- Test positive and negative adjustments
- Confirm audit trail

### Outbound Draft
- Create outbound draft
- Verify reservation and pick list generation

### Reservation
- Reserve stock quantity
- Check reservation status

### Pick Confirmation
- Confirm picks against reservation
- Validate pick integrity

### Post Outbound
- Run post‑outbound processing
- Confirm stock movement journal entries

### Barcode / Handheld Foundation
- Test handheld scanner integration
- Verify barcode format compliance

### Role and Permission Checks
- Ensure only authorized roles can perform each step
- Validate permission errors for unauthorized attempts

### Error Cases
- Simulate network failure
- Simulate out‑of‑stock scenario
- Verify graceful degradation and alerts

### Evidence Required
- Screenshots or logs for each step
- Exported CSV of transaction records

### Sign‑off Owner Fields
- **Prepared By:** \_\_\_\_\_\_
- **Reviewed By:** \_\_\_\_\_\_
- **Approved By:** \_\_\_\_\_\_
