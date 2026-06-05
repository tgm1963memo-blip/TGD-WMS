# 15G Post Outbound Production Readiness Review

## A. Scope

- Production readiness review only.
- No Production touched.
- No migration applied.
- No runtime code changed.
- No stock mutation performed in this sprint.

This sprint is documentation and safety test coverage only. It does not apply migrations, change runtime application behavior, or execute outbound stock posting.

## B. Current Staging Status

- Controlled Pick passed RPC smoke.
- Controlled Pick passed UI smoke.
- Controlled Pick edge case passed.
- Post Outbound RPC passed Staging smoke.
- Post Outbound edge case passed.
- Post Outbound gated UI passed smoke.
- Feature gate disabled after test.
- Staging movement_count = 16.
- Staging stock_balance quantity = 1018.
- Staging stock_balance weight = 1000.

## C. Related Migrations

- `025` outbound picking foundation: establishes the outbound picking data foundation needed before controlled pick and post workflows.
- `026` outbound picking RPC draft: adds controlled draft/reserve/release RPC behavior for outbound picking workflow smoke testing.
- `027` outbound read-only RLS: enables SELECT-only read model access for outbound document, line, and reservation views/tables used by UI.
- `028` outbound grant hardening: revokes unsafe direct privileges and keeps authenticated read access limited.
- `029` controlled pick confirmation RPC: adds the controlled pick confirmation boundary used before outbound posting.
- `030` post outbound RPC: adds the controlled outbound posting RPC that creates `PICK_CONFIRM` movement and updates stock balance through the approved database path.

## D. Related UI / Routes

- `/operations/outbound`
- `/operations/outbound-draft`
- `/operations/picking-draft`

Post Outbound UI is feature-gated. The feature gate must remain disabled unless explicitly approved.

## E. Production Risk Register

- `stock_balance` decrease risk: Post Outbound intentionally decreases stock balance through the controlled RPC once approved.
- Duplicate movement risk: idempotency and post reference behavior must be verified before Production apply.
- Weight balance behavior risk: quantity and weight effects must match business expectations and UAT evidence.
- RLS/permission risk: authenticated users must have only the intended read and execute permissions.
- Feature gate accidentally enabled risk: the gated UI must remain disabled by default until approved.
- Rollback/reversal not yet implemented risk: operational reversal is not yet available as a controlled workflow.
- Smoke data not available in Production risk: Production may not contain the same safe documents used in Staging smoke tests.
- Migration order risk: applying migrations out of sequence can break function dependencies or permissions.
- User training risk: warehouse users must understand controlled pick versus post outbound boundaries before go-live.

## F. Required Pre-Production Checks

- Backup/PITR confirmed.
- Production project ref confirmed.
- Maintenance window confirmed.
- Migration order confirmed.
- Staging evidence attached/reviewed.
- Feature gate default disabled.
- Role permission reviewed.
- Audit log reviewed.
- Rollback owner identified.
- Reversal process design approved or explicit accepted risk.
- Business owner approval.
- Warehouse manager approval.
- System admin approval.
- Accounting/finance approval if stock valuation is affected.

## G. Production Apply Sequence Proposal

This is a proposal only, not an action.

1. Apply migration `025` if not already in Production.
2. Apply migration `026`.
3. Apply migration `027`.
4. Apply migration `028`.
5. Apply migration `029`.
6. Apply migration `030`.
7. Run verification SQL.
8. Keep Post Outbound UI feature gate disabled.
9. Run read-only smoke first.
10. Run controlled write smoke only after explicit approval.

## H. Production Verification SQL Checklist

Use read-only checks first:

```sql
-- RPC exists.
select p.proname, pg_get_function_identity_arguments(p.oid) as args
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'tgd_rpc_confirm_outbound_pick',
    'tgd_rpc_post_outbound_document'
  );

-- Required columns exist.
select table_name, column_name, data_type
from information_schema.columns
where table_schema = 'public'
  and table_name in (
    'tgd_outbound_documents',
    'tgd_outbound_lines',
    'tgd_outbound_reservations',
    'tgd_stock_movements',
    'tgd_stock_balances'
  )
order by table_name, ordinal_position;

-- Grants and policies.
select grantee, table_name, privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name in (
    'tgd_outbound_documents',
    'tgd_outbound_lines',
    'tgd_outbound_reservations'
  )
order by table_name, grantee, privilege_type;

select schemaname, tablename, policyname, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'public'
  and tablename in (
    'tgd_outbound_documents',
    'tgd_outbound_lines',
    'tgd_outbound_reservations'
  )
order by tablename, policyname;

-- movement_count baseline.
select count(*) as movement_count
from public.tgd_stock_movements;

-- stock_balance baseline.
select product_id, location_id, quantity, weight
from public.tgd_stock_balances
order by updated_at desc nulls last
limit 20;

-- Feature gate status if configurable outside the app build.
-- Confirm VITE_ENABLE_POST_OUTBOUND_UI is absent or false in the deployed UI environment.

-- No unexpected unsafe grants.
select grantee, table_name, privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and grantee in ('anon', 'authenticated')
  and table_name in (
    'tgd_outbound_documents',
    'tgd_outbound_lines',
    'tgd_outbound_reservations',
    'tgd_stock_movements',
    'tgd_stock_balances'
  )
  and privilege_type in ('INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER')
order by table_name, grantee, privilege_type;
```

## I. FINAL GO Checklist

Exact required approval phrase:

FINAL GO: Apply Outbound migrations 025-030 to Production

Required fields:

- Production project ref:
- PITR/backup:
- Downtime window:
- Business owner approval:
- Warehouse manager approval:
- Accounting/finance approval:
- System admin approval:
- Rollback owner:
- Post-apply verifier:
- Feature gate default disabled confirmed:
- Reversal/rollback risk accepted:

## J. Recommendation

Recommended next sprint:

- 15H Outbound Production Dry Run Checklist

No Production apply until explicit FINAL GO. The dry run should verify migration order and rollback plan. Production apply remains HOLD.
