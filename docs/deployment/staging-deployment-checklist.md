# Staging Deployment Checklist

## Purpose

This checklist prepares TGD WMS for staging deployment and UAT readiness. TGD WMS supports Cold Storage, Goods Deposit, Storage, Customer Withdrawal, Dispatch / Goods Issue, reports, and Accounting Charge Review for customer-owned inventory.

## Scope

- Frontend staging deployment readiness.
- Public frontend configuration review.
- Build and deployment verification.
- Post-deployment smoke testing.
- Rollback readiness.
- Sign-off preparation.

Out of scope: code changes, database schema changes, database policy changes, deployment automation scripts, CI/CD workflow creation, invoice generation, accounting post, ERP live connector, inventory sync, and Express sync.

## Pre-Deployment Checklist

| Item | Owner | Status | Evidence / Notes |
|---|---|---|---|
| Sprint 9A UAT documents approved | Controller |  |  |
| Sprint 9B SOP documents approved | Controller |  |  |
| Phase 8 production readiness foundation approved | Controller |  |  |
| Staging release version identified | Deployment owner |  |  |
| Staging environment confirmed separate from production | Deployment owner |  |  |
| Required test users confirmed | Admin |  |  |
| UAT test data prepared | Warehouse manager |  |  |
| Accounting review assumptions prepared | Accounting |  |  |

## Environment Checklist

| Item | Expected | Actual | Status | Evidence / Notes |
|---|---|---|---|---|
| Staging URL available | Dedicated staging URL |  |  |  |
| Public frontend env values configured | Public keys only |  |  |  |
| No secret-like frontend config | No service credentials or private values |  |  |  |
| Staging data separated from production | No production mutation risk |  |  |  |
| Browser access verified | Supported browsers can open app |  |  |  |

## Branch / Version Checklist

| Item | Expected | Actual | Status | Evidence / Notes |
|---|---|---|---|---|
| Release branch or tag identified | Approved branch/tag |  |  |  |
| Commit/version recorded | Version reference captured |  |  |  |
| Release notes draft prepared | Template completed |  |  |  |
| Rollback version identified | Previous approved artifact/version |  |  |  |

## Build Checklist

| Item | Expected Result | Actual Result | Status | Evidence / Notes |
|---|---|---|---|---|
| Full test command available | `npm.cmd test` |  |  |  |
| Build command available | `npm.cmd run build` |  |  |  |
| Production build completes | Build artifact generated |  |  |  |
| Build artifact retained | Artifact/version available for deployment |  |  |  |

## Deployment Checklist

| Step | Action | Expected Result | Actual Result | Status | Evidence / Notes |
|---|---|---|---|---|---|
| 1 | Deploy approved build artifact to staging. | Staging app is updated. |  |  |  |
| 2 | Confirm staging URL loads. | App shell loads. |  |  |  |
| 3 | Confirm public config readiness. | Config has no secret-like values. |  |  |  |
| 4 | Run staging smoke checklist. | Critical smoke tests pass. |  |  |  |
| 5 | Record deployment evidence. | Release notes and smoke results are attached. |  |  |  |

## Post-Deployment Smoke Test

Use `docs/deployment/staging-smoke-test-checklist.md`.

Minimum Go criteria:

- App loads.
- Core operation pages load.
- Reports load.
- Role visibility behaves as expected.
- Thai / English toggle works.
- No invoice generation, accounting post, ERP live connector, inventory sync, or Express sync is available.

## Rollback Checklist

| Item | Owner | Status | Evidence / Notes |
|---|---|---|---|
| Rollback trigger reviewed | Controller |  |  |
| Previous approved version available | Deployment owner |  |  |
| Communication channel ready | Controller |  |  |
| Post-rollback smoke checklist ready | QA |  |  |
| Incident log template ready | UAT lead |  |  |

## Sign-Off Section

| Role | Name | Decision | Date | Notes |
|---|---|---|---|---|
| Deployment owner |  | Go / No-Go |  |  |
| QA owner |  | Go / No-Go |  |  |
| UAT owner |  | Go / No-Go |  |  |
| Warehouse manager |  | Go / No-Go |  |  |
| Accounting lead |  | Go / No-Go |  |  |
| Controller |  | Go / No-Go |  |  |
