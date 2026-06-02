# Sprint 13J-J Receiving RPC Contract Design

## Purpose

This document defines the proposed Receiving RPC contract for TGD WMS staging validation. It is a design contract only. It does not enable Receiving write behavior, does not apply SQL, and does not unlock the Receiving UI.

TGD WMS is a Cold Storage system for customer-owned inventory. Receiving must remain controlled, traceable, and protected by backend validation before any real operational write is enabled.

## Current Audit Findings

The actual staging database tables for Receiving are minimal.

`tgd_receiving_documents` currently includes:

| Column | Type |
| --- | --- |
| id | uuid |
| customer_id | uuid |
| document_no | text |
| status | text |
| created_at | timestamptz |
| updated_at | timestamptz |

`tgd_receiving_lines` currently includes:

| Column | Type |
| --- | --- |
| id | uuid |
| document_id | uuid |
| product_id | uuid |
| lot_id | uuid |
| quantity | numeric |
| weight | numeric |
| created_at | timestamptz |
| updated_at | timestamptz |

Existing UI and service assumptions referenced fields that do not exist in the audited table shape:

| Non-existing field referenced by UI/service | Gap |
| --- | --- |
| receiving_no | Actual document identifier is `document_no` |
| warehouse_id | Not present on receiving document |
| receiving_type | Not present on receiving document |
| source_no | Not present on receiving document |
| remark | Not present on receiving document |
| expected_receive_date | Not present on receiving document |
| received_qty | Receiving line uses `quantity` |
| to_location_id | Not present on receiving line |
| uom | Not present on receiving line |

`receivingService.js` currently references `tgd_post_receiving_document`, but the database audit did not return that RPC. Therefore `tgd_post_receiving_document` is not approved for use by the frontend or by a Receiving write enablement sprint.

The audit did not return a Row Level Security policy for `tgd_receiving_lines`. `tgd_receiving_lines` RLS must be confirmed and evidenced before any Receiving write flow is enabled.

The current stock movement RPC path works for the controlled 13J-H dry run and now traces `reference` and `created_by`, but it still derives `product_id` and `lot_id` from an existing stock balance. That makes it unsuitable for real Receiving line posting, where the received product and lot must come from the receiving line contract.

## Contract Gaps

The Receiving write contract is not ready because:

- The UI model and service model include fields that are not present in the actual database tables.
- The referenced `tgd_post_receiving_document` RPC is not approved for use because it was not found in the database audit.
- `tgd_receiving_lines` RLS evidence is missing.
- The current stock movement RPC does not accept Receiving line `product_id`, `lot_id`, and `location_id` explicitly.
- The Receiving create UI is correctly locked and must remain locked until a future approved write sprint.

## Current UI Lock Statement

The current Receiving UI remains locked.

`/operations/receiving/new` must remain an Operational Write Gate page only. It must not enable Save Draft, Submit, Confirm, post, or stock mutation behavior until a future sprint approves the Receiving RPC implementation and RLS evidence.

## Proposed Safe Receiving Flow

The safe future flow should be RPC-only from the frontend:

1. Authenticated staging user opens Receiving create flow after approval.
2. Frontend calls `tgd_rpc_create_receiving_draft` to create a draft document.
3. Frontend calls `tgd_rpc_add_receiving_line` for each validated line.
4. Frontend calls `tgd_rpc_confirm_receiving_document` only after document and line validation pass.
5. Confirm RPC creates validated stock movement records through a future stock movement RPC extension that accepts `product_id`, `lot_id`, and `location_id`.
6. Stock balance changes remain backend-controlled and trigger/RPC-controlled only.

The frontend must not write directly to `tgd_receiving_documents`, `tgd_receiving_lines`, `tgd_stock_movements`, or `tgd_stock_balances`.

## Proposed RPC List

### `tgd_rpc_create_receiving_draft`

Purpose:

- Create a Receiving document in `DRAFT` status.
- Return the created document ID and document number.

Proposed inputs:

| Parameter | Purpose |
| --- | --- |
| `p_customer_id uuid` | Customer-owned inventory owner |
| `p_document_no text` | External or generated document number if approved |
| `p_reference text` | Traceability reference |

Required behavior:

- Validate authenticated user.
- Validate customer access.
- Insert only allowed document columns.
- Set `created_by` if the column exists or record equivalent audit evidence.
- Set `reference` if the final table contract includes it.
- Return structured success/error result.

### `tgd_rpc_add_receiving_line`

Purpose:

- Add a product/lot quantity line to a draft Receiving document.

Proposed inputs:

| Parameter | Purpose |
| --- | --- |
| `p_document_id uuid` | Draft Receiving document |
| `p_product_id uuid` | Product being received |
| `p_lot_id uuid` | Lot being received |
| `p_quantity numeric` | Received quantity |
| `p_weight numeric` | Optional received weight |
| `p_reference text` | Traceability reference |

Required behavior:

- Validate authenticated user.
- Validate document exists and is `DRAFT`.
- Validate document customer access.
- Validate product and lot are allowed.
- Validate positive quantity.
- Insert only allowed line columns.
- Return created line ID.

### `tgd_rpc_confirm_receiving_document`

Purpose:

