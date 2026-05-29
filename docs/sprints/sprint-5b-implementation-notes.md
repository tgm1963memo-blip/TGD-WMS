# Sprint 5B Implementation Notes

Sprint 5B adds the inbound operational UI foundation for Receiving and Putaway.

## Receiving UI Scope

Receiving now has list, detail, and draft create pages under `src/features/operations/receiving`. The list and detail pages are read-only. The create page saves a DRAFT receiving document header only.

## Putaway UI Scope

Putaway now has list, detail, and draft create pages under `src/features/operations/putaway`. The list and detail pages are read-only. The create page saves a DRAFT putaway document header only.

## Draft-Only Guardrail

Create forms set `status = DRAFT`. Line entry is intentionally a placeholder and no stock-impacting action is exposed.

## Why Posting Is Not Included

Posting changes inventory state and belongs in later controlled workflow UI. Sprint 5B does not call receiving post, putaway post, inventory movement, adjustment post, or stock balance update logic.

## Route Structure

Inbound routes added:

- `/operations/receiving`
- `/operations/receiving/new`
- `/operations/receiving/:id`
- `/operations/putaway`
- `/operations/putaway/new`
- `/operations/putaway/:id`

## Service Usage

Pages use `receivingService` and `putawayService` for read and draft-create calls. Posting helpers exist in those services but are not imported or called by Sprint 5B UI pages.

## Next Sprint Recommendation

Sprint 5C should add Transfer and Adjustment UI Foundation with the same read-only and draft-only guardrails.
