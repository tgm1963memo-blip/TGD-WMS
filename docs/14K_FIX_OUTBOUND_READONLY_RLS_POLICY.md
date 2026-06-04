# 14K Fix Outbound Read-Only RLS Policy

Sprint 14K is a read-only RLS policy draft for the outbound list/detail screen.

## Scope

- Adds SELECT-only RLS policies for `public.tgd_outbound_documents`.
- Adds SELECT-only RLS policies for `public.tgd_outbound_lines`.
- Adds SELECT-only RLS policies for `public.tgd_outbound_reservations`.
- Keeps RLS enabled on all three outbound tables.
- Uses the existing authenticated, active-user, role-aware policy style.
- Customer-scoped users only see their own customer documents through `customer_id`.

## Safety Boundaries

- Read-only RLS policy only.
- SELECT only.
- No insert/update/delete policy.
- No post outbound.
- No `tgd_rpc_post_outbound_document`.
- No stock_movement OUT.
- No stock_balance update.
- No insert into `tgd_stock_movements`.
- No update to `tgd_stock_balances`.
- No stock-reducing trigger.
- No delete/truncate.
- No Production touched.
- Migration not applied yet.

## Expected Result

After applying the migration in an approved Staging run, authenticated users with an active profile and one of the allowed operational roles can read the outbound list/detail data needed by `/operations/outbound`.

The page remains read-only. Outbound posting and physical stock decrease remain blocked for a later controlled sprint.
