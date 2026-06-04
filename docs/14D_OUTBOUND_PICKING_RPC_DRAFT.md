# 14D Outbound / Picking RPC Draft

## Scope

This sprint is RPC draft only for outbound document creation, outbound line entry, reservation, and reservation release.

The draft migration is:

- `database/migrations/026_tgd_wms_outbound_picking_rpc_draft.sql`

## RPCs Drafted

- `tgd_rpc_create_outbound_draft`
- `tgd_rpc_add_outbound_line`
- `tgd_rpc_reserve_outbound_stock`
- `tgd_rpc_release_outbound_reservation`

## Safety Boundaries

- No post outbound RPC is created.
- No stock_movement OUT is created.
- No stock_balance update is performed.
- No Production touched.
- No stock-reducing trigger is created.
- No manual stock balance mutation is introduced.

## Reservation Meaning

Reservation only locks outbound picking intent.

An ACTIVE outbound reservation records which line and location are intended for picking, but it does not consume physical stock and does not reduce available stock balance.

Releasing a reservation only changes reservation status and outbound document or line metadata back toward draft/open state when no active reservation remains.

## Later Sprint Boundary

Stock decrease remains trigger-driven only in a later sprint.

14D intentionally does not define physical stock issue, outbound posting, movement insertion, or balance decrement behavior.
