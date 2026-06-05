# 15C Post Outbound UI Design Review

## A. Scope

This sprint is design review only.

- No runtime UI implementation.
- No UI Post Outbound button added.
- No service call from UI.
- No migration applied.
- No Production touched.

## B. Current State

- Outbound list/detail UI exists.
- Picking draft UI exists.
- Controlled Pick UI exists.
- Post Outbound RPC exists on Staging only.
- 15A smoke passed.
- 15B edge case safety UAT passed.
- No Production touched.

## C. Future UI Entry Point

Recommended future entry point:

- Outbound detail page, or picking draft page after the document is `PICKED`.

The future Post Outbound UI must not be shown on draft, reserved, or partial-pick documents. It must be hidden or disabled unless document status is `PICKED` and all lines are fully picked.

## D. Display Rules

The future UI should display:

- Document status.
- Picked quantity vs requested quantity.
- Reservation consumed status.
- Current stock location/lot/product if available.
- Warning that posting will create `PICK_CONFIRM` movement and decrease stock_balance.
- Current user/role if available.

## E. Button Gating

A future Post Outbound button may appear only when:

- Document status is `PICKED`.
- Every line is fully picked.
- At least one consumed picked reservation exists.
- User has authorized warehouse role.
- No existing `CONFIRMED` `post_reference` on the document.
- Staging smoke has passed.
- Feature flag or environment gate allows it.

## F. Validation Rules

The future UI must require:

- `post_reference` required.
- `post_reference` uniqueness/idempotency.
- Confirmation checkbox or modal acknowledgment.
- No blank `post_reference`.
- User confirms stock decrease warning.

## G. Confirmation Modal Design

The confirmation modal must include:

- Document no.
- Total picked quantity.
- Total picked weight.
- Movement type `PICK_CONFIRM`.
- Stock will decrease.
- This action cannot be manually deleted.
- Reversal requires separate controlled process.
- Confirm / Cancel buttons.

## H. Success UX

After success:

- Show `post_result` JSON summary or user-friendly summary.
- Document status becomes `CONFIRMED`.
- Movement count may increase.
- Stock balance decreases.
- Reload document detail.
- Disable or hide Post button after confirmed.

## I. Error UX

The future UI must handle:

- Document not `PICKED`.
- Already posted with different reference.
- Insufficient stock.
- Permission denied.
- RPC/service error.
- Network error.
- Friendly messages only; no raw stack traces.

## J. Permission/RLS

- Only `admin` / `warehouse_manager` should see an enabled button initially.
- `warehouse_staff` may be a future option only after business approval.
- Customer-scoped users should not post.
- Unauthenticated users cannot post.

## K. Audit / Traceability

The UI must display or capture:

- `post_reference`.
- `posted_by`.
- `posted_at`.
- Source movement reference.
- Movement count / movement ids after post if available.

## L. Safety Checklist Before Implementation

Before any UI implementation:

- No direct stock edit.
- No manual stock movement insert.
- Only call RPC.
- No delete/truncate.
- No Production.
- Feature flag recommended.
- Staging UI smoke required before Production consideration.

## M. Recommendation

Recommended next sprint:

- 15D Post Outbound UI Draft.

Constraints for 15D:

- UI draft only.
- Staging only.
- No Production.
- Feature flag or hidden route/gate.
- No automatic posting.
- Controller approval required before commit.
