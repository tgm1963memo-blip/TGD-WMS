# Database Schema Foundation

## Purpose
Create a solid, auditable Supabase schema for TGD WMS that supports cold‑storage deposit operations while enforcing core principles such as a movement‑ledger source of truth and customer isolation.

## Database Principles
- **Movement Ledger**: `tgd_stock_movements` records every inventory‑affecting event and is the single source of truth.
- **Stock Balance Snapshot**: `tgd_stock_balances` provides a read‑only snapshot derived from the ledger; it must never be written directly by the frontend.
- **Customer Isolation**: All operational tables contain a `customer_id` column to segregate data per customer.
- **Auditability**: Every table includes `created_at`, `updated_at`, and `created_by`/`updated_by` where appropriate. An `tgd_audit_logs` table records high‑level actions.
- **Future RLS & RPC**: Schema is designed with `customer_id` and role‑based columns so that Row‑Level Security policies and RPC functions can be added in later sprints.

## Table Groups
### A. Master Data
- `tgd_customers`
- `tgd_products`
- `tgd_lots`
- `tgd_warehouses`
- `tgd_zones`
- `tgd_locations`
- `tgd_pallets`

### B. Stock Foundation
- `tgd_stock_balances`
- `tgd_stock_movements`

### C. Inbound / Receiving
- `tgd_receiving_documents`
- `tgd_receiving_lines`
- `tgd_putaway_tasks`

### D. Internal Movement
- `tgd_transfer_documents`
- `tgd_transfer_lines`
- `tgd_adjustment_documents`
- `tgd_adjustment_lines`

### E. Stock Count
- `tgd_stock_count_sessions`
- `tgd_stock_count_lines`

### F. Customer Withdrawal / Outbound
- `tgd_withdrawal_requests`
- `tgd_withdrawal_request_lines`
- `tgd_allocation_records`
- `tgd_picking_tasks`
- `tgd_dispatch_documents`
- `tgd_dispatch_lines`

### G. Billing / Accounting Handoff
- `tgd_operation_charges`
- `tgd_monthly_storage_snapshots`
- `tgd_accounting_charge_staging`

### H. Security / Audit
- `tgd_user_profiles`
- `tgd_audit_logs`

## Key Relationships
- **Customers ↔ Operational tables** via `customer_id`.
- **Products ↔ Lots** via `product_id`.
- **Warehouses ↔ Zones ↔ Locations ↔ Pallets** hierarchical FK chain.
- **Documents ↔ Lines** (receiving, transfer, adjustment, withdrawal, dispatch) using `document_id`.
- **Movements** reference source and destination locations, pallets, and optionally related documents.
- **Stock balances** reference `customer_id`, `product_id`, `lot_id`, `location_id` as a unique composite key.

## Movement Ledger Model
| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | PK |
| `customer_id` | UUID | Owner of the movement |
| `product_id` | UUID | Product affected |
| `lot_id` | UUID | Lot involved |
| `from_location_id` | UUID | Source location (NULL for receipts) |
| `to_location_id` | UUID | Destination location (NULL for issues) |
| `quantity` | numeric | Qty moved |
| `weight` | numeric | Weight moved |
| `movement_type` | text CHECK (movement_type IN ('RECEIPT','PUTAWAY','TRANSFER','ADJUSTMENT','WITHDRAWAL','DISPATCH')) |
| `movement_date` | timestamptz |
| `related_document_id` | UUID | FK to the originating document |
| `created_at` | timestamptz |
| `updated_at` | timestamptz |

## Stock Balance Model
Snapshot table – **read‑only** for the frontend.
| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | PK |
| `customer_id` | UUID |
| `product_id` | UUID |
| `lot_id` | UUID |
| `location_id` | UUID |
| `quantity` | numeric |
| `weight` | numeric |
| `last_movement_id` | UUID | Last ledger entry that updated this balance |
| `created_at` | timestamptz |
| `updated_at` | timestamptz |

## Customer Isolation Model
All operational tables include a non‑nullable `customer_id` column. This allows future Row‑Level Security policies to filter rows by the authenticated user's `customer_id`.

## Audit Model
- `tgd_audit_logs` captures high‑level actions (e.g., document creation, status changes) with `action`, `entity_type`, `entity_id`, `performed_by`, and timestamps.
- `tgd_user_profiles` stores user metadata and role assignments (staff, manager, accounting, viewer, admin).

## Future RLS Support
- RLS policies will use `customer_id` and role information from `tgd_user_profiles`.
- Policies will be added in Sprint 13C.

## Future RPC Support
- Stock‑changing operations (receiving, putaway, transfer, adjustment, withdrawal, dispatch) will be encapsulated in RPC functions that insert rows into `tgd_stock_movements` and update `tgd_stock_balances` atomically.

## Known Gaps
- No trigger or function currently updates `tgd_stock_balances` from the ledger – to be added later.
- No detailed index strategy beyond basic foreign‑key indexes.
- No data‑type constraints for SKU codes, location codes, etc.
- No seed data or sample rows.
- No RLS policies or RPC functions yet.

---
*Prepared for Controller review. No live Supabase migration has been executed.*
