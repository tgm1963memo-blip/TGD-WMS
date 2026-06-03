# 13J-AT Receiving Production Apply Runbook

## Purpose
The purpose of this runbook is to define the exact sequence of events, checks, and mitigations required to apply the Receiving feature set (migrations 020-024) to the Production environment. **Production is strictly NOT touched during the authoring and testing of this runbook.**

## Scope
This runbook covers the application of database schema adjustments, RPC definitions, and subsequent verifications necessary for the Receiving workflows in Production.

## Migration List (020-024)
- **020_tgd_wms_receiving_real_stock_posting_draft.sql**: Receiving real stock posting.
- **021_tgd_wms_stock_privilege_hardening.sql**: Receiving RLS / RPC privilege hardening.
- **022_tgd_wms_stock_balance_last_movement_traceability.sql**: Stock balance `last_movement_id` traceability.
- **023_tgd_wms_receiving_add_line_location_rpc_patch.sql**: Receiving add line location RPC patch.
- **024_tgd_wms_receiving_audit_rpc_patch.sql**: Receiving audit RPC patch + schema drift alignment.

## Production Pre-Check Checklist
- [ ] Staging tests passed and approved.
- [ ] All 020-024 SQL migration files verified against the main branch.
- [ ] Supabase CLI authenticated to the correct Production project.
- [ ] No unauthorized active sessions detected in Production.

## Backup / Snapshot Requirement
- [ ] **MANDATORY**: Initiate and verify a full Point-in-Time Recovery (PITR) snapshot of the Production database immediately before the apply window.

## Apply Window Requirement
- [ ] Operations suspended during the approved maintenance window.
- [ ] All warehouse personnel notified of system downtime.

## Operator Approval Checklist
- [ ] System Administrator approval received.
- [ ] Warehouse Manager sign-off on downtime window.

## Exact Apply Sequence Draft
1. Confirm DB backup is complete.
2. Execute: `npx supabase db push --linked` to push all pending migrations (020-024).
   *Alternatively, run the migrations sequentially via `npx supabase db query` if granular control is needed.*
3. Await CLI confirmation of successful schema update.

## Post-Apply Verification SQL
Run the following checks via secure read-only SQL:
```sql
-- 1. Check RPC existence
SELECT proname FROM pg_proc WHERE proname IN ('tgd_rpc_create_receiving_draft', 'tgd_rpc_add_receiving_line', 'tgd_rpc_post_receiving_document');

-- 2. Verify audit columns were added
SELECT column_name FROM information_schema.columns WHERE table_name='tgd_receiving_documents' AND column_name IN ('created_by', 'posted_by', 'posted_at');
```

## UI Smoke Test Checklist
- [ ] Login as `warehouse_manager` or `admin`.
- [ ] Navigate to `/operations/receiving`.
- [ ] Create a Draft Receiving Document.
- [ ] Add 1 Line item successfully.
- [ ] Confirm and Post the document.
- [ ] Verify Movement is generated.

## Stop Conditions
HALT the rollout and immediately initiate rollback if any of the following occur:
- Any SQL syntax or runtime error during the migration apply.
- Post-apply SQL verification fails (missing RPCs, missing audit columns).
- UI smoke test encounters a 500 server error or fails to create a document.
- Anomalies detected indicating duplicate stock movements.

## Rollback / Mitigation Plan
- **Primary Mitigation**: If a migration fails midway, use `npx supabase db reset` or restore the immediate PITR snapshot taken prior to the window.
- **Data Integrity Rule**: Under **no circumstances** should an operator perform a manual stock balance update or manual stock movement insert to "fix" drift. All corrections must be made by reverting to the snapshot and investigating the code. NO manual stock balance update. NO manual stock movement insert.

## Communication Checklist
- [ ] Broadcast maintenance window start.
- [ ] Broadcast rollout status (Success or Rollback).
- [ ] Notify stakeholders upon completion.

## Final Go/No-Go Sign-off

| Role | Name | Signature | Status | Date |
| :--- | :--- | :--- | :--- | :--- |
| **System Admin** | | | [ ] Go / [ ] No-Go | |
| **Warehouse Manager** | | | [ ] Go / [ ] No-Go | |
| **Controller** | | | [ ] Go / [ ] No-Go | |