- Confirm a draft Receiving document and create backend-controlled stock movements.

Proposed inputs:

| Parameter | Purpose |
| --- | --- |
| `p_document_id uuid` | Receiving document to confirm |
| `p_location_id uuid` | Approved Receiving target location |
| `p_reference text` | Confirmation traceability reference |

Required behavior:

- Validate authenticated user.
- Validate document exists and is `DRAFT`.
- Validate at least one valid line exists.
- Validate `tgd_receiving_lines` access and RLS behavior.
- Validate target location.
- For each line, create a stock movement through a future stock movement RPC extension.
- Mark document `CONFIRMED` only after all line movements succeed.
- Preserve atomic behavior where possible.
- Return document ID and generated movement IDs.

### Future Stock Movement RPC Extension

The future stock movement RPC must accept explicit Receiving line fields:

| Parameter | Purpose |
| --- | --- |
| `p_movement_type text` | Movement type, such as Receiving confirmation |
| `p_customer_id uuid` | Customer-owned inventory owner |
| `p_product_id uuid` | Product from receiving line |
| `p_lot_id uuid` | Lot from receiving line |
| `p_quantity numeric` | Movement quantity |
| `p_source_location_id uuid` | Nullable for inbound Receiving |
| `p_target_location_id uuid` | Target location |
| `p_reference text` | Traceability reference |

The future stock movement RPC must not derive `product_id` or `lot_id` from an existing stock balance for Receiving confirmation.

## Required Validation Rules

Before write enablement:

- User must be authenticated.
- User role must be authorized for Receiving draft or confirmation action.
- Customer must exist and be accessible to the user.
- Receiving document must use only actual approved database fields.
- Receiving line must use actual approved fields: `document_id`, `product_id`, `lot_id`, `quantity`, `weight`.
- Quantity must be greater than zero.
- Weight, if provided, must not be negative.
- Product must exist.
- Lot must exist or follow an approved controlled lot creation process in a separate future sprint.
- Target location must exist and be allowed for Receiving.
- Document status transition must be controlled: `DRAFT` to confirmed status only through RPC.
- Duplicate document number handling must be defined before enabling write.

## Required RLS Rules

Before Receiving write enablement:

- `tgd_receiving_documents` RLS must be reviewed and evidenced.
- `tgd_receiving_lines` RLS must exist, be enabled, and be evidenced.
- Plain requirement: tgd_receiving_lines RLS is required before Receiving write enablement.
- Customer isolation must be enforced for customer-owned inventory.
- Warehouse users must only perform approved Receiving operations.
- Accounting and viewer roles must remain read-only for Receiving.
- Admin role must not bypass traceability requirements.
- Unauthenticated access must not write or read protected Receiving data.
- Direct table writes from the frontend must not be permitted.
- RPCs must run with a reviewed security model and must not weaken RLS unintentionally.

## Required Audit and Traceability Fields

The final contract must preserve traceability for every write:

- `reference` must be captured for Receiving draft, line, and confirmation operations where schema supports it.
- `created_by` must use `auth.uid()` where columns or audit logs support it.
- `updated_by` should be added in a future schema design if update flows are approved.
- `created_at` and `updated_at` must be maintained.
- Confirmation should return movement IDs for audit review.
- Every stock movement created by Receiving confirmation must include a reference to the Receiving document or line.
- Audit evidence must show who created, who confirmed, when it happened, and which RPC path was used.

No service_role key is allowed in frontend code, browser configuration, or operational user flow.

## Staging-Only Rollout Plan

1. Keep Receiving UI locked.
2. Complete RLS evidence for `tgd_receiving_documents` and `tgd_receiving_lines`.
3. Draft migration for proposed RPCs in a future sprint.
4. Review migration manually before applying to staging.
5. Apply only to staging after Controller approval.
6. Test RPCs with demo data only.
7. Validate audit fields: `reference`, `created_by`, document ID, line ID, movement ID.
8. Validate customer isolation and role access.
9. Only after evidence is accepted, update UI in a separate approved sprint.

## Rollback and Compensation Plan

Because Receiving writes create operational inventory records, rollback must be explicit:

- Do not delete confirmed Receiving records casually.
- If a staging test creates an incorrect draft, cancel through an approved future RPC.
- If a staging test creates an incorrect confirmed movement, use a reviewed compensation movement path in a future sprint.
- Keep all failed test references and movement IDs in the evidence log.
- Do not directly update `tgd_stock_balances`.
- Do not directly delete `tgd_stock_movements`.
- Do not use ad hoc SQL correction without Controller approval.

## Explicit Out-of-Scope Items

This Sprint 13J-J design does not include:

- Enabling Receiving Save Draft.
- Enabling Receiving Confirm.
- Changing `ReceivingCreatePage` to call write services.
- Changing `receivingService.js` to call the proposed RPCs.
- Applying SQL migrations.
- Weakening RLS.
- Exposing service_role keys.
- Direct frontend insert, update, delete, or upsert.
- Direct stock balance mutation.
- Production rollout.

## Decision Gate

Receiving write enablement requires a future approved sprint after:

- RPC contract is accepted.
- RLS evidence is complete.
- Migration is reviewed.
- Staging dry run is approved.
- UI gate removal is explicitly approved.
