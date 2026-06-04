# 14H Outbound / Picking UI Draft Screens

## Scope

14H adds UI draft screens only.

The new draft smoke screen is `OutboundDraftPage` and is intended for safe service integration checks around outbound draft, line, reservation, and release behavior.

## Route

The draft screen is available at:

- `/operations/outbound-draft`

Existing picking and dispatch routes are left intact.

## Service Boundary

The UI calls only the four safe outbound picking service wrappers:

- `createOutboundDraft`
- `addOutboundLine`
- `reserveOutboundStock`
- `releaseOutboundReservation`

## Safety Boundary

- No post outbound.
- No stock_movement OUT.
- No stock_balance update.
- No Production touched.
- No migration applied.
- No stock movement service call.
- No stock balance mutation service call.
- No stock-reducing trigger.

## Later Sprint Boundary

Stock decrease remains for a later controlled sprint.

14H records draft, reservation, and release intent only. It does not perform physical outbound stock issue.
