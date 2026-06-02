# 13J-P Receiving Real Stock Posting Staging Readiness

## Scope

This is a read-only audit only for Sprint 13J-P.

- Production locked.
- Migration 020 not applied.
- Staging apply not approved yet.
- Receiving UI remains locked.
- Real stock posting remains locked.
- `receivingService.js` remains unchanged.
- No stock posting was run from this review.

This report does not execute migration 020 and does not enable Receiving write behavior.

## Migration Under Review

Reviewed local draft:

`database/migrations/020_tgd_wms_receiving_real_stock_posting_draft.sql`

Migration 020 proposes:

- `tgd_receiving_lines.location_id`
- `tgd_stock_movements.source_module`
- `tgd_stock_movements.source_document_id`
- `tgd_stock_movements.source_line_id`
- `tgd_stock_movements_source_unique_idx`
- `tgd_rpc_post_receiving_document_dry`
- `tgd_rpc_post_receiving_document`

The draft also references direct stock movement writes inside the post RPC and depends on the existing `tgd_trigger_update_stock_balance` trigger behavior.

## Controller-Provided Current Status

Known status from the sprint request:

| Area | Evidence |
| --- | --- |
| 13J-O | CLOSED/PASS |
| Latest commit | `dd02129 Draft receiving real stock posting migration` |
| Migration 020 | not applied |
| Production | locked |
| Receiving UI | locked |
| Real stock posting | locked |

## Schema Compatibility Result

Result: **HOLD**

Reason: local inspection can prepare the exact read-only SQL audit, but this Codex session did not execute Supabase Staging queries. The apply decision must wait for actual Staging evidence for schema, trigger behavior, RLS policies, table privileges, and data impact.

## Read-Only SQL Used

All SQL below is SELECT-only and intended for Supabase Staging audit evidence collection.

### A. Migration Applied Check

```sql
select
  table_name,
  column_name
from information_schema.columns
where table_schema = 'public'
  and (
    (table_name = 'tgd_receiving_lines' and column_name in ('location_id'))
    or (
      table_name = 'tgd_stock_movements'
      and column_name in ('source_module', 'source_document_id', 'source_line_id')
    )
  )
order by table_name, column_name;
```

```sql
select
  indexname,
  tablename,
  indexdef
from pg_indexes
where schemaname = 'public'
  and indexname = 'tgd_stock_movements_source_unique_idx';
```

```sql
select
  n.nspname as schema_name,
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as arguments
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'tgd_rpc_post_receiving_document_dry',
    'tgd_rpc_post_receiving_document'
  )
order by p.proname;
```

### B. Receiving Lines Schema

```sql
select
  column_name,
  data_type,
  is_nullable,
  column_default
from information_schema.columns
where table_schema = 'public'
  and table_name = 'tgd_receiving_lines'
order by ordinal_position;
```

Checklist:

- document FK candidates: `document_id`, `receiving_document_id`
- quantity candidates: `quantity`, `received_qty`
- required line fields: `product_id`, `lot_id`, `location_id`
- optional weight field: `weight`

### C. Receiving Documents Schema

```sql
select
  column_name,
  data_type,
  is_nullable,
  column_default
from information_schema.columns
where table_schema = 'public'
  and table_name = 'tgd_receiving_documents'
order by ordinal_position;
```

Checklist:

- `id`
- `customer_id`
- `status`
- `updated_at`
- `confirmed_at`

### D. Stock Movements Schema

```sql
select
  column_name,
  data_type,
  is_nullable,
  column_default
from information_schema.columns
where table_schema = 'public'
  and table_name = 'tgd_stock_movements'
order by ordinal_position;
```

Checklist:

- `id`
- `customer_id`
- `product_id`
- `lot_id`
- `from_location_id`
- `to_location_id`
- `quantity`
- `weight`
- `movement_type`
- `related_document_id`
- `created_at`
- `updated_at`
- `source_module`
- `source_document_id`
- `source_line_id`

### E. Stock Balances Schema

```sql
select
  column_name,
  data_type,
  is_nullable,
  column_default
from information_schema.columns
where table_schema = 'public'
  and table_name = 'tgd_stock_balances'
order by ordinal_position;
```

Checklist:

- current quantity model: `tgd_stock_balances.quantity`
- compatibility fields to confirm: `qty_on_hand`, `qty_allocated`, `qty_available`

### F. Balance Trigger

```sql
select
  t.tgname as trigger_name,
  c.relname as table_name,
  p.proname as function_name,
  pg_get_triggerdef(t.oid) as trigger_definition
from pg_trigger t
join pg_class c on c.oid = t.tgrelid
join pg_proc p on p.oid = t.tgfoid
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname = 'tgd_stock_movements'
  and not t.tgisinternal
order by t.tgname;
```

```sql
select
  p.proname as function_name,
  pg_get_functiondef(p.oid) as function_source
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'tgd_trigger_update_stock_balance';
```

Trigger evidence to verify:

