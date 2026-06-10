# 22I Browser UAT Smoke Result Record

**Test Date:** 2026-06-09T10:09:35.199Z (Captured from result.json)

## 1. Environment
- **Base URL:** https://tgd-wms.vercel.app
- **Browser:** Chromium via Playwright
- **Execution Mode:** headed

## 2. Command Executed
```bash
npx playwright test "tests/e2e/uat-round-1.spec.js" --headed
```

## 3. Pages/Screenshots Captured
The following screenshots were successfully captured in `uat-evidence/round-1/`:
- `00-before-login.png`
- `01-login.png`
- `02-dashboard.png`
- `03-receiving.png`
- `04-putaway.png`
- `05-stock-balance.png`
- `06-transfer.png`
- `07-adjustment.png`
- `08-movement-ledger.png`
- `09-stock-aging.png`
- `result.json`

## 4. Result Summary
- **Playwright technical result:** PASS
- **browser route fallback:** PASS
- **login:** PASS
- **navigation smoke:** PASS
- **real errors:** 0
- **warnings:** expected/non-blocking only

## 5. Prior False Positives Resolved
- The generic "RPC" keyword was removed from the error detection suite.
- The Receiving page warning text containing "via RPC" is ignored correctly and logged as a warning.

## 6. Remaining Limitation
- This is browser smoke/navigation UAT only.
- This does not prove transaction posting.
- This does not prove stock movement correctness.
- This does not prove ledger/balance reconciliation.

## 7. Next Required UAT
The following end-to-end functionality must be validated in future UAT rounds:
- Receiving create/post
- Putaway complete
- Transfer post
- Adjustment post
- Withdrawal/allocation/picking/dispatch if available
- Stock balance and movement ledger verification

## 8. Final Decision
- **Browser Smoke:** PASS
- **Go Live:** NOT READY
- **Production:** HOLD
- **FINAL GO:** NOT AUTHORIZED
