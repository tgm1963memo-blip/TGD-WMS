# Go‑Live Support and Monitoring Plan

## Go‑Live Readiness Checklist
- FINAL GO phrase present only as a gate reference (no execution)
- Controlled Write Smoke approval phrase documented
- All UAT packs completed and signed off
- Feature gates disabled for Post Outbound by default
- Production apply status remains **HOLD**

## Support Owner
- **Name:** ______________________
- **Role:** Release Manager
- **Contact:** ______________________

## Issue Log Process
1. Capture issue in JIRA ticket with severity label.
2. Assign to appropriate owner (Operations, Dev, DB).
3. Record steps to reproduce, screenshots, logs.
4. Resolve and close with verification steps.

## Daily Monitoring Checklist
- Verify production apply status is **HOLD** until FINAL GO.
- Check stock movement journal for unexpected entries.
- Reconcile stock balances against expected totals.
- Review post‑outbound processing logs.
- Confirm no unauthorized migrations applied.

## Stock Movement Monitoring
- Run daily report of `stock_movements` table.
- Flag any movements without corresponding outbound draft.

## Stock Balance Reconciliation
- Compare `stock_balances` with physical count summary.
- Highlight discrepancies > 5% for investigation.

## Post Outbound Monitoring
- Ensure outbound batches complete within SLA.
- Verify no `CONFIRM STOCK OUT` button is enabled.

## Escalation Path
| Severity | Owner | SLA | Escalation |
|----------|-------|-----|------------|
| Critical | Release Manager | 30 min | CTO
| High | Operations Lead | 1 h | Release Manager
| Medium | Dev Lead | 4 h | Operations Lead
| Low | Support Engineer | 1 d | Dev Lead |

## Rollback / Reversal Note
- Do **NOT** execute any rollback until **FINAL GO** phrase is confirmed.
- Document rollback steps in internal wiki.
- Ensure backup snapshots are available before go‑live.

## Production Status
- Production apply remains **HOLD** until explicit **FINAL GO**:
  `FINAL GO: Apply Outbound migrations 025-030 to Production`
- Controlled write smoke requires separate approval phrase:
  `APPROVE CONTROLLED WRITE SMOKE: Outbound qty 1`

---
*All checks are required before the go‑live date. No code changes or migrations are performed during this preparation phase.*
