# CUSTOMER-PORTAL-2B — Real Customer Portal Data Model Design

**Gate:** CUSTOMER-PORTAL-2B (design + migration draft only)  
**Status:** DRAFT — not applied to UAT/Production  
**Migration draft:** `database/migrations/040_tgd_wms_customer_portal_source_documents.sql`  
**Prior work:** CUSTOMER-PORTAL-1/1B (demo UI), CUSTOMER-PORTAL-2A (source-document guidance)

---

## 1. Source document principle

| Layer | Document type | Purpose |
|-------|---------------|---------|
| **Source** | `tgd_customer_deposit_requests` | ลูกค้าแจ้งฝาก — ธุรการไม่ควร key ซ้ำ |
| **Source** | `tgd_customer_withdrawal_requests` | ลูกค้าแจ้งเบิก — ใบเบิกภายในอ้างอิงจากนี้ |
| **Execution** | `tgd_receiving_documents` | รับเข้าจริงในคลัง (RPC post stock) |
| **Execution** | `tgd_withdrawal_requests` → picking → dispatch | เบิก/หยิบ/จ่ายจริง |

Flow:

```
Customer Deposit Request → Admin Review → Receiving Execution → Verification → Notify → CLOSED
Customer Withdrawal Request → Admin Review → Internal Withdrawal → Picking → Dispatch → Notify → CLOSED
```

---

## 2. Existing schema dependency map

### Master / identity

| Object | Role |
|--------|------|
| `tgd_customers` | FK สำหรับ `customer_id`, `customer_code` |
| `tgd_products` | Optional FK บน line (`product_id`) |
| `tgd_user_profiles` | `auth_user_id`, `customer_id`, `role`, `is_active` |
| `tgd_current_user_role()` | RLS helper (009) |
| `tgd_current_user_customer_id()` | Customer scope (007 added `customer_id`) |
| `tgd_current_user_is_active()` | Active profile check |

### Internal execution (existing — do not replace)

| Object | Notes |
|--------|-------|
| `tgd_receiving_documents` / `tgd_receiving_lines` | มี `source_type`, `source_no` อยู่แล้ว (004) |
| `tgd_withdrawal_requests` / `tgd_withdrawal_request_lines` | มี `request_source`, `request_reference_no`, `request_reference_id` (008) |
| `tgd_picking_documents` | FK `withdrawal_request_id` (010) |
| `tgd_dispatch_documents` | FK `withdrawal_request_id`, `picking_document_id` (011) |
| `tgd_audit_logs` | Generic audit — แยกจาก customer timeline |

### Linkage connection points

| Source field (proposed) | Connects to |
|-------------------------|-------------|
| `source_customer_deposit_request_id` | `tgd_receiving_documents` (execution header) |
| `source_customer_deposit_request_line_id` | `tgd_receiving_lines` (future line link) |
| `source_customer_withdrawal_request_id` | `tgd_withdrawal_requests` (internal execution header) |
| `source_customer_withdrawal_request_id` | `tgd_picking_documents`, `tgd_dispatch_documents` (denormalized trace) |

**Existing reuse opportunity:** `tgd_withdrawal_requests.request_reference_id` สามารถเก็บ customer withdrawal UUID ได้ทันทีโดยตั้ง `request_source = 'CUSTOMER_PORTAL'` ก่อนเพิ่มคอลัมน์ dedicated

### `tgd_user_profiles.customer_id` for customer admin

- เพิ่มใน migration 007 พร้อม FK → `tgd_customers`
- `tgd_current_user_customer_id()` อ่านจาก profile ที่ `auth_user_id = auth.uid()`
- **รองรับ multi-admin:** หลาย profile ชี้ `customer_id` เดียวกันได้ — แยก actor ด้วย `created_by_user_id` / timeline `actor_user_id`
- **ข้อจำกัดปัจจุบัน:** role constraint ยังไม่มี `customer_admin` / `customer_user` — ต้องเพิ่มใน Gate 2C ก่อนเปิด RLS จริง
- **UAT known issue:** login user ยังไม่ผูก profile → ต้องแก้ linkage แยก

---

## 3. Proposed tables (migration 040)

1. `tgd_customer_deposit_requests` — header + audit fields
2. `tgd_customer_deposit_request_lines` — product/lot/qty/weight
3. `tgd_customer_withdrawal_requests` — header + audit fields
4. `tgd_customer_withdrawal_request_lines` — source deposit ref + picking_rule
5. `tgd_customer_document_attachments` — metadata only (no bucket create)
6. `tgd_customer_document_timeline_events` — status/action audit per document

