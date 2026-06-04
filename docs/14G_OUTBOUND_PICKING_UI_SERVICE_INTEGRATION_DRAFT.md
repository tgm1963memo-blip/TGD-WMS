# 14G Outbound / Picking UI Service Integration Draft

## Scope

14G is service/UI integration draft only.

The sprint adds a frontend service wrapper for the four safe outbound picking RPCs created in the Staging-only RPC draft layer.

## Service Calls

`src/services/outboundPickingService.js` calls only:

- `tgd_rpc_create_outbound_draft`
- `tgd_rpc_add_outbound_line`
- `tgd_rpc_reserve_outbound_stock`
- `tgd_rpc_release_outbound_reservation`

The service validates required inputs before calling RPCs and throws clear errors for invalid payloads or Supabase RPC failures.

## Safety Boundaries

- No post outbound action.
- No stock_movement OUT.
- No stock_balance update.
- No Production touched.
- No migration applied in this sprint.
- No stock-reducing trigger.
- No local stock mutation.

## UI Boundary

14G does not add a real post button and does not wire any destructive outbound action.

Light UI wiring can happen later around these service wrappers, but physical stock issue remains out of scope for this sprint.

## Later Sprint Boundary

Stock decrease remains reserved for a later controlled sprint.

Outbound reservation records picking intent only; it is not physical stock consumption and it does not decrement stock balance.
