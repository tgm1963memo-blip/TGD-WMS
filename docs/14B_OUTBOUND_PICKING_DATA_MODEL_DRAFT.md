# 14B Outbound / Picking Data Model Draft

**Purpose**: Draft the foundational database schema for the Outbound & Picking module. This migration adds the core tables and constraints required to capture outbound documents, line items, and reservations. No stock‑out movement logic or triggers are introduced at this stage.

---

## Tables created (migration `025_tgd_wms_outbound_picking_foundation.sql`)

1. **tgd_outbound_documents** – header for an outbound/shipping document.
   - Primary key `id` (UUID).
   - `document_no` – unique human‑readable identifier.
   - `status` – lifecycle values **DRAFT**, **RESERVED**, **PICKED**, **CONFIRMED**, **CANCELLED**.
   - Customer, source‑module tracking, requested ship date, audit fields (`created_by`, `posted_by`, `posted_at`, `cancelled_by`, `cancelled_at`).
   - Timestamps `created_at`, `updated_at` (default `now()`).
   - Indexes on `document_no` and `customer_id`.

2. **tgd_outbound_lines** – line items belonging to a document.
   - Foreign key `document_id` → `tgd_outbound_documents(id)` (cascade delete).
   - Product, optional lot, requested/picked quantities & weights.
   - `status` – **OPEN**, **RESERVED**, **PICKED**, **SHORT**, **CANCELLED**.
   - Quantity fields are non‑negative; `requested_quantity` must be > 0.
   - Indexes on `document_id`, `product_id`, `lot_id`.

3. **tgd_outbound_reservations** – stock reserved for a specific line and location.
   - FK `outbound_document_id` → `tgd_outbound_documents(id)`.
   - FK `outbound_line_id` → `tgd_outbound_lines(id)`.
   - Customer, product, optional lot, location, reserved quantity/weight.
   - `status` – **ACTIVE**, **RELEASED**, **CONSUMED**, **CANCELLED**.
   - Audit fields for creation/release.
   - Unique guard `uq_active_reservation_per_line_location` ensures only **one ACTIVE** reservation per line per location.
   - Indexes on document, line, product and location.

---

## Relationship model
```
 tgd_outbound_documents 1 ── * tgd_outbound_lines
 tgd_outbound_documents 1 ── * tgd_outbound_reservations
 tgd_outbound_lines      1 ── * tgd_outbound_reservations
```
Each reservation ties a line to a specific warehouse location.

---

## Status lifecycle
- **Document**: DRAFT → RESERVED (stock reserved) → PICKED (pick complete) → CONFIRMED (shipment posted) → CANCELLED.
- **Line**: OPEN → RESERVED → PICKED → SHORT (partial) → CANCELLED.
- **Reservation**: ACTIVE → RELEASED (stock freed) → CONSUMED (stock used for pick) → CANCELLED.

---

## What is intentionally **not** implemented
- No outbound `stock_movement` creation (OUT direction) – will be added in a later sprint.
- No trigger that updates `tgd_stock_balances`.
- No RPC wrappers; they will be introduced after the schema is stable.
- No business‑logic validation beyond DB constraints.

---

## Safety notes
- All tables are additive only; they do **not** modify existing schema.
- No DML operations are performed by this migration; it is safe to apply to Staging.
- Production remain untouched until explicit approval.
- Constraints enforce non‑negative quantities and valid status enums, preventing malformed data.

---

## Next sprint plan (14C – RPC implementation)
1. Create RPCs (`tgd_rpc_create_outbound_draft`, `tgd_rpc_add_outbound_line`, `tgd_rpc_reserve_outbound_stock`, `tgd_rpc_release_outbound_reservation`, `tgd_rpc_post_outbound_document`).
2. Add audit field population in each RPC.
3. Implement UI integration for the new tables.
4. Write comprehensive integration tests covering the full outbound flow.
5. Add trigger to create `tgd_stock_movements` (OUT) and update balances after posting.

---

**Note**: Production is strictly not touched in this sprint. All changes are limited to design and schema draft.
