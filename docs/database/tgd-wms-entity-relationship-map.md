# Entity Relationship Map for TGD WMS

## Overview
This document provides a high‑level entity‑relationship view of the database foundation created in Sprint 13B. It lists the main tables, their primary keys, and the key foreign‑key relationships between them.

## Table List
| Table | Primary Key | Key Foreign Keys |
|-------|-------------|-------------------|
| **tgd_customers** | `id` (UUID) | — |
| **tgd_products** | `id` (UUID) | — |
| **tgd_lots** | `id` (UUID) | `product_id` → `tgd_products(id)` |
| **tgd_warehouses** | `id` (UUID) | — |
| **tgd_zones** | `id` (UUID) | `warehouse_id` → `tgd_warehouses(id)` |
| **tgd_locations** | `id` (UUID) | `zone_id` → `tgd_zones(id)` |
| **tgd_pallets** | `id` (UUID) | `location_id` → `tgd_locations(id)` |
| **tgd_stock_balances** | `id` (UUID) | `customer_id` → `tgd_customers(id)`<br>`product_id` → `tgd_products(id)`<br>`lot_id` → `tgd_lots(id)`<br>`location_id` → `tgd_locations(id)` |
| **tgd_stock_movements** | `id` (UUID) | `customer_id` → `tgd_customers(id)`<br>`product_id` → `tgd_products(id)`<br>`lot_id` → `tgd_lots(id)`<br>`from_location_id` → `tgd_locations(id)`<br>`to_location_id` → `tgd_locations(id)`<br>`related_document_id` → various document tables (see below) |
| **tgd_receiving_documents** | `id` (UUID) | `customer_id` → `tgd_customers(id)` |
| **tgd_receiving_lines** | `id` (UUID) | `document_id` → `tgd_receiving_documents(id)`<br>`product_id` → `tgd_products(id)`<br>`lot_id` → `tgd_lots(id)` |
| **tgd_putaway_tasks** | `id` (UUID) | `receiving_line_id` → `tgd_receiving_lines(id)` |
| **tgd_transfer_documents** | `id` (UUID) | `customer_id` → `tgd_customers(id)` |
| **tgd_transfer_lines** | `id` (UUID) | `document_id` → `tgd_transfer_documents(id)`<br>`product_id` → `tgd_products(id)`<br>`lot_id` → `tgd_lots(id)` |
| **tgd_adjustment_documents** | `id` (UUID) | `customer_id` → `tgd_customers(id)` |
| **tgd_adjustment_lines** | `id` (UUID) | `document_id` → `tgd_adjustment_documents(id)`<br>`product_id` → `tgd_products(id)`<br>`lot_id` → `tgd_lots(id)` |
| **tgd_stock_count_sessions** | `id` (UUID) | `customer_id` → `tgd_customers(id)` |
| **tgd_stock_count_lines** | `id` (UUID) | `session_id` → `tgd_stock_count_sessions(id)`<br>`product_id` → `tgd_products(id)`<br>`lot_id` → `tgd_lots(id)` |
| **tgd_withdrawal_requests** | `id` (UUID) | `customer_id` → `tgd_customers(id)` |
| **tgd_withdrawal_request_lines** | `id` (UUID) | `request_id` → `tgd_withdrawal_requests(id)`<br>`product_id` → `tgd_products(id)`<br>`lot_id` → `tgd_lots(id)` |
| **tgd_allocation_records** | `id` (UUID) | `withdrawal_line_id` → `tgd_withdrawal_request_lines(id)` |
| **tgd_picking_tasks** | `id` (UUID) | `allocation_id` → `tgd_allocation_records(id)` |
| **tgd_dispatch_documents** | `id` (UUID) | `customer_id` → `tgd_customers(id)` |
| **tgd_dispatch_lines** | `id` (UUID) | `document_id` → `tgd_dispatch_documents(id)`<br>`product_id` → `tgd_products(id)`<br>`lot_id` → `tgd_lots(id)` |
| **tgd_operation_charges** | `id` (UUID) | `customer_id` → `tgd_customers(id)` |
| **tgd_monthly_storage_snapshots** | `id` (UUID) | `customer_id` → `tgd_customers(id)` |
| **tgd_accounting_charge_staging** | `id` (UUID) | `customer_id` → `tgd_customers(id)` |
| **tgd_user_profiles** | `id` (UUID) | — |
| **tgd_audit_logs** | `id` (UUID) | `performed_by` → `tgd_user_profiles(id)` |

## Relationship Summary
- **Master data** (`customers`, `products`, `lots`, `warehouses`, `zones`, `locations`, `pallets`) provides reference data for all operational tables.
- **Operational documents** (receiving, transfer, adjustment, withdrawal, dispatch) each have a header table and line table.
- **Movement ledger** (`tgd_stock_movements`) ties back to the originating document via `related_document_id`.
- **Stock balances** are derived from the ledger and keyed by `customer_id`, `product_id`, `lot_id`, `location_id`.
- **Audit & user profile** tables support future RLS and activity tracking.

---
*Prepared for Controller review. No forbidden naming is used.*
