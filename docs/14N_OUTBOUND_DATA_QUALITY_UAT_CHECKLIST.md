# 14N Outbound Data Quality & UAT Checklist

Sprint 14N prepares outbound draft/read-only UAT evidence and data-quality checks. This sprint is documentation, validation readiness, and safety test coverage only.

## A. Scope

- Outbound draft/read-only only.
- No stock posting.
- No stock_movement OUT.
- No stock_balance update.
- No insert into `tgd_stock_movements`.
- No update to `tgd_stock_balances`.
- No Production touched.
- No migration applied.
- No delete/truncate smoke data.
- No destructive SQL.

## B. UAT Checklist

### Access / Navigation

- Confirm the authenticated Staging user can open `/operations/outbound`.
- Confirm the authenticated Staging user can open `/operations/outbound-draft`.
- Confirm the sidebar shows `รายการจ่ายสินค้าออก` for outbound documents.
- Confirm the sidebar shows `ทดลองสร้างเอกสารจ่ายออก` for outbound draft.
- Confirm the read-only page has a link to `Open Draft Smoke UI`.
- Confirm the draft page has a link back to `Back to Outbound Documents`.

### Create Draft

- Enter a unique outbound `document_no`.
- Enter a valid `customer_id` UUID.
- Enter a valid `requested_ship_date`.
- Submit Create Draft.
- Confirm success JSON is displayed.
- Confirm no Post Outbound action appears.

### Add Line

- Enter the created `document_id`.
- Enter a valid `product_id` UUID.
- Enter optional `lot_id` as a UUID or leave it blank/null.
- Enter `requested_quantity > 0`.
- Enter `requested_weight >= 0`.
- Submit Add Line.
- Confirm success JSON is displayed.

### Reserve

- Enter `outbound_document_id`.
- Enter `outbound_line_id`.
- Enter `location_id`.
- Enter `reserved_quantity > 0`.
- Enter `reserved_weight >= 0`.
- Submit Reserve Stock.
- Confirm success JSON is displayed.
- Confirm reservation status is active in the read-only detail view.

### Release

- Enter active `reservation_id`.
- Submit Release Reservation.
- Confirm success JSON is displayed.
- Confirm reservation status changes to released in the read-only detail view.

### Read-Only List

- Open `/operations/outbound`.
- Confirm the safety note is visible.
- Confirm Refresh reloads the list.
- Confirm outbound documents are listed when the user has read permission.
- Confirm the empty state says: `No outbound documents found or you may not have read permission.`

### Detail View

- Select an outbound document.
- Confirm document header fields render.
- Confirm status badge renders.
- Confirm no Post Outbound button appears.
- Confirm no Confirm Stock Out button appears.
- Confirm no Delete action appears.

### Lines View

- Confirm outbound lines render for the selected document.
- Confirm line fields include product, lot, requested quantity, requested weight, picked quantity, and status.

### Reservations View

- Confirm reservations render for the selected document.
- Confirm reservation fields include reservation id, line id, location id, reserved quantity, reserved weight, status, and released at.

### Safety Checks

- Confirm there is no `Post Outbound` button.
- Confirm there is no `Confirm Stock Out` button.
- Confirm there is no stock movement OUT action.
- Confirm there is no stock balance update action.
- Confirm draft/reserve/release remains metadata/reservation only.

### RLS / Grant Checks

- Confirm outbound read-only RLS policies from migration 027 exist in Staging.
- Confirm grant hardening from migration 028 is present in Staging.
- Confirm authenticated users have SELECT on outbound read-model tables.
- Confirm anon has no direct read/write access.
- Confirm anon/authenticated do not have direct INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, or TRIGGER privileges on outbound read-model tables.

### Local Test / Build Check

- Run `npm test -- --run tests/unit/outbound-data-quality-uat-checklist.test.js`.
- Run `npm test -- --run`.
- Run `npm run build`.
- Clean generated `dist` and Vitest artifacts after validation.

## C. Required Field Review

### Create Draft

- `document_no` required.
- `customer_id` required because DB has NOT NULL.
- `requested_ship_date` should be a valid date.

### Add Line

- `document_id` required UUID.
- `product_id` required UUID.
- `requested_quantity > 0`.
- `requested_weight >= 0`.
- `lot_id` optional UUID/null.

### Reserve

- `outbound_document_id` required UUID.
- `outbound_line_id` required UUID.
- `location_id` required UUID.
- `reserved_quantity > 0`.
- `reserved_weight >= 0`.

### Release

- `reservation_id` required UUID.

## D. Error Message Review

Expected user-friendly messages:

- Missing `document_no`: `document_no is required.`
- Missing `customer_id`: `customer_id is required.`
- Invalid UUID: `Enter a valid UUID for this field.`
- Quantity <= 0: `Quantity must be greater than zero.`
- Reserve already active: `An active reservation already exists for this line and location.`
- Release non-active reservation: `Only active reservations can be released.`
- Permission/RLS denied: `You do not have permission to read or change this outbound record.`

## E. Smoke Data Inventory

Known Staging smoke examples:

- `SMOKE-OUT-14F-002`
- `SMOKE-UI-14I-001`
- `SMOKE-UI-14I-RETEST-001`

Do not delete in this sprint. Keep these records as trace evidence for outbound workflow history. Cleanup requires a dedicated approved cleanup sprint.

## F. Safety SQL Checklist

Use SELECT-only checks in Supabase SQL Editor. Do not run destructive SQL.

### Outbound Docs Exist

```sql
select document_no, status, customer_id, requested_ship_date, created_at
from public.tgd_outbound_documents
order by created_at desc
limit 20;
```

### Policies Exist

```sql
select schemaname, tablename, policyname, cmd, roles
from pg_policies
where schemaname = 'public'
  and tablename in (
    'tgd_outbound_documents',
    'tgd_outbound_lines',
    'tgd_outbound_reservations'
  )
order by tablename, policyname;
```

### Grants Are Authenticated SELECT Only

```sql
select grantee, table_name, privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name in (
    'tgd_outbound_documents',
    'tgd_outbound_lines',
    'tgd_outbound_reservations'
  )
  and grantee in ('anon', 'authenticated')
order by table_name, grantee, privilege_type;
```

### No Post Outbound RPC Exists

```sql
select n.nspname as schema_name, p.proname as function_name
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'tgd_rpc_post_outbound_document';
```

### Stock Movement Count Unchanged

```sql
select count(*) as stock_movement_count
from public.tgd_stock_movements;
```

Run before and after outbound UAT actions. The count should be unchanged by outbound draft/reserve/release.

### Stock Balance Unchanged

```sql
select product_id, lot_id, location_id, quantity, weight
from public.tgd_stock_balances
order by updated_at desc nulls last
limit 20;
```

Capture before and after outbound UAT actions. Outbound draft/reserve/release must not update stock balance.

## G. Decision Recommendation

Two possible next sprint options:

- Option 1: 14O Picking Workflow Draft UI.
- Option 2: 14O Post Outbound Design Review only.

Recommended safest next step: 14O Picking Workflow Draft UI before Post Outbound. Picking workflow UX can continue proving document, line, reservation, and release behavior without enabling physical stock deduction.
