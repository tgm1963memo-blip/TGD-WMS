# 14L Outbound Navigation & UX Hardening

Sprint 14L improves navigation and page UX for outbound read-only list/detail and the outbound draft smoke UI.

## Scope

- Navigation/UX only.
- No migration applied.
- No Production touched.
- Adds menu entries for:
  - Outbound Documents / รายการจ่ายสินค้าออก
  - Outbound Draft / ทดลองสร้างเอกสารจ่ายออก
- Keeps `/operations/outbound` as the read-only list/detail route.
- Keeps `/operations/outbound-draft` as the draft/reserve/release smoke route.

## UX Changes

- Outbound list keeps the safety note visible.
- Outbound list keeps Refresh.
- Outbound list empty state now says missing rows may be caused by read permission.
- Outbound list links to the draft smoke UI.
- Outbound draft links back to the outbound document list.
- Result JSON and error message areas remain visible and explicit.

## Safety Boundaries

- No post outbound.
- No `tgd_rpc_post_outbound_document`.
- No stock_movement OUT.
- No stock_balance update.
- No insert into `tgd_stock_movements`.
- No update to `tgd_stock_balances`.
- No stock movement service call.
- No stock balance mutation service call.
- No delete/truncate.

Read-only list/detail remains safe. The draft page remains draft/reserve/release only and does not perform stock posting.
