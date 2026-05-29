# Sprint 5C Implementation Notes

## Scope

Sprint 5C adds the UI foundation for internal warehouse operations:

- Transfer list, read-only detail, and draft create pages.
- Adjustment list, read-only detail, and draft create pages.
- Stock count list, read-only detail, and draft create pages.

The pages are routed through `src/app/routes.jsx` and keep feature code under `src/features/*`.

## Draft-Only Guardrail

Create pages only call existing service-layer create functions and always submit `status: 'DRAFT'`.

Transfer, adjustment, and stock count detail pages are read-only. They show document headers and line tables, but do not expose posting, completion, or adjustment generation actions.

## Posting And Completion Exclusions

Sprint 5C intentionally does not wire UI actions for:

- transfer posting
- adjustment posting
- stock count completion
- adjustment generation from stock count
- inventory movement posting
- stock balance updates

These operations remain backend-controlled and are not part of the internal operation UI foundation.

## Route Structure

Routes added in this sprint:

- `/operations/transfer`
- `/operations/transfer/new`
- `/operations/transfer/:id`
- `/operations/adjustment`
- `/operations/adjustment/new`
- `/operations/adjustment/:id`
- `/stock-count`
- `/stock-count/new`
- `/stock-count/:id`

Existing placeholder routes now render the list-page foundations.

## Service Usage

UI pages use only the service layer:

- `getTransferDocuments`, `getTransferDocumentById`, `createTransferDocument`
- `getAdjustmentDocuments`, `getAdjustmentDocumentById`, `createAdjustmentDocument`
- `getStockCountDocuments`, `getStockCountDocumentById`, `createStockCountDocument`

Posting and completion service helpers are intentionally not imported into UI pages.

## Next Sprint Recommendation

Sprint 5D should add Withdrawal Request / Allocation / Picking / Dispatch UI foundation, still without stock posting or handheld scan UI.
