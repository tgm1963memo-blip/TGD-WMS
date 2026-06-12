# UAT-FOUNDATION-REMEDIATION-1 — Schema Drift Review for Customer Portal 2D

## Gate Status

| Item | Value |
|------|-------|
| Gate | UAT-FOUNDATION-REMEDIATION-1 |
| Environment | UAT only (`lievvsqbosvrolkrftna` / `tgd-wms-staging`) |
| Mode | Review + draft only — **no DB apply** |
| Blocked downstream | CUSTOMER-PORTAL-2D (040/041 not applied) |
| Production | **HOLD — do not touch** |

---

## Part A — UAT Schema Drift Findings (Read-Only)

Verified via `npx supabase db query --linked` on UAT (`tgd-wms-staging`).

### Object Existence Matrix

| Object | UAT | Repo Canonical (post-010) |
|--------|-----|---------------------------|
| `public.set_updated_at()` | **MISSING** | `001_core_master_data.sql` |
| `public.tgd_picking_documents` | **MISSING** | `010_picking_foundation.sql` |
| `public.tgd_picking_lines` | **MISSING** | `010_picking_foundation.sql` |
| `public.tgd_picking_tasks` | **EXISTS** | `001_tgd_wms_schema_foundation.sql` (+ `007` alignment) |
| `public.tgd_picking_headers` | **MISSING** | Not in repo (n/a) |
| `public.tgd_dispatch_documents` | **EXISTS** | Both tracks (shapes differ) |
| `public.tgd_dispatch_headers` | **MISSING** | Not in repo (n/a) |
| `public.tgd_dispatch_lines` | **EXISTS** | Both tracks |
| `public.tgd_withdrawal_requests` | **EXISTS** | `008_withdrawal_request_foundation.sql` |
| `public.tgd_receiving_documents` | **EXISTS** | `004_receiving_foundation.sql` |

### Additional UAT Evidence

| Check | Result |
|-------|--------|
| `supabase_migrations.schema_migrations` | **Does not exist** |
| `tgd_withdrawal_allocations` | **Missing** (canonical `009` model) |
| `tgd_allocation_records` | **Exists** (early `001_tgd_wms` model) |
| `tgd_current_user_role()` | Exists |
| Customer portal tables (040) | Not applied (expected) |

### UAT `tgd_dispatch_documents` Shape (Early Foundation)

Columns: `id`, `customer_id`, `document_no`, `status`, `dispatched_at`, `created_at`, `updated_at`

- Matches `001_tgd_wms_schema_foundation.sql`
- **No** `picking_document_id` column (canonical `011_dispatch_goods_issue_foundation.sql` adds this)

### UAT `tgd_picking_tasks` Shape (Early Foundation + 007)

Columns include: `allocation_id`, `picker_user_id`, `status`, `customer_id`, `location_id`, …

- Matches early foundation + `007_tgd_wms_schema_seed_alignment.sql` patches
- **Not** the same model as `tgd_picking_documents` / `tgd_picking_lines`

### Full UAT `tgd_*` Table Inventory (35 tables)

Includes hybrid mix: early foundation (`tgd_picking_tasks`, `tgd_allocation_records`), canonical receiving (`tgd_receiving_documents`), outbound/billing stack (`tgd_outbound_*`, `tgd_billing_*`), adjustments, stock count, etc.

### Drift Classification

| Drift Type | Scope |
|------------|-------|
| UAT apply path drift | **Yes** — UAT built from manual/squashed SQL, not numbered chain 001–039 |
| Repo internal dual-track | **Yes** — repo contains both `001_tgd_wms_schema_foundation` (early) and `001_core_master_data` + 004–039 (canonical) |
| Customer Portal 041 mismatch | **Repo canonical** references `tgd_picking_documents`; UAT has legacy `tgd_picking_tasks` only |

**Conclusion:** Drift is **primarily UAT apply history**, amplified by **repo's intentional evolution** from early foundation to canonical picking/dispatch model. Application services (`pickingService.js`) already target **canonical** `tgd_picking_documents`.

