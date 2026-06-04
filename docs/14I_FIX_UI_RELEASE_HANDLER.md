# 14I Fix UI Release Handler Verification

## Scope

This sprint verifies the outbound reservation release UI handler only.

No migration was applied. Production was not touched.

## Confirmed Baseline

- 14H is closed / PASS.
- UI create draft passed.
- UI add line passed.
- UI reserve passed.
- Direct SQL RPC release passed in Staging.
- `tgd_rpc_release_outbound_reservation` works correctly when called directly.

## Fix / Verification

The UI release form keeps a clearly labeled `reservation_id` input and submits exactly:

```js
{
  reservation_id: '<value from input>'
}
```

to `releaseOutboundReservation(payload)`.

The service calls only:

```js
supabase.rpc('tgd_rpc_release_outbound_reservation', {
  p_reservation_id: payload.reservation_id,
})
```

The UI displays the JSON result after a successful release and displays the error message if release fails. Errors are not silently ignored.

## Safety Boundaries

- No Production touched.
- No migration applied.
- No Post Outbound button added.
- No `tgd_rpc_post_outbound_document` created or called.
- No outbound posting action added.
- No `stock_movement OUT` added.
- No insert into `tgd_stock_movements`.
- No `stock_balance update` added.
- No `tgd_stock_balances` update.
- No stock movement service call.
- No stock balance mutation service call.
- No delete/truncate behavior added.

## Test Coverage

Unit UI coverage verifies:

- typing a `reservation_id` and clicking `Release Reservation` calls `releaseOutboundReservation({ reservation_id })`
- successful release result JSON is displayed
- rejected release service errors are displayed to the user
- no Post Outbound UI is present
- no unsafe outbound posting or stock mutation patterns are introduced

Unit service coverage verifies:

- `releaseOutboundReservation` requires `reservation_id`
- it calls `tgd_rpc_release_outbound_reservation`
- it passes `p_reservation_id: payload.reservation_id`
- it does not reference outbound posting, stock movement OUT, stock balance mutation, or DML patterns
