# 14A Outbound / Picking Foundation Review

**Purpose**: Provide a comprehensive design foundation for the next WMS module – Outbound & Picking – before any stock‑out writes are implemented. This document records the current code base findings, proposes a workflow, data model, RPC list, UI pages, safety considerations, gaps, and a phased rollout plan.

---

## 1. Current files discovered
### Front‑end (src/features/operations)
- `DispatchCreatePage.jsx` / `DispatchDetailPage.jsx` / `DispatchListPage.jsx`
- `PickingCreatePage.jsx` / `PickingDetailPage.jsx` / `PickingListPage.jsx`
- Sub‑folders: `dispatch/`, `picking/`, `adjustment/`, `allocation/`, `putaway/`, `receiving/`, `transfer/`, `withdrawal/`

### Services (src/services)
- `dispatchService.js` – contains CRUD helpers for dispatch documents.
- `pickingService.js` – contains helpers for picking operations.
- `handheldPickingService.js` – UI‑specific service for handheld devices.
- `inventoryMovementService.js` – generic movement handling (used by receiving & adjustment).
- `stockCountService.js`, `stockBalanceTrigger` logic (in migrations) already support direction (IN/OUT).

### Routes (src/app/routes.jsx)
- `/operations/dispatch/*` and `/operations/picking/*` are already registered in the router.

### Tests (tests/unit)
- Existing unit tests cover dispatch/picking page rendering but no outbound business logic.

---

## 2. Existing DB objects (read‑only inspection)
- **Tables**
  - `tgd_dispatch_documents` – header for outbound dispatches.
  - `tgd_dispatch_lines` – line items.
  - `tgd_picking_documents` – header for picking runs.
  - `tgd_picking_lines` – line items.
  - `tgd_reservations` – holds reserved stock (used by picking and outbound).
  - `tgd_stock_movements` – already stores `direction` (IN/OUT) via trigger.
  - `tgd_stock_balances` – current stock per location/item.
- **RPCs**
  - Currently only receiving RPCs exist (`tgd_rpc_create_receiving_draft`, etc.). No outbound RPCs yet.
- **Triggers**
  - `tgd_stock_balance_trigger_direction_fix.sql` adds handling for outbound direction.

---

## 3. Recommended outbound workflow (high‑level)
| Step | Description |
|------|-------------|
| **A** | Create outbound draft (`tgd_rpc_create_outbound_draft`). |
| **B** | Select Customer → Sales Order → Dispatch Request (optional). |
| **C** | Add picking lines (SKU, qty, location). |
| **D** | Validate available stock from `tgd_stock_balances`. |
| **E** | Reserve stock (`tgd_rpc_reserve_outbound_stock`). |
| **F** | Confirm pick – lock reservation. |
| **G** | Create outbound `stock_movement` with `direction = 'OUT'`. |
| **H** | Trigger automatically reduces `tgd_stock_balances`. |
| **I** | Show movement trace (lineage to reservation). |
| **J** | Prevent duplicate posting via unique constraint on `source_document_id`. |

---

## 4. Recommended data model additions
- **Outbound Document** (`tgd_outbound_documents`)
  - `id PK`, `document_no`, `customer_id`, `status`, `created_by`, `created_at`, `posted_by`, `posted_at`.
- **Outbound Line** (`tgd_outbound_lines`)
  - `id PK`, `outbound_document_id FK`, `product_id`, `lot_id`, `location_id`, `qty_requested`, `qty_reserved`.
- **Reservation** (`tgd_reservations` already exists) – will be linked via `source_module = 'outbound'` and `source_document_id`.
- **Stock Movement** – reuse existing table, set `source_module = 'outbound'` and `source_document_id` to outbound doc.

---

## 5. Recommended RPC list (document only)
- `tgd_rpc_create_outbound_draft`
- `tgd_rpc_add_outbound_line`
- `tgd_rpc_reserve_outbound_stock`
- `tgd_rpc_release_outbound_reservation`
- `tgd_rpc_post_outbound_document`

*These RPCs will follow the same pattern as receiving RPCs, using supabase RPC wrappers to enforce audit fields.*

---

## 6. Recommended UI pages (existing, to be extended)
- **Dispatch** – Create / Detail / List (already present, will be repurposed for outbound dispatch).
- **Picking** – Create / Detail / List (already present, will be extended with reservation UI).
- **Reservation Summary** – new modal showing reserved quantities per line.
- **Post Confirmation** – final screen with GO/NO‑GO checkbox.

---

## 7. Safety rules & integration notes
- All stock‑out writes must go through the RPC layer – never direct `INSERT` into `tgd_stock_movements`.
- `stock_balance` updates are **trigger‑driven**; ensure the direction trigger is active.
- Auditing columns (`created_by`, `posted_by`, `posted_at`) must be populated by RPCs.
- Duplicate posting is prevented via a unique index on (`source_module`, `source_document_id`).
- UI must disable “Post” until every line is reserved and verified.

---

## 8. Implementation gaps (as‑is vs. to‑be)
- No outbound tables or RPCs defined yet.
- UI pages lack reservation handling and stock‑out validation.
- No test coverage for outbound flow.
- No documentation of the outbound data model in the schema files.
- Role/permission guards for outbound not yet created.

---

## 9. Proposed phased plan (14B‑14H)
| Phase | Goal | Deliverable |
|------|------|-------------|
| **14B** | Schema definition | Add migration files for outbound tables & triggers. |
| **14C** | RPC implementation | Create outbound RPC wrappers with audit & validation. |
| **14D** | UI extension | Extend Dispatch & Picking pages with reservation UI. |
| **14E** | Permission hardening | Add role checks for outbound operations. |
| **14F** | Automated tests | Unit & integration tests covering full outbound flow. |
| **14G** | Staging validation | Run end‑to‑end smoke tests in staging, verify stock balances. |
| **14H** | Production readiness | Apply migrations, run final GO checklist (already prepared). |

---

**Note**: Production is strictly not touched in this sprint. All work is limited to design, documentation, and read‑only inspection.

Safety hard rules:
- no manual stock movement insert
- no manual stock balance update
- Production is strictly not touched in this sprint.
outbound posting must be idempotent.
