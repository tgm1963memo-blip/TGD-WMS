# Backup / Restore Drill Execution Evidence

## Purpose
Document the execution evidence for a full backup and restore drill to demonstrate production readiness.

## Scope
Applies to the production and staging environments used for the drill. No production data is modified.

## Drill Date / Time
- **Date:** YYYY‑MM‑DD
- **Start Time:** HH:MM (UTC)
- **End Time:** HH:MM (UTC)

## Environment Used
- **Backup Source:** `<environment>` (e.g., `staging-db-instance`)
- **Restore Target:** `<environment>` (e.g., `drill‑restore‑instance`)

## Personnel
- **Responsible Engineer:** Name (email)
- **Observer / Reviewer:** Name (email)

## Pre‑Drill Checklist
- [ ] Verify backup schedule configuration
- [ ] Confirm storage capacity for backup artifact
- [ ] Ensure restore target is a fresh isolated environment
- [ ] Review recovery‑drill‑checklist.md

## Backup Execution Evidence
| Evidence ID | Type | Screenshot | Command / Output | Person | Date/Time | Result | Notes |
|-------------|------|------------|------------------|--------|-----------|--------|-------|
| BE‑001 | backup_started | (link) | `pg_dump ...` | Engineer | YYYY‑MM‑DD HH:MM | Success | – |
| BE‑002 | backup_completed | (link) | `Backup file size: X MB` | Engineer | YYYY‑MM‑DD HH:MM | Success | – |

## Restore Execution Evidence
| Evidence ID | Type | Screenshot | Command / Output | Person | Date/Time | Result | Notes |
|-------------|------|------------|------------------|--------|-----------|--------|-------|
| RE‑001 | restore_started | (link) | `pg_restore ...` | Engineer | YYYY‑MM‑DD HH:MM | Success | – |
| RE‑002 | restore_completed | (link) | `Restored X tables` | Engineer | YYYY‑MM‑DD HH:MM | Success | – |

## Data Verification Evidence
- Sample data verified against master data tables, movement ledger, stock balance, and user role tables.
- Screenshots of SELECT queries and row counts attached.

## Application Verification Evidence
- Smoke‑test of the restored environment (login, dashboard load, key pages). See **restore‑verification‑checklist.md** for details.

## RTO / RPO Results
- **Recovery Time Objective (RTO):** X minutes (target ≤ 30 min)
- **Recovery Point Objective (RPO):** Y minutes of data loss (target ≤ 5 min)

## Issues Found
- List any anomalies, errors, or performance observations.

## Corrective Actions
- Describe actions taken or planned to address issues.

## Final Outcome
- **Passed** / **Failed** (choose one) with brief justification.

## Sign‑off
| Role | Name | Signature | Date |
|------|------|-----------|------|
| Engineer |  |  |  |
| Reviewer |  |  |  |
| Production Lead |  |  |  |

> **Important:** No secrets, passwords, or tokens are recorded in this document.