---

## 4. Source linkage recommendation

### Option 1 — Nullable FK on existing headers (RECOMMENDED)

```sql
tgd_receiving_documents.source_customer_deposit_request_id
tgd_receiving_documents.source_customer_deposit_request_no
tgd_withdrawal_requests.source_customer_withdrawal_request_id
tgd_withdrawal_requests.source_customer_withdrawal_no
tgd_picking_documents.source_customer_withdrawal_request_id  -- optional denorm
tgd_dispatch_documents.source_customer_withdrawal_request_id -- optional denorm
```

| Criterion | Assessment |
|-----------|------------|
| Migration risk | ต่ำ–กลาง — `ADD COLUMN IF NOT EXISTS` nullable, ไม่กระทบข้อมูลเดิม |
| Backward compatibility | สูง — manual/internal docs ยังใช้ได้ (FK null) |
| Query simplicity | สูง — join ตรงจาก execution → source |
| Rollback | ลบคอลัมน์ได้ถ้าไม่มีข้อมูลผูก |
| Audit clarity | สูง — เห็น source บน execution document |

**Align with existing:** ตั้ง `source_type = 'CUSTOMER_DEPOSIT'` และ `request_source = 'CUSTOMER_PORTAL'` คู่กับ FK

### Option 2 — Mapping tables

` tgd_customer_deposit_receiving_links`, `tgd_customer_withdrawal_execution_links`

| Criterion | Assessment |
|-----------|------------|
| Migration risk | ต่ำ — ไม่แตะตารางเดิม |
| Backward compatibility | สูงสุด |
| Query simplicity | ต่ำกว่า — ต้อง join เพิ่ม |
| Rollback | ง่าย — drop link table |
| Audit clarity | ดีสำหรับ 1:N (partial receiving หลายครั้ง) |

**Recommendation:** ใช้ **Option 1** สำหรับ header-level link ใน Gate 2E; เพิ่ม **line-level link table** ภายหลังถ้าต้องรองรับ partial receiving หลาย receiving documents ต่อ deposit request เดียว

---

## 5. RLS design summary

### Helper functions (reuse)

- `tgd_current_user_role()`
- `tgd_current_user_customer_id()`
- `tgd_current_user_is_active()`

### Role matrix (draft)

| Role | Deposit/Withdrawal source | Review fields | Warehouse status | Attachments |
|------|---------------------------|---------------|------------------|-------------|
| `admin` | full | read/write | read/write | full |
| `accounting` | read/write review | read/write | read | read |
| `warehouse_manager` | read + warehouse statuses | read | read/write execution | read |
| `warehouse_staff` | read (accepted+) | no write | warehouse execution only | read relevant |
| `viewer` | internal read only | no write | read | no write |
| `customer_admin` | own `customer_id` | no write review | no write | own upload/read |
| `customer_user` | own create/read draft | no write review | no write | own upload/read |

### Customer scoped rule

```sql
public.tgd_current_user_customer_id() = customer_id
AND public.tgd_current_user_role() IN ('customer_admin', 'customer_user')
```

- `customer_id IS NULL` on profile = internal user only
- Customer cannot update `reviewed_by_*`, `review_comment` after submit
- Direct table DELETE revoked — soft cancel via status + RPC

### Future role constraint (Gate 2C)

```sql
-- Extend tgd_user_profiles_role_check to include:
-- 'customer_admin', 'customer_user'
```

---

## 6. Storage design summary

| Item | Value |
|------|-------|
| Bucket | `customer-portal-attachments` (not created in 2B) |
| Path deposit | `customer/{customer_id}/deposit/{deposit_request_id}/{file_name}` |
| Path withdrawal | `customer/{customer_id}/withdrawal/{withdrawal_request_id}/{file_name}` |
| Max size | 10 MB (suggested) |
| MIME allowlist | PDF, JPG, PNG, XLS, XLSX, DOC, DOCX |
| Metadata table | `tgd_customer_document_attachments` |
| Storage RLS | customer path scoped; admin/accounting read all; warehouse read execution-related |

Upload flow (future 2G): signed URL → upload → insert metadata row → timeline event `ATTACHMENT_UPLOADED`

---

## 7. Status transition summary

