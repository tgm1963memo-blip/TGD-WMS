# 13J-AL Receiving Master Pickers

## Why Raw UUID Entry Was Unsafe

The 13J-AK receiving flow works end to end, but the create page still required operators to paste raw UUID values for customer, product, lot, and location.

That was risky because:

- Operators could paste a valid UUID from the wrong master record.
- Product and lot mismatches were easy to create.
- Location mistakes were hard to see before Confirm/Post.
- UUID-only fields did not show business labels for review.

## Picker Read-Only Rule

13J-AL adds read-only receiving picker lookups for:

- Customers from `tgd_customers`
- Products from `tgd_products`
- Lots from `tgd_lots`
- Locations from `tgd_locations`

The picker functions use SELECT only and normalize rows into display labels with the underlying ID preserved for traceability.

## RPC-Only Write Rule

Receiving writes remain on the existing service wrappers:

- Create Draft uses `createReceivingDocument`, which calls `tgd_rpc_create_receiving_draft`.
- Add Line uses `addReceivingLine`, which calls `tgd_rpc_add_receiving_line`.
- Confirm/Post uses `postReceivingDocument` only.

The UI must not call receiving RPC names directly and must not call Supabase directly.

## Fallback Behavior

The default UX is picker-first.

If master data is missing or a controlled test scenario requires direct IDs, the page exposes an advanced `Use manual UUID entry` fallback. The fallback still submits through the same service wrappers and does not add direct table writes.

## Production Locked

Production remains locked.

13J-AL does not run SQL, apply migrations, insert stock movements manually, update stock balances manually, or touch Production.
