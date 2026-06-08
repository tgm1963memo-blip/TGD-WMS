# 20N: Final Friday READY/HOLD Decision Template

## 1. Morning Start Decision Section
**Date:** [YYYY-MM-DD]
**Time:** [HH:MM]
**Controller:** [Name]

**Checklist:**
- [ ] Latest commit verified: [Commit Hash]
- [ ] Git clean status verified
- [ ] `npm test` result: [PASS/FAIL]
- [ ] `npm run build` result: [PASS/FAIL]
- [ ] Environment reachable
- [ ] Login verified
- [ ] User roles verified
- [ ] Master data ready
- [ ] Opening stock balance captured
- [ ] Report preview/print checked
- [ ] Evidence folder ready
- [ ] Defect log ready

## 2. Decision Options (Morning Start)
- [ ] **READY TO START FRIDAY TEST RUN**
- [ ] **READY WITH CONDITIONS**
- [ ] **HOLD**
- [ ] **NOT READY**

## 3. Condition Table
| Condition ID | Description | Owner | Required Before Start? | Workaround | Due Time | Status |
|---|---|---|---|---|---|---|
| COND-01 | | | | | | |
| COND-02 | | | | | | |
| COND-03 | | | | | | |

## 4. HOLD Triggers
If any of the following occur, the test run is immediately put on **HOLD**:
- [ ] Test fail
- [ ] Build fail
- [ ] Git not clean
- [ ] Environment unreachable
- [ ] Login failure
- [ ] Missing master data
- [ ] Missing opening balance
- [ ] Report preview/print failure
- [ ] Stock balance mismatch
- [ ] Any Critical defect
- [ ] Data corruption risk
- [ ] Direct database edit required

## 5. End-Of-Day Decision Section
**Date:** [YYYY-MM-DD]
**Time:** [HH:MM]
**Controller:** [Name]

**Decision:**
- [ ] **PASS**
- [ ] **PASS WITH WORKAROUND**
- [ ] **HOLD**
- [ ] **FAIL**

## 6. End-Of-Day Criteria
- [ ] All critical scenarios executed
- [ ] Critical defects = 0
- [ ] High defects have workaround
- [ ] Reports preview/print passed
- [ ] Stock balance reconciled
- [ ] Evidence captured
- [ ] Defect log updated
- [ ] Business tester acknowledgment
- [ ] IT/system owner acknowledgment
- [ ] Controller acknowledgment

## 7. Final Explicit Boundaries
- **Friday Test Run is controlled UAT only.**
- **This document does not authorize Production Go Live.**
- **This document does not authorize FINAL GO.**
- **Production remains HOLD.**
- **No direct database edits are allowed.**
- **No uncontrolled Production stock movement is allowed.**
- **Any Critical defect triggers HOLD.**
