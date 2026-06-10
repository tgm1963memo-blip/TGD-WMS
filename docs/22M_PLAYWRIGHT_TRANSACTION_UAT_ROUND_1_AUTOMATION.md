# 22M Playwright Transaction UAT Round 1 Automation

## 1. Objective
Automate the manual transaction UAT execution using Playwright to ensure consistent, repeatable testing of Receiving, Putaway, Transfer, Adjustment, and Stock reporting features without manual data entry fatigue.

## 2. Environment Variables Required
The Playwright execution requires the following environment variables to be set. If any are missing, the test will fail early to prevent partial data posting.
- `UAT_BASE_URL`
- `UAT_EMAIL`
- `UAT_PASSWORD`
- `UAT_PRODUCT_CODE`
- `UAT_CUSTOMER_CODE`
- `UAT_WAREHOUSE_CODE`
- `UAT_RECEIVING_LOCATION`
- `UAT_PUTAWAY_LOCATION`
- `UAT_TRANSFER_FROM_LOCATION`
- `UAT_TRANSFER_TO_LOCATION`
- `UAT_LOT_NO`
- `UAT_PALLET_NO`
- `UAT_QTY`
- `UAT_UOM`
- `UAT_REASON_CODE`

## 3. Scenarios
1. Login
2. Receiving draft creation
3. Receiving line entry
4. Receiving post/confirm
5. Verify receiving movement ledger evidence
6. Verify stock balance increase evidence
7. Putaway create/session if UI supports it
8. Putaway confirm if UI supports it
9. Verify location movement evidence
10. Transfer create if UI supports it
11. Transfer post if UI supports it
12. Verify from/to location balance evidence
13. Adjustment IN if UI supports it
14. Adjustment OUT if UI supports it
15. Verify movement ledger after adjustment
16. Stock Aging report check

## 4. Output Structure (`result.json`)
```json
{
  "baseUrl": "...",
  "testedAt": "...",
  "testerMode": "Playwright",
  "scenarios": [
    {
      "id": "A",
      "name": "Login",
      "status": "PASS",
      "evidence": "22M_01_login.png",
      "notes": "",
      "defectId": null
    }
  ],
  "errors": [],
  "warnings": [],
  "finalDecision": {
    "Transaction UAT Automation": "HOLD",
    "Production": "HOLD",
    "FINAL GO": "NOT AUTHORIZED"
  }
}
```

## 5. Strict Governance Rules
- No direct stock balance update is permitted. All updates must flow through the UI and standard RPC paths.
- Movement ledger evidence is strictly required for any stock transaction to PASS.
- Stock balance evidence is strictly required to verify final location availability.
- The automation will not authorize Go Live or FINAL GO.

## 6. Final Decision
- **Transaction UAT Automation:** PENDING EXECUTION
- **Browser Smoke:** PASSED
- **Production:** HOLD
- **FINAL GO:** NOT AUTHORIZED
