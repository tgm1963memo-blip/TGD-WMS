# Project Boundary

## Project Identity

Project name: TGD WMS

Working folder: `C:\Users\TSS\OneDrive\เดสก์ท็อป\TGD Coldstorage\TGD WMS`

## New Project Scope

TGD WMS is a new build WMS project. New code, documentation, tests, database planning, and integration planning must be created inside the new project structure.

The new build will define its own application architecture, data model, movement-ledger inventory behavior, audit logging, customer isolation, barcode support, cold storage billing support, and integration boundaries.

TGD WMS is a cold storage deposit, storage, and customer withdrawal system. Customers own the inventory. TGD receives, stores, moves, counts, and dispatches customer-owned goods.

This is not a sales-order WMS and not a sales invoicing system. Outbound work starts from Customer Withdrawal Requests, not commercial orders. Accounting handoff should be a Monthly Storage Billing Summary or export based on weight, storage period, remaining balance, and operation charges such as repack or sorting.

## Legacy Reference Scope

Legacy files may be read only to understand business requirements, workflows, field names, or operational behavior. Legacy knowledge must be rewritten into new documentation before being implemented.

Legacy files are not part of the new runtime boundary.

## Files Forbidden To Edit

- Old system `App.jsx`
- Legacy application files
- Legacy database/schema files
- Legacy sync scripts
- Any file inside old system folders unless explicitly moved into `legacy-reference/` as documentation

## Files Allowed To Create

- New source files under `src/`
- New database planning files under `database/`
- New integration planning files under `integrations/`
- New documentation under `docs/`
- New tests under `tests/`
- Legacy reference notes under `legacy-reference/`

## AI Roles

- ChatGPT = Controller
- Codex = Code Builder
- Antigravity = QA / Runner