### Deposit

| From | To |
|------|-----|
| DRAFT | SUBMITTED_BY_CUSTOMER, CANCELLED |
| SUBMITTED_BY_CUSTOMER | ADMIN_REVIEWING, CANCELLED |
| ADMIN_REVIEWING | ADMIN_ACCEPTED, ADMIN_REJECTED |
| ADMIN_ACCEPTED | WAREHOUSE_RECEIVING |
| WAREHOUSE_RECEIVING | PALLETIZING |
| PALLETIZING | RECEIVING_VARIANCE, RECEIVED_CONFIRMED |
| RECEIVING_VARIANCE | ADMIN_RECOUNT_REQUESTED, RECEIVED_CONFIRMED |
| ADMIN_RECOUNT_REQUESTED | WAREHOUSE_RECEIVING |
| RECEIVED_CONFIRMED | CUSTOMER_NOTIFIED |
| CUSTOMER_NOTIFIED | CLOSED |

### Withdrawal

| From | To |
|------|-----|
| WITHDRAWAL_DRAFT | SUBMITTED_BY_CUSTOMER, CANCELLED |
| SUBMITTED_BY_CUSTOMER | ADMIN_REVIEWING, CANCELLED |
| ADMIN_REVIEWING | ADMIN_ACCEPTED, ADMIN_REJECTED |
| ADMIN_ACCEPTED | WAREHOUSE_PICKING |
| WAREHOUSE_PICKING | PICKING_VARIANCE, PICKED |
| PICKED | PACKING_LIST_RECORDED |
| PACKING_LIST_RECORDED | LOADING |
| LOADING | LOADED_CONFIRMED |
| LOADED_CONFIRMED | CUSTOMER_NOTIFIED |
| CUSTOMER_NOTIFIED | CLOSED |

Enforcement: RPC-only status changes in Gate 2E (not direct UPDATE from frontend)

---

## 8. Multi-admin audit design

### Document header fields

- `created_by_user_id`, `created_by_email`, `created_by_display_name`, `created_by_role`
- `submitted_by_user_id`, `submitted_by_email`, `submitted_at`
- `last_action_by_user_id`, `last_action_by_email`, `last_action_at`
- `reviewed_by_user_id`, `reviewed_by_email`, `reviewed_at`

### Timeline table

`tgd_customer_document_timeline_events` — บันทึกทุก action พร้อม `actor_user_id`, `actor_email`, `actor_role`, `actor_customer_id`, `from_status`, `to_status`, `metadata_json`

**Multi-admin:** ลูกค้าหนึ่งรายมี admin หลายคน (หลาย profile, `customer_id` เดียวกัน) — timeline ระบุ actor แต่ละคน ไม่พึ่ง single owner field

---

## 9. Service / API boundary plan (future — not implemented in 2B)

| Service file | Responsibility |
|--------------|----------------|
| `customerDepositRequestService.js` | CRUD draft, submit, list by customer |
| `customerWithdrawalRequestService.js` | CRUD draft, submit, list by customer |
| `customerDocumentTimelineService.js` | Append/list timeline events |
| `customerAttachmentService.js` | Metadata + signed URL coordination |

**Boundary rules:**

- Frontend → Supabase RPC only for writes (mirror receiving pattern)
- No direct INSERT/UPDATE on headers after submit (RLS + revoke)
- Stock movement remains in existing `tgd_rpc_post_receiving_document` / dispatch RPCs
- Spawn execution document = separate RPC in Gate 2E

---

## 10. Implementation phases

| Phase | Scope |
|-------|-------|
| **2B** | Design + migration draft 040 + docs + tests (this gate) |
| **2C** | Migration review, role constraint, linkage migration 041 draft |
| **2D** | UAT apply (approved SQL only) |
| **2E** | RPC + services integration |
| **2F** | UI switch from demo data to real tables |
| **2G** | Email/notification |
| **2H** | Handheld/barcode real integration |

---

## 11. Risks and prohibitions (this gate)

- Migration 040 **not applied**
- No migration 038
- No Gate 3B-5 Export Execute
- No stock movement / RPC changes
- No Storage bucket / file upload
- No Production touch

---

## 12. CUSTOMER-PORTAL-2B scope statement

CUSTOMER-PORTAL-2B is **design and migration draft only**. No UAT DB apply, no customer RLS enablement in live environment, no service integration until Gate 2D/2E approval.
