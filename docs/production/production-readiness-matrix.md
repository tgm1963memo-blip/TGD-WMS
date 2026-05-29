# Production Readiness Matrix

| Readiness Area | Status | Evidence Reference | Owner | Risk Level | Required Action | Go‑Live Impact |
|---|---|---|---|---|---|---|
| Security / RLS Evidence | Ready | `docs/security/real-user-role-assignment-verification.md` | Security Team | Low | - | ✅ |
| Demo Role Selector Disabled | Ready | `docs/security/demo-role-selector-production-disable.md` | Security Team | Low | - | ✅ |
| Real User Role Assignment Verification | Ready | `docs/security/real-user-role-assignment-verification.md` | Security Team | Low | - | ✅ |
| Thai Language / UI Readiness | Ready | `docs/uat/real-business-uat-evidence-plan.md` (Thai UI mentioned) | UI Team | Low | - | ✅ |
| TGM Brand UI | Ready | Sprint 12G documentation | UI Team | Low | - | ✅ |
| Warehouse Operation UI | Ready | Existing UI docs & tests | UI Team | Low | - | ✅ |
| Reports / Billing Summary | Ready | `docs/production/critical-production-gap-closure-plan.md` | Reporting Team | Low | - | ✅ |
| Backup / Restore Evidence | Partially Ready | `docs/deployment/backup-restore-drill-execution-evidence.md` | Ops Team | Medium | Execute actual drill & attach evidence | ⚠️ |
| Real Business UAT Evidence | Partially Ready | `docs/uat/real-business-uat-evidence-plan.md` | Business Owner | Medium | Perform real UAT & attach evidence | ⚠️ |
| Controlled Rollout Support | Ready | Rollout docs (`docs/rollout/*`) | Ops Team | Low | - | ✅ |
| Post Go‑Live Monitoring | Ready | `docs/production/post-go-live-monitoring-plan.md` | Ops Team | Low | - | ✅ |
| Issue / Defect Triage | Ready | `docs/rollout/day-1-5-defect-triage-board.md` | QA Team | Low | - | ✅ |
| User Training / SOP | Ready | Training docs (`docs/training/*`) | Training Team | Low | - | ✅ |

> **Note**: Areas marked **Partially Ready** require execution evidence before a Full Go can be approved.
