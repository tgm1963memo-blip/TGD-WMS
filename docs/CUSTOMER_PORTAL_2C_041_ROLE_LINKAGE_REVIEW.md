# CUSTOMER-PORTAL-2C-041 — Customer Roles and Source Linkage Review

**Gate:** CUSTOMER-PORTAL-2C-041 (draft/review only — no apply)  
**Migration draft:** `database/migrations/041_tgd_wms_customer_portal_roles_and_source_links.sql`  
**Prerequisite:** migration 040 applied first  
**Baseline commit:** `c956360`

---

## 1. Why 041 is needed before Gate 2D

| Blocker from 2C review | 041 addresses |
|------------------------|---------------|
| `customer_admin` / `customer_user` missing from role CHECK | Section 1 — role constraint |
| Source linkage not on execution tables | Section 2 — nullable header FKs |
| Partial receiving / 1:N execution | Section 3 — link tables |
| Attachment upload lifecycle | Section 4 — PENDING/FAILED |
| UAT profile linkage | **Separate approved SQL** — not in 041 |

Apply order on UAT: **040 → 041 → profile linkage seed → 2E RPC**

---

## 2. Role constraint change

| Item | Value |
|------|-------|
| Table | `public.tgd_user_profiles` |
| Constraint name | `tgd_user_profiles_role_check` |
| Current roles (007) | `admin`, `warehouse_manager`, `warehouse_staff`, `accounting`, `viewer` |
| Added roles | `customer_admin`, `customer_user` |
| Pattern | `DROP CONSTRAINT IF EXISTS` + `ADD CONSTRAINT ... NOT VALID` |
| Data impact | None — no UPDATE on profiles |
| Auth impact | None — no auth.users changes |

**Why NOT VALID is safe:** matches migration 007; existing rows keep valid roles; new inserts may include customer roles after profile seed.

---

## 3. Source linkage recommendation — **Hybrid (implemented in 041 draft)**

### Header-level (Option 1)

| Execution table (inspected) | New nullable columns |
|----------------------------|----------------------|
| `tgd_receiving_documents` (004) | `source_customer_deposit_request_id`, `source_customer_deposit_request_no` |
| `tgd_withdrawal_requests` (008) | `source_customer_withdrawal_request_id`, `source_customer_withdrawal_no` |

**Not used:** `tgd_receiving_headers`, `tgd_withdrawal_request_headers` — these names do not exist in migrations.

**Existing fields retained:** `source_type`/`source_no` on receiving; `request_source`/`request_reference_id` on withdrawal.

### Line-level / 1:N (Option 2)

| Link table | Purpose |
|------------|---------|
| `tgd_customer_deposit_receiving_links` | One deposit → multiple receiving docs/lines |
| `tgd_customer_withdrawal_execution_links` | One customer withdrawal → internal withdrawal / picking / dispatch |

**Deferred:** denormalized FK on `tgd_picking_documents` / `tgd_dispatch_documents` — trace via link table + internal withdrawal.

---

## 4. Exact table names inspected

| Expected in task | Actual in repo | Action |
|------------------|----------------|--------|
| `tgd_receiving_headers` | **`tgd_receiving_documents`** | SQL uses actual name |
| `tgd_withdrawal_request_headers` | **`tgd_withdrawal_requests`** | SQL uses actual name |
| Receiving lines | `tgd_receiving_lines` | FK in link table |
| Picking | `tgd_picking_documents` | FK in execution link |
| Dispatch | `tgd_dispatch_documents` | FK in execution link |
| Customer deposit | `tgd_customer_deposit_requests` | 040 prerequisite |
| Customer withdrawal | `tgd_customer_withdrawal_requests` | 040 prerequisite |

---

## 5. Linkage SQL included or deferred

| Item | Status in 041 |
|------|---------------|
| Receiving header FK columns | **Included** |
| Withdrawal header FK columns | **Included** |
| Deposit receiving link table | **Included** |
| Withdrawal execution link table | **Included** |
| Picking/dispatch header denorm FK | **Deferred** (link table sufficient) |

---

## 6. Attachment status decision

| Status | 040 | 041 |
|--------|-----|-----|
| ACTIVE | Yes | Yes |
| ARCHIVED | Yes | Yes |
| DELETED | Yes | Yes |
| PENDING | No | **Added** |
| FAILED | No | **Added** |

Applied via conditional `DO` block when `tgd_customer_document_attachments` exists (post-040).

---

## 7. RLS implications after 041

Migration 040 RLS already references `customer_admin` / `customer_user`. After 041:

| Rule | Behavior |
|------|----------|
| Customer profile must have `customer_id` | Required for scoped access |
| Internal users | Normally `customer_id IS NULL` — use internal role branch |
| Customer users | `tgd_current_user_customer_id() = customer_id` |
| Customer cannot see other customers | Enforced by 040 policies |
| Customer UPDATE limited to DRAFT/SUBMITTED | 040 status guard — review fields need 2E RPC |
| `viewer` | Internal read-all; not for customer portal |
| Link tables | Internal roles SELECT only in 041; customer via parent document policies |

**No automatic user assignment in 041.**

---

## 8. UAT profile linkage plan (design only)

Separate approved SQL (not 041):

```sql
-- Example pattern only — NOT for auto-apply
-- UPDATE tgd_user_profiles
-- SET customer_id = '<demo-customer-uuid>', role = 'customer_admin'
-- WHERE auth_user_id = auth.uid() AND email = '<uat-email>';
```

Steps:

1. Apply 040 + 041 on UAT
2. Controller-approved linkage SQL for test users
3. Verify `tgd_current_user_customer_id()` returns expected UUID
4. Test customer portal RLS read/write on DRAFT only

---

## 9. Rollback considerations

| Change | Rollback |
|--------|----------|
| Role constraint | DROP + restore 007 constraint (if no customer profiles exist yet) |
| Nullable columns on receiving/withdrawal | `DROP COLUMN` if unused |
| Link tables | `DROP TABLE` if empty |
| Attachment status CHECK | Restore 040 constraint |
| RLS on link tables | `DROP POLICY` |

No data migration in 041 — rollback is low risk if applied before production customer data.

---

## 10. Decision: ready for apply?

| Verdict | **Ready for Controller review — apply after 040 on UAT** |
|---------|----------------------------------------------------------|
| Safety | Additive; no DELETE/TRUNCATE; no stock RPC |
| Blockers remaining | UAT profile linkage SQL; Gate 2E RPC for writes |
| Gate 3B-5 | Blocked |

**Not ready for 2D until:** Controller signs 040+041 apply pack AND profile linkage plan approved.