---

## Part B — Repo Migration Findings

### 1. Where `set_updated_at()` Is Defined

| File | Definition |
|------|------------|
| `database/migrations/001_core_master_data.sql` | `create or replace function set_updated_at()` — trigger updates `new.updated_at = now()` |
| `001_tgd_wms_schema_foundation.sql` | **Does not define** this function |

Migration `040` requires `public.set_updated_at()` for deposit/withdrawal header triggers.

### 2. Canonical Picking Model in Repo

| Artifact | Table |
|----------|-------|
| `010_picking_foundation.sql` | `tgd_picking_documents`, `tgd_picking_lines` |
| `015_handheld_picking_foundation.sql` | FK → `tgd_picking_documents` |
| `011_dispatch_goods_issue_foundation.sql` | `tgd_dispatch_documents.picking_document_id` → `tgd_picking_documents` |
| `041_tgd_wms_customer_portal_roles_and_source_links.sql` | `tgd_customer_withdrawal_execution_links.picking_document_id` → `tgd_picking_documents` |
| `src/services/pickingService.js` | `.from('tgd_picking_documents')` |

**`tgd_picking_documents` is canonical** in current repo design.

### 3. `tgd_picking_tasks` Status

| Context | Role |
|---------|------|
| `001_tgd_wms_schema_foundation.sql` | Original early WMS picking model |
| `007_tgd_wms_schema_seed_alignment.sql` | Patches `customer_id`, `location_id`; RLS in `009_tgd_wms_rls_recursion_fix.sql` |
| `docs/deployment/supabase-staging-apply-plan.md` | Lists `001_tgd_wms_schema_foundation` as staging entry point |
| Current app picking services | **Do not use** `tgd_picking_tasks` |

**`tgd_picking_tasks` is legacy/early foundation**, retained on UAT from initial staging apply. Not current canonical for new features.

### 4. Dispatch ↔ Picking Reference

| Track | Dispatch → Picking |
|-------|-------------------|
| Early (`001_tgd_wms`) | No picking FK on dispatch |
| Canonical (`011`) | `picking_document_id` → `tgd_picking_documents(id)` |

UAT dispatch follows **early track** (no picking FK).

### 5. Should 041 Reference `tgd_picking_documents`?

**Yes for repo/Production canonical path.** `041` is correct for the evolved schema.

For **UAT today**, `041` cannot apply without either:

- Adding `tgd_picking_documents` (remediation), or
- Patching `041` to defer picking FK (Option C — UAT-only variant)

---

## Part C — Remediation Options Comparison

### Option A — Add Missing Foundation to UAT (Phased) ✅ Recommended

| Phase | Action |
|-------|--------|
| A1 | `create or replace function public.set_updated_at()` (from `001_core`) |
| A2 | Create canonical `tgd_picking_documents` shell (FK-safe for `041`; defer `allocation_id` FK until `009` exists) |
| A3 | Re-run CUSTOMER-PORTAL-2D: 040 → 041 unchanged |

| Criterion | Rating |
|-----------|--------|
| Migration risk | **Low** (additive only) |
| UAT compatibility | **High** — unblocks 040/041 |
| Repo alignment | **High** — matches canonical naming |
| Rollback | Drop triggers/function only if needed; tables empty |
| Customer Portal 2D | **Unblocks** |
| Gate 2E | Picking link column ready; RPC hardening still separate |
| Data migration | **None** |

**Caveat:** Full `010` (`tgd_picking_lines`, `tgd_confirm_picking_document`) remains a **separate gate** because UAT lacks `tgd_withdrawal_allocations`.

### Option B — Patch 041 to Use `tgd_picking_tasks`

| Criterion | Rating |
|-----------|--------|
| Migration risk | Medium — wrong FK semantics (different entity) |
| Repo alignment | **Poor** — diverges from app + 010/011/041 |
| Customer Portal 2D | Unblocks on UAT only |
| Gate 2E / Production | **Requires revert or dual-path SQL** |

