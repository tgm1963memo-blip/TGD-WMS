# Sprint 5E Implementation Notes

## Filter And Toolbar Approach

Sprint 5E adds reusable operational UI components for document lists:

- `DocumentFilterBar` for search, status, type, date, customer, and warehouse filter fields.
- `DocumentToolbar` for list title, draft creation link, refresh, and disabled export placeholder.

Operational list pages now render both components before their document tables.

## Line Editor Foundation

`DraftLineEditor` provides a UI-only draft line grid for product, lot, location, pallet, quantity, UOM, and remark fields.

The editor does not import Supabase, does not call service methods, and does not save line records by itself. It can emit line state through an optional callback for a later safe draft-line persistence sprint.

## Draft-Only Guardrail

Create pages still submit draft document headers only. Sprint 5E does not add posting, confirming, completion, goods issue, stock count completion, or adjustment generation actions.

## Transaction Safety Rules

React UI remains outside stock mutation responsibilities:

- no inventory movement posting
- no stock balance updates
- no workflow confirm/post/completion RPC calls
- no handheld scan workflow
- no Express sync
- no database migration changes

## Terminology

Outbound wording remains based on customer withdrawal requests.

## Next Sprint Recommendation

Sprint 5F should add safe draft-line persistence only where service and RLS support are explicit, with validation tests proving no stock posting or workflow confirmation occurs from UI.
