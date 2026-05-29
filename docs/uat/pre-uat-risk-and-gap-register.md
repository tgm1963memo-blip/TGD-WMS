# Pre-UAT Risk And Gap Register

| Risk / Gap ID | Area | Description | Impact | Likelihood | Severity | Mitigation | Owner | Status | Go/No-Go impact |
|---|---|---|---|---|---|---|---|---|---|
| PUAT-RISK-001 | Test data | Required UAT data is incomplete. | Flow may be blocked or report output may be empty. | Medium | High | Complete Sprint 10B data readiness checklist before execution. | Warehouse Manager / Accounting | Open | May block UAT start |
| PUAT-RISK-002 | Roles | Role accounts are not prepared. | Role visibility cannot be validated. | Medium | High | Prepare all role accounts or approved role switching method. | Admin / Controller | Open | May block role testing |
| PUAT-RISK-003 | Reports | Report data is insufficient. | Antigravity cannot validate report content beyond page load. | Medium | Medium | Prepare opening stock, movement, aging, and billing assumptions. | Warehouse Manager / Accounting | Open | Conditional |
| PUAT-RISK-004 | Environment | Staging config is incomplete. | App or data access may fail. | Low | High | Complete staging environment requirements and config readiness check. | IT / Technical | Open | May block UAT start |
| PUAT-RISK-005 | Business scope | Users expect invoice generation or accounting post. | Misaligned UAT expectation. | Medium | Medium | Reinforce SOP/training scope: review-only accounting support. | Controller | Open | Conditional |