- inbound addition uses `to_location_id` plus `quantity`
- outbound deduction uses `from_location_id` plus `quantity`
- trigger does not require `location_id` on `tgd_stock_movements` when current movement table uses `from_location_id` and `to_location_id`

### G. Current Receiving Data Impact

```sql
select
  status,
  count(*) as document_count
from public.tgd_receiving_documents
group by status
order by status;
```

```sql
select count(*) as receiving_line_count
from public.tgd_receiving_lines;
```

Run only if `location_id` exists:

```sql
select count(*) as receiving_lines_missing_location_id
from public.tgd_receiving_lines
where location_id is null;
```

```sql
select count(*) as invalid_receiving_lines
from public.tgd_receiving_lines
where product_id is null
   or lot_id is null
   or quantity is null
   or quantity <= 0;
```

```sql
select count(*) as documents_with_zero_lines
from public.tgd_receiving_documents d
where not exists (
  select 1
  from public.tgd_receiving_lines l
  where l.document_id = d.id
);
```

If the actual FK column is `receiving_document_id`, use that column in the zero-line check.

### H. Existing Stock Movement Duplicates

Run only if `source_module`, `source_document_id`, and `source_line_id` exist:

```sql
select
  source_module,
  source_document_id,
  source_line_id,
  count(*) as duplicate_count
from public.tgd_stock_movements
where source_module is not null
  and source_document_id is not null
  and source_line_id is not null
group by source_module, source_document_id, source_line_id
having count(*) > 1
order by duplicate_count desc;
```

If source columns do not exist, duplicate-source-key evidence is not applicable before migration 020.

### I. Privilege / Grants Readiness

```sql
select
  routine_schema,
  routine_name,
  grantee,
  privilege_type
from information_schema.routine_privileges
where routine_schema = 'public'
  and routine_name in (
    'tgd_rpc_create_receiving_draft',
    'tgd_rpc_add_receiving_line',
    'tgd_rpc_confirm_receiving_document',
    'tgd_rpc_post_receiving_document_dry',
    'tgd_rpc_post_receiving_document'
  )
order by routine_name, grantee, privilege_type;
```

```sql
select
  table_schema,
  table_name,
  grantee,
  privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name in (
    'tgd_receiving_documents',
    'tgd_receiving_lines',
    'tgd_stock_movements',
    'tgd_stock_balances'
  )
  and grantee in ('anon', 'authenticated')
order by table_name, grantee, privilege_type;
```

### J. RLS Readiness

```sql
select
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
from pg_policies
where schemaname = 'public'
  and tablename in (
    'tgd_receiving_documents',
    'tgd_receiving_lines',
    'tgd_stock_movements',
    'tgd_stock_balances'
  )
order by tablename, policyname;
```

## Evidence Summary

No live Supabase Staging query results were executed by Codex in this review.

Evidence status:

| Area | Status | Notes |
| --- | --- | --- |
| Migration 020 local inspection | Complete | Draft contains real stock posting RPC and schema additions |
| Staging schema query evidence | Missing | Must be collected with SELECT-only SQL above |
| Trigger function evidence | Missing | Must verify `tgd_trigger_update_stock_balance` behavior |
| Data impact evidence | Missing | Must verify existing receiving rows before apply |
| Privilege evidence | Missing | Must verify anon/authenticated table privileges after migration 019 |
| RLS policies evidence | Missing | Must verify policy coverage before apply |

## Blocking Issues

1. Staging evidence is missing for whether `document_id` or `receiving_document_id` is the actual receiving line FK column.
2. Staging evidence is missing for whether `quantity` or `received_qty` is the active receiving line quantity column.
3. Staging evidence is missing for whether `location_id` already exists or requires backfill.
4. Staging evidence is missing for whether `confirmed_at` exists on `tgd_receiving_documents`.
5. Trigger source evidence is missing for `tgd_trigger_update_stock_balance`.
6. RLS policies evidence is missing for receiving and stock tables.
7. Table privilege evidence is missing after migration 019.

## Warnings

- Migration 020 proposes real stock posting behavior and must remain locked until staging evidence is reviewed.
- Existing receiving data may require backfill if `tgd_receiving_lines.location_id` is newly added.
- Duplicate posting guard depends on source columns and the unique index.
- Trigger behavior must be confirmed before any real posting test.
- Receiving UI must remain locked until a separate approved UI enablement sprint.

## Recommended Fixes Before Apply

1. Run the SELECT-only audit SQL in Supabase Staging and attach results.
2. Confirm the actual receiving line FK column and update migration 020 if needed.
3. Confirm the active receiving line quantity column and update migration 020 if needed.
4. Confirm `location_id` data readiness and define a backfill plan before requiring it.
5. Confirm `tgd_trigger_update_stock_balance` supports inbound addition through `to_location_id`.
6. Confirm anon/authenticated privileges remain read-safe and do not permit direct operational writes.
7. Confirm RLS policies protect receiving and stock data under the expected roles.

## Controller Recommendation

Recommendation: **HOLD**

Migration 020 is not APPLY READY until Staging SELECT-only evidence is collected and reviewed.

