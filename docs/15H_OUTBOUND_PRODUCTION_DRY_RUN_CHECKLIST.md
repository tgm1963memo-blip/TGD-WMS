# 15H Outbound Production Dry Run Checklist

## A. Scope

- Dry run checklist only.
- No Production touched.
- No migration applied.
- No runtime code changed.
- No stock mutation performed.

This sprint prepares the operator checklist for a future Production apply decision. It does not execute SQL against Production and does not change application behavior.

## B. Preconditions

- Repo clean.
- Latest commit `aa0ddbf` confirmed.
- Staging UAT evidence reviewed.
- Production project ref confirmed but not used yet.
- PITR/backup confirmed before real apply.
- Maintenance window confirmed.
- Feature gate default disabled.
- Role/permission owner confirmed.
- Rollback owner confirmed.
- Post-apply verifier confirmed.

## C. Migration Order

1. `025_tgd_wms_outbound_picking_foundation.sql`
2. `026_tgd_wms_outbound_picking_rpc_draft.sql`
3. `027_tgd_wms_outbound_readonly_rls.sql`
4. `028_tgd_wms_outbound_grant_hardening.sql`
5. `029_tgd_wms_controlled_pick_confirmation_rpc_draft.sql`
6. `030_tgd_wms_post_outbound_rpc_draft.sql`

## D. Dry Run Operator Checklist

- Open each migration file.
- Confirm no destructive SQL except approved index re-scope in `030`.
- Confirm migration `030` index re-scope is understood.
- Confirm movement trigger behavior understood.
- Confirm weight behavior accepted or separately reviewed.
- Confirm copy SQL content, not filename.
- Confirm apply one migration at a time.
- Confirm stop immediately on error.
- Confirm do not retry blindly.
- Confirm record timestamps and screenshots/results.

## E. Pre-Production Read-Only SQL Checklist

Run these against Production before apply as read-only checks.

```sql
-- Check RPCs do not exist yet.
select p.proname, pg_get_function_identity_arguments(p.oid) as args
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'tgd_rpc_create_outbound_draft',
    'tgd_rpc_add_outbound_line',
    'tgd_rpc_reserve_outbound_stock',
    'tgd_rpc_release_outbound_reservation',
    'tgd_rpc_confirm_outbound_pick_draft',
    'tgd_rpc_post_outbound_document'
  )
order by p.proname;

-- Check outbound tables/columns baseline.
select table_name, column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name in (
    'tgd_outbound_documents',
    'tgd_outbound_lines',
    'tgd_outbound_reservations'
  )
order by table_name, ordinal_position;

-- Check stock movement count baseline.
select count(*) as stock_movement_count_baseline
from public.tgd_stock_movements;

-- Check stock balance baseline.
select product_id, location_id, quantity, weight, updated_at
from public.tgd_stock_balances
order by updated_at desc nulls last
limit 50;

-- Check grants/policies.
select grantee, table_name, privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name in (
    'tgd_outbound_documents',
    'tgd_outbound_lines',
    'tgd_outbound_reservations',
    'tgd_stock_movements',
    'tgd_stock_balances'
  )
order by table_name, grantee, privilege_type;

select schemaname, tablename, policyname, roles, cmd
from pg_policies
where schemaname = 'public'
  and tablename in (
    'tgd_outbound_documents',
    'tgd_outbound_lines',
    'tgd_outbound_reservations'
  )
order by tablename, policyname;

-- Check feature gate not enabled in deployed environment.
-- Confirm VITE_ENABLE_POST_OUTBOUND_UI is absent or false in the deployed UI configuration.
```

## F. Post-Apply Verification SQL Checklist

Run these after migrations are applied, before any write smoke.

```sql
-- RPCs exist.
select p.proname, pg_get_function_identity_arguments(p.oid) as args
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'tgd_rpc_create_outbound_draft',
    'tgd_rpc_add_outbound_line',
    'tgd_rpc_reserve_outbound_stock',
    'tgd_rpc_release_outbound_reservation',
    'tgd_rpc_confirm_outbound_pick_draft',
    'tgd_rpc_post_outbound_document'
  )
order by p.proname;

-- Columns exist for 029/030.
select table_name, column_name, data_type, is_nullable
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

-- Grants are safe.
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
order by table_name, grantee, privilege_type;

-- Policies exist.
select schemaname, tablename, policyname, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'public'
  and tablename in (
    'tgd_outbound_documents',
    'tgd_outbound_lines',
    'tgd_outbound_reservations'
  )
order by tablename, policyname;

-- Movement trigger exists.
select event_object_table, trigger_name, action_timing, event_manipulation
from information_schema.triggers
where trigger_schema = 'public'
  and event_object_table in ('tgd_stock_movements', 'tgd_stock_balances')
order by event_object_table, trigger_name;

-- Stock balance baseline unchanged immediately after migration apply.
select count(*) as movement_count_after_apply
from public.tgd_stock_movements;

select product_id, location_id, quantity, weight, updated_at
from public.tgd_stock_balances
order by updated_at desc nulls last
limit 50;
```

## G. Production Smoke Plan

### Phase 1 Read-Only Smoke

- Open `/operations/outbound`.
- Open `/operations/picking-draft`.
- Confirm feature gate disabled.
- Confirm no Post Outbound button visible.

### Phase 2 Controlled Write Smoke Only After Separate Approval

- Production write smoke only after separate approval.
- Create tiny smoke outbound doc.
- Add line qty `1`.
- Reserve qty `1`.
- Confirm pick qty `1`.
- Post outbound qty `1`.
- Verify movement `+1`.
- Verify stock balance `-1`.
- Verify idempotency.
- Verify no duplicate movement.

## H. Abort Criteria

- Any migration error.
- Unexpected destructive SQL.
- Unexpected grant exposure.
- Feature gate unexpectedly enabled.
- Stock balance changes immediately after migration apply.
- RPC missing after apply.
- Movement trigger missing.
- Wrong Production project ref.
- Stakeholder approval missing.

## I. Rollback / Reversal Note

- SQL rollback script is not yet finalized.
- Reversal process is not yet implemented.
- Production write smoke should not proceed unless rollback/reversal risk is explicitly accepted.
- No manual delete/edit of stock movements or balances.

## J. FINAL GO Gate

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

## K. Recommendation

Recommended next sprint:

- 15I Outbound Production Apply Gate Review

Production remains HOLD. 15I only reviews the completed checklist and approvals. Actual apply only after explicit FINAL GO.
