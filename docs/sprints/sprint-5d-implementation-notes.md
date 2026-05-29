# Sprint 5D Implementation Notes

## Scope

Sprint 5D adds outbound UI foundation pages for:

- withdrawal request list, read-only detail, and draft create
- allocation list, read-only detail, and draft create
- picking list, read-only detail, and draft create
- dispatch list, read-only detail, and draft create

The pages are route-driven through `src/app/routes.jsx` and live under `src/features/operations/*`.

## Draft-Only Guardrail

Create pages save header drafts only. They call existing service-layer create functions and submit `status: 'DRAFT'`.

Line entry remains placeholder-only in this sprint. Detail pages are read-only and show the header plus existing line rows.

## Confirm And Post Exclusions

Sprint 5D intentionally does not add UI actions for confirming, posting, goods issue, movement posting, or stock balance mutation. Those actions remain backend-controlled and are outside this UI foundation.

## Route Structure

Routes added in this sprint:

- `/operations/withdrawal-requests`
- `/operations/withdrawal-requests/new`
- `/operations/withdrawal-requests/:id`
- `/operations/allocations`
- `/operations/allocations/new`
- `/operations/allocations/:id`
- `/operations/picking`
- `/operations/picking/new`
- `/operations/picking/:id`
- `/operations/dispatch`
- `/operations/dispatch/new`
- `/operations/dispatch/:id`

Existing placeholder route pages now render the list-page foundations.

## Service Usage

UI pages use only read and draft-create service functions:

- `getWithdrawalRequests`, `getWithdrawalRequestById`, `createWithdrawalRequest`
- `getWithdrawalAllocations`, `getWithdrawalAllocationById`, `createWithdrawalAllocation`
- `getPickingDocuments`, `getPickingDocumentById`, `createPickingDocument`
- `getDispatchDocuments`, `getDispatchDocumentById`, `createDispatchDocument`

Confirm and post helpers are intentionally not imported into UI pages.

## Terminology

Outbound UI uses customer withdrawal request terminology throughout.

## Next Sprint Recommendation

Sprint 5E should add operational detail polish, filters, and line-entry foundations while continuing to keep posting and handheld scan flows out of React pages.