**Not recommended.**

### Option C — Defer Picking FK in 041 (Conditional)

Replace inline `references tgd_picking_documents(id)` with nullable `uuid` + conditional `DO $$` FK block (pattern already used for deposit links).

| Criterion | Rating |
|-----------|--------|
| Migration risk | **Low** |
| UAT compatibility | Unblocks 041 without picking table |
| Repo alignment | **Partial** — 041 becomes tolerant of missing picking |
| Traceability | Picking link column exists but **no FK until remediation** |
| Gate 2E | RPC must handle null picking links |

**Acceptable fallback** if Controller rejects Option A Phase 2.

### Option D — Rebuild UAT from Migration Chain

| Criterion | Rating |
|-----------|--------|
| Risk | **Very high** — data loss, downtime |
| Recommendation | **Do not proceed** without explicit disposable-UAT approval |

---

## Part D — Recommended Option

### **Option A (Phased)** with draft `042_uat_foundation_remediation_draft.sql`

**Apply order after Controller approval:**

1. `042_uat_foundation_remediation_draft.sql` (UAT only)
2. `040_tgd_wms_customer_portal_source_documents.sql`
3. `041_tgd_wms_customer_portal_roles_and_source_links.sql`
4. *(Separate gate)* UAT profile linkage SQL
5. *(Separate gate)* Gate 2E RPC hardening

**Do not apply 042 to Production.** Production should follow full canonical chain including `001_core`, `009`, `010`, then `040`/`041`.

### Hold Criteria (Do Not Apply 040/041 Until)

- [ ] `public.set_updated_at()` exists on UAT
- [ ] `public.tgd_picking_documents` exists on UAT (minimal shell acceptable for 2D)
- [ ] Pre-apply readiness re-check passes
- [ ] Controller approval for UAT remediation apply recorded

### CUSTOMER-PORTAL-2D Re-Run Checklist

1. Environment guard: ref `lievvsqbosvrolkrftna`, `VITE_APP_ENV=uat`, git clean
2. Foundation objects exist: `set_updated_at`, `tgd_picking_documents`, execution tables, RLS helpers
3. Customer portal tables absent
4. Migration safety re-check on 040/041 files
5. Apply 042 (if approved) → verify function + picking table
6. Apply 040 → verify 6 tables, RLS, no DELETE, no data inserted
7. Apply 041 → verify role constraint, source columns, link tables
8. `npm test -- --run`, `npm run build`
9. Playwright smoke (if browser installed)
10. **Do not** run profile linkage, auth changes, Gate 3B-5

---

## Part E — SQL Draft Reference

Draft file: `database/migrations/042_uat_foundation_remediation_draft.sql`

Contents (not executed):

- `set_updated_at()` from canonical definition
- `tgd_picking_documents` shell compatible with `041` FK (no stock RPC, no lines table, deferred `allocation_id` FK)

---

## Risks / Limitations

1. UAT has **no migration tracking table** — manual apply discipline required
2. UAT dispatch remains **early shape** — `041` dispatch FK works (table exists) but picking traceability incomplete until full `010`/`011` alignment
3. `tgd_picking_tasks` coexists with new `tgd_picking_documents` — no automatic data bridge; operational picking on UAT may still use legacy tasks until migration gate
4. `010` full apply blocked until `tgd_withdrawal_allocations` (`009`) exists on UAT
5. Profile linkage and Gate 2E still required before real customer portal writes
6. Gate 3B-5 Export Execute remains **BLOCKED**

---

## Recommendation Summary

| Decision | Status |
|----------|--------|
| Ready to commit review doc/draft | **Yes** (after tests pass) |
| Ready to request UAT remediation apply approval | **Yes** — Option A phased via 042 |
| Re-run CUSTOMER-PORTAL-2D | **After** 042 apply + verification |
| Profile linkage | **Separate approval** |
| Gate 2E RPC | **Before real write** |
| Gate 3B-5 | **Still blocked** |
