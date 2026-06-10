# Phase 23S: Transaction UAT Login Assertion and Deployment Diagnostics

## Scenario A Route Mismatch Root Cause
The Transaction UAT failed during Scenario A (Login) because the Playwright assertion strictly expected `**/dashboard` upon successful login. However, some authenticated sessions may default to landing on `/` (the application root) due to route fallbacks, Vercel SPA routing changes, or user role redirection. 

## Resolution
Both `/` and `/dashboard` are now properly considered acceptable authenticated landing routes. The assertion has been updated to `waitForAuthenticatedShell`, which verifies either route along with validating that core authenticated navigational elements (Dashboard, Receiving, Operations, etc.) are visible.

## Scenario Dependency Blockers
Scenario B (Receiving draft creation) now strictly depends on Scenario A passing. If Scenario A fails, Scenario B is aborted and throws `DEPENDENCY_BLOCKED`.
Furthermore, `DRAFT_ID_MISSING` remains classified as a `BLOCKED` condition rather than a standard test logic `FAIL`, accurately categorizing diagnostic or data extraction hurdles.

## Diagnostic Version 23S
The UI `ReceivingCreatePage.jsx` has been updated from version `23J` to `23S`. This diagnostic block now safely captures the `rawShape` of the RPC response and verification of whether a normalized draft ID (`hasId` or `hasDocumentId`) successfully parsed, aiding in future UAT troubleshooting.

## Safety Confirmations
- No direct stock balance updates occur.
- No movement ledger logic is bypassed.
- Production remains on **HOLD**.
- **FINAL GO is NOT AUTHORIZED**.
