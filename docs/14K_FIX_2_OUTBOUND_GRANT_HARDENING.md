# 14K-Fix-2 Outbound Grant Hardening

Sprint 14K-Fix-2 is a grant hardening draft for the outbound read-only tables after the 027 RLS policy migration.

## Scope

- Grant hardening only.
- No Production touched.
- Migration not applied yet.
- Keeps outbound access read-only through table grants and existing RLS.
- Authenticated users keep SELECT only on:
  - `public.tgd_outbound_documents`
  - `public.tgd_outbound_lines`
  - `public.tgd_outbound_reservations`
- Anon has no direct read/write access to these outbound tables.

## Revoked Privileges

For both `anon` and `authenticated`, the draft revokes:

- INSERT
- UPDATE
- DELETE
- TRUNCATE
- REFERENCES
- TRIGGER

## Safety Boundaries

- No post outbound.
- No `tgd_rpc_post_outbound_document`.
- No stock_movement OUT.
- No stock_balance update.
- No insert into `tgd_stock_movements`.
- No update to `tgd_stock_balances`.
- No stock-reducing trigger.
- No destructive SQL against data.

This sprint does not change outbound RLS policy logic from 027 and does not touch stock tables.
