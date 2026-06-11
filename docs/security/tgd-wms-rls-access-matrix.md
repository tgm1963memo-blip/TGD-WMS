# tgd-wms-rls-access-matrix

## Table‑by‑Role Access Matrix

| Table | admin | warehouse_manager | warehouse_staff | accounting | viewer |
|-------|-------|-------------------|----------------|------------|--------|
| tgd_customers | READ_WRITE | READ | READ | READ | READ |
| tgd_products | READ_WRITE | READ | READ | READ | READ |
| tgd_lots | READ_WRITE | READ | READ | READ | READ |
| tgd_warehouses | READ_WRITE | READ | READ | READ | READ |
| tgd_zones | READ_WRITE | READ | READ | READ | READ |
| tgd_locations | READ_WRITE | READ | READ | READ | READ |
| tgd_pallets | READ_WRITE | READ | READ | READ | READ |
| tgd_stock_balances | ADMIN_ONLY | READ | READ | READ | READ |
| tgd_stock_movements | ADMIN_ONLY | READ | READ | READ | READ |
| tgd_user_profiles | READ_WRITE | READ | READ | READ | READ |
| tgd_audit_logs | READ_WRITE | READ | READ | READ | NONE |
| tgd_receiving_documents | READ_WRITE | READ_WRITE | READ_WRITE | READ | READ |
| tgd_receiving_lines | READ_WRITE | READ_WRITE | READ_WRITE | READ | READ |
| tgd_putaway_tasks | READ_WRITE | READ_WRITE | READ_WRITE | READ | READ |
| tgd_transfer_documents | READ_WRITE | READ_WRITE | READ_WRITE | READ | READ |
| tgd_transfer_lines | READ_WRITE | READ_WRITE | READ_WRITE | READ | READ |
| tgd_adjustment_documents | READ_WRITE | READ_WRITE | READ_WRITE | READ | READ |
| tgd_adjustment_lines | READ_WRITE | READ_WRITE | READ_WRITE | READ | READ |
| tgd_stock_count_sessions | READ_WRITE | READ_WRITE | READ_WRITE | READ | READ |
| tgd_stock_count_lines | READ_WRITE | READ_WRITE | READ_WRITE | READ | READ |
| tgd_withdrawal_requests | READ_WRITE | READ_WRITE | READ_WRITE | READ | READ |
| tgd_withdrawal_request_lines | READ_WRITE | READ_WRITE | READ_WRITE | READ | READ |
| tgd_allocation_records | READ_WRITE | READ_WRITE | READ_WRITE | READ | READ |
| tgd_picking_tasks | READ_WRITE | READ_WRITE | READ_WRITE | READ | READ |
| tgd_dispatch_documents | READ_WRITE | READ_WRITE | READ_WRITE | READ | READ |
| tgd_dispatch_lines | READ_WRITE | READ_WRITE | READ_WRITE | READ | READ |
| tgd_operation_charges | READ_WRITE | READ_WRITE | READ_WRITE | READ_WRITE | READ |
| tgd_monthly_storage_snapshots | READ_WRITE | READ | READ | READ_WRITE | READ |
| tgd_accounting_charge_staging | READ_WRITE | READ | NONE | READ_WRITE | READ |
| tgd_customer_owned_inventory | READ_WRITE | READ_WRITE | READ_WRITE | READ | READ |
| tgd_billing_invoice_drafts | READ_WRITE | READ | NONE | READ_WRITE | NONE |
| tgd_billing_invoice_draft_lines | READ_WRITE | READ | NONE | READ_WRITE | NONE |

**Gate 3B-RLS billing invoice draft notes (migration 039)**
- `warehouse_manager`: SELECT only on draft header/lines (read-only UAT review).
- `warehouse_staff` / `viewer`: no billing invoice draft table access.
- `admin` / `accounting`: SELECT, INSERT, UPDATE (no DELETE; status lifecycle remains service-validated).
- Customer-scoped profiles: rows limited to matching `customer_id`; internal users with null `customer_id` see global scope.
- `tgd_next_billing_invoice_draft_no()` remains executable by `authenticated`; unauthorized inserts are blocked by RLS.

**Access Labels**
- **NONE** – No access.
- **READ** – SELECT only.
- **INSERT** – INSERT only.
- **UPDATE** – UPDATE only.
- **READ_WRITE** – SELECT, INSERT, UPDATE (no DELETE).
- **ADMIN_ONLY** – Full control for admins; other roles limited to READ.

The matrix reflects the RLS foundation; column‑level restrictions and future RPC‑driven writes will be added in later sprints.
