# 13J-AV Receiving Production Apply Command Review

**Explicit statement: Production is strictly not touched in this sprint.**

**Explicit warning: Do not run the apply command until Controller receives final GO from business owner.**

## Current Commit
`0f89562 Add receiving production pre-apply gate`

## Migration Files to Apply
1. `020_tgd_wms_receiving_real_stock_posting_draft.sql`
2. `021_tgd_wms_stock_privilege_hardening.sql`
3. `022_tgd_wms_stock_balance_last_movement_traceability.sql`
4. `023_tgd_wms_receiving_add_line_location_rpc_patch.sql`
5. `024_tgd_wms_receiving_audit_rpc_patch.sql`

## Exact Pre-Apply Commands
```bash
# 1. Verify you are authenticated to the production project
npx supabase projects list

# 2. Link to production (replace with actual production ref)
npx supabase link --project-ref <production_project_ref>

# 3. Pull latest remote status to ensure no conflicts
npx supabase db remote commit
```

## Exact Apply Command Draft
```bash
# Push pending migrations 020–024 to production
npx supabase db push --linked
```

## Exact Post-Apply Read-Only SQL Checks
Execute via Supabase SQL Editor or `npx supabase db query`:
```sql
-- 1. Check RPC definitions
SELECT proname 
FROM pg_proc 
WHERE proname IN ('tgd_rpc_create_receiving_draft', 'tgd_rpc_add_receiving_line', 'tgd_rpc_post_receiving_document');

-- 2. Verify audit columns on receiving documents
SELECT column_name 
FROM information_schema.columns 
WHERE table_name='tgd_receiving_documents' 
  AND column_name IN ('created_by', 'posted_by', 'posted_at');

-- 3. Verify audit and trace columns on stock movements
SELECT column_name 
FROM information_schema.columns 
WHERE table_name='tgd_stock_movements' 
  AND column_name IN ('source_module', 'source_document_id', 'source_line_id', 'created_by');
```

## UI Smoke Test Steps
1. Login to Production as a user with `admin` or `warehouse_manager` role.
2. Navigate to `/operations/receiving`.
3. Create a Draft Receiving Document.
4. Add 1 Line item successfully (ensure location picker works).
5. Click Confirm/Post.
6. Verify document status changes to CONFIRMED.
7. Verify Movement is generated in the UI.

## Stop Conditions
Halt the apply process if:
- Final GO is not provided by the business owner.
- `npx supabase db push --linked` fails or produces warnings.
- Any post-apply SQL check returns incomplete results.
- Any 500 error occurs during the UI smoke test.

## Rollback / PITR Restore Instruction
- Do not attempt to fix data manually. **NO manual stock movement insert.** **NO manual stock balance update.**
- If apply fails, immediately perform a PITR restore to the snapshot taken just before the migration window via the Supabase Dashboard -> Database -> Backups.
