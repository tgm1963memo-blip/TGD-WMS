# CUSTOMER-PORTAL-2C — Migration 040 Review

**Gate:** CUSTOMER-PORTAL-2C (review only — no UAT apply)  
**Reviewed:** `database/migrations/040_tgd_wms_customer_portal_source_documents.sql`  
**Commit baseline:** `213803e`

---

## 1. Migration 040 safety verdict

**FIX REQUIRED before Gate 2D UAT apply** (non-destructive; policy/role prerequisites)

| Check | Result |
|-------|--------|
| Additive tables only | PASS |
| No destructive ALTER on existing tables | PASS |
| No DROP TABLE / TRUNCATE / DELETE data / RESET | PASS |
| No stock movement RPC | PASS |
| No billing export | PASS |
| No service_role | PASS |
| RLS uses helper functions | PASS |
| REVOKE DELETE | PASS |
| Status CHECK vs design doc | PASS (use `RECEIVING_VARIANCE`) |

### Required changes before 2D apply

1. **Migration 041 (recommended):** extend `tgd_user_profiles_role_check` with `customer_admin`, `customer_user` before customer login testing.
2. **Timeline INSERT policy:** tightened in 040 draft (2C patch) — was open to any active user.
3. **Gate 2E RPC:** revoke direct INSERT/UPDATE on headers (mirror receiving 018 pattern) before production customer portal writes.
4. **UAT profile linkage:** separate approved SQL — required before any role testing.

---

## 2. Role constraint strategy — **Option B (RECOMMENDED)**

**Current allowed roles (007):** `admin`, `warehouse_manager`, `warehouse_staff`, `accounting`, `viewer`

**Does NOT include:** `customer_admin`, `customer_user`

| Option | Assessment |
|--------|------------|
| A — Add roles in 040 | Couples table create + role constraint; harder rollback |
| **B — 041 for roles + policy activation** | **Safest** — apply 040 tables first; 041 adds roles; seed customer profiles after |
| C — Use `viewer` temporarily | Not recommended — cannot distinguish customer admin vs read-only |

**Recommendation:** Create draft **041** (Controller approval) with:

```sql
ALTER TABLE tgd_user_profiles DROP CONSTRAINT tgd_user_profiles_role_check;
ALTER TABLE tgd_user_profiles ADD CONSTRAINT ... CHECK (role IN (
  'admin','warehouse_manager','warehouse_staff','accounting','viewer',
  'customer_admin','customer_user'
)) NOT VALID;
```

Apply **041 before or immediately after 040** on UAT when customer portal login is tested.

---

## 3. RLS policy gaps and corrections

| Gap | Severity | Correction |
|-----|----------|------------|
| Timeline INSERT was any active user | High | Fixed in 040 (2C patch) |
| Header UPDATE allows `warehouse_manager` without status guard | Medium | Gate 2E: RPC-only status transitions |
| `warehouse_staff` cannot UPDATE headers | Low | Intended — staff uses warehouse RPC |
| No withdrawal line UPDATE policy | Low | Intended — RPC only |
| No attachment UPDATE (soft delete) | Medium | Add in 041 or 2E RPC |
| Direct client INSERT/UPDATE still allowed for admin/accounting | Medium | Align with receiving: revoke + RPC in 2E |
| `viewer` sees all customers | Low | Accept for internal viewer; document |
| Customer cannot update after submit | PASS | status guard on customer branch |

---

## 4. Source linkage decision — **Hybrid**

| Layer | Approach | Migration gate |
|-------|----------|----------------|
| Header execution link | **Option 1** nullable FK on `tgd_receiving_documents`, `tgd_withdrawal_requests` | **041 or 2E** (not 040) |
| 1:N partial receiving | **Option 2** `tgd_customer_deposit_receiving_links` (line-level) | **2E** |
| Withdrawal → picking/dispatch | Trace via internal `tgd_withdrawal_requests` FK; optional denorm on picking/dispatch | **2E** |

**Reuse existing:** `request_source='CUSTOMER_PORTAL'` + `request_reference_id` on internal withdrawal until dedicated columns added.

---

## 5. Attachment / storage review

| Question | Recommendation |
|----------|----------------|
| Polymorphic `document_id` | Acceptable with `document_type` + app validation; optional typed FK columns in 041 |
| `storage_path` | Sufficient for Supabase Storage signed URL flow |
| Checksum / versioning | Defer to 2G; optional `content_sha256` in 041 |
| Upload status | Add `PENDING`, `FAILED` to status check in 041 |
| Virus scan | Future metadata field in `metadata_json` — not 040 |

---

## 6. Status enum alignment

**Deposit (canonical — DB 040):**  
`DRAFT`, `SUBMITTED_BY_CUSTOMER`, `ADMIN_REVIEWING`, `ADMIN_ACCEPTED`, `ADMIN_REJECTED`, `WAREHOUSE_RECEIVING`, `PALLETIZING`, `RECEIVING_VARIANCE`, `ADMIN_RECOUNT_REQUESTED`, `RECEIVED_CONFIRMED`, `CUSTOMER_NOTIFIED`, `CLOSED`, `CANCELLED`

**Withdrawal (canonical):**  
`WITHDRAWAL_DRAFT`, `SUBMITTED_BY_CUSTOMER`, `ADMIN_REVIEWING`, `ADMIN_ACCEPTED`, `ADMIN_REJECTED`, `WAREHOUSE_PICKING`, `PICKING_VARIANCE`, `PICKED`, `PACKING_LIST_RECORDED`, `LOADING`, `LOADED_CONFIRMED`, `CUSTOMER_NOTIFIED`, `CLOSED`, `CANCELLED`

**Demo UI mismatch:** `COUNT_VARIANCE_REVIEW` → rename to `RECEIVING_VARIANCE` in Gate 2F.

**Enforcement:** RPC-only status changes in Gate 2E; frontend must not SET status directly.

---

## 7. Gate 2D readiness

| Prerequisite | Status |
|--------------|--------|
| 040 safety (destructive) | Ready |
| 041 role constraint draft | **Need Controller approval** |
| UAT profile linkage | **Need separate fix** |
| 2E RPC for writes | After 2D table apply |
| Gate 3B-5 | Blocked |

**Verdict:** **Need patch first** (041 role draft + 2C timeline fix in 040) then **2D UAT apply** with Controller sign-off.
