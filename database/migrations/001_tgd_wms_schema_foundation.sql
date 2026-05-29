-- 001_tgd_wms_schema_foundation.sql
-- Migration: TGD WMS database schema foundation
-- This migration defines the core tables for the Warehouse Management System.
-- IMPORTANT: Do NOT execute against a production Supabase instance until Controller review.

-- Movement Ledger (source of truth)
CREATE TABLE IF NOT EXISTS tgd_stock_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL,
    product_id UUID NOT NULL,
    lot_id UUID NOT NULL,
    from_location_id UUID,
    to_location_id UUID,
    quantity NUMERIC NOT NULL,
    weight NUMERIC,
    movement_type TEXT NOT NULL CHECK (movement_type IN ('RECEIPT','PUTAWAY','TRANSFER','ADJUSTMENT','WITHDRAWAL','DISPATCH')),
    movement_date TIMESTAMPTZ NOT NULL DEFAULT now(),
    related_document_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Stock Balances (controlled snapshot, read‑only for frontend)
CREATE TABLE IF NOT EXISTS tgd_stock_balances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL,
    product_id UUID NOT NULL,
    lot_id UUID NOT NULL,
    location_id UUID NOT NULL,
    quantity NUMERIC NOT NULL,
    weight NUMERIC,
    last_movement_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Master Data
CREATE TABLE IF NOT EXISTS tgd_customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS tgd_products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sku TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS tgd_lots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES tgd_products(id),
    lot_number TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS tgd_warehouses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS tgd_zones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    warehouse_id UUID NOT NULL REFERENCES tgd_warehouses(id),
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS tgd_locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    zone_id UUID NOT NULL REFERENCES tgd_zones(id),
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS tgd_pallets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    location_id UUID NOT NULL REFERENCES tgd_locations(id),
    identifier TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Inbound / Receiving
CREATE TABLE IF NOT EXISTS tgd_receiving_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL,
    document_no TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('OPEN','CLOSED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS tgd_receiving_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES tgd_receiving_documents(id),
    product_id UUID NOT NULL REFERENCES tgd_products(id),
    lot_id UUID NOT NULL REFERENCES tgd_lots(id),
    quantity NUMERIC NOT NULL,
    weight NUMERIC,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS tgd_putaway_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    receiving_line_id UUID NOT NULL REFERENCES tgd_receiving_lines(id),
    target_location_id UUID NOT NULL REFERENCES tgd_locations(id),
    status TEXT NOT NULL CHECK (status IN ('PENDING','COMPLETED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Internal Movement
CREATE TABLE IF NOT EXISTS tgd_transfer_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL,
    document_no TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('OPEN','CLOSED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS tgd_transfer_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES tgd_transfer_documents(id),
    product_id UUID NOT NULL REFERENCES tgd_products(id),
    lot_id UUID NOT NULL REFERENCES tgd_lots(id),
    from_location_id UUID NOT NULL REFERENCES tgd_locations(id),
    to_location_id UUID NOT NULL REFERENCES tgd_locations(id),
    quantity NUMERIC NOT NULL,
    weight NUMERIC,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS tgd_adjustment_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL,
    document_no TEXT NOT NULL,
    reason TEXT,
    status TEXT NOT NULL CHECK (status IN ('OPEN','CLOSED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS tgd_adjustment_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES tgd_adjustment_documents(id),
    product_id UUID NOT NULL REFERENCES tgd_products(id),
    lot_id UUID NOT NULL REFERENCES tgd_lots(id),
    location_id UUID NOT NULL REFERENCES tgd_locations(id),
    quantity NUMERIC NOT NULL,
    weight NUMERIC,
    adjustment_type TEXT NOT NULL CHECK (adjustment_type IN ('INCREASE','DECREASE')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Stock Count
CREATE TABLE IF NOT EXISTS tgd_stock_count_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL,
    session_date DATE NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('PLANNED','COMPLETED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS tgd_stock_count_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES tgd_stock_count_sessions(id),
    product_id UUID NOT NULL REFERENCES tgd_products(id),
    lot_id UUID NOT NULL REFERENCES tgd_lots(id),
    location_id UUID NOT NULL REFERENCES tgd_locations(id),
    counted_quantity NUMERIC NOT NULL,
    counted_weight NUMERIC,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Customer Withdrawal / Outbound
CREATE TABLE IF NOT EXISTS tgd_withdrawal_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL,
    request_no TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('OPEN','APPROVED','FULFILLED','CANCELLED')),
    requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS tgd_withdrawal_request_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id UUID NOT NULL REFERENCES tgd_withdrawal_requests(id),
    product_id UUID NOT NULL REFERENCES tgd_products(id),
    lot_id UUID NOT NULL REFERENCES tgd_lots(id),
    quantity NUMERIC NOT NULL,
    weight NUMERIC,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS tgd_allocation_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    withdrawal_line_id UUID NOT NULL REFERENCES tgd_withdrawal_request_lines(id),
    allocated_quantity NUMERIC NOT NULL,
    allocated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS tgd_picking_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    allocation_id UUID NOT NULL REFERENCES tgd_allocation_records(id),
    picker_user_id UUID NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('PENDING','COMPLETED')),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS tgd_dispatch_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL,
    document_no TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('OPEN','SHIPPED','CANCELLED')),
    dispatched_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS tgd_dispatch_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES tgd_dispatch_documents(id),
    product_id UUID NOT NULL REFERENCES tgd_products(id),
    lot_id UUID NOT NULL REFERENCES tgd_lots(id),
    quantity NUMERIC NOT NULL,
    weight NUMERIC,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Billing / Accounting Handoff
CREATE TABLE IF NOT EXISTS tgd_operation_charges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL,
    charge_type TEXT NOT NULL,
    amount NUMERIC NOT NULL,
    charge_date DATE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS tgd_monthly_storage_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL,
    snapshot_month DATE NOT NULL,
    total_quantity NUMERIC NOT NULL,
    total_weight NUMERIC,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS tgd_accounting_charge_staging (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL,
    charge_id UUID NOT NULL REFERENCES tgd_operation_charges(id),
    posted BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Security / Audit
CREATE TABLE IF NOT EXISTS tgd_user_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL UNIQUE,
    role TEXT NOT NULL CHECK (role IN ('STAFF','MANAGER','ACCOUNTING','VIEWER','ADMIN')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS tgd_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id UUID NOT NULL,
    performed_by UUID NOT NULL REFERENCES tgd_user_profiles(id),
    performed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for performance (common lookup columns)
CREATE INDEX IF NOT EXISTS idx_stock_movements_customer ON tgd_stock_movements(customer_id);
CREATE INDEX IF NOT EXISTS idx_stock_balances_customer ON tgd_stock_balances(customer_id);
CREATE INDEX IF NOT EXISTS idx_receiving_documents_customer ON tgd_receiving_documents(customer_id);
CREATE INDEX IF NOT EXISTS idx_transfer_documents_customer ON tgd_transfer_documents(customer_id);
CREATE INDEX IF NOT EXISTS idx_adjustment_documents_customer ON tgd_adjustment_documents(customer_id);
CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_customer ON tgd_withdrawal_requests(customer_id);
CREATE INDEX IF NOT EXISTS idx_dispatch_documents_customer ON tgd_dispatch_documents(customer_id);
CREATE INDEX IF NOT EXISTS idx_operation_charges_customer ON tgd_operation_charges(customer_id);
CREATE INDEX IF NOT EXISTS idx_monthly_storage_snapshots_customer ON tgd_monthly_storage_snapshots(customer_id);
CREATE INDEX IF NOT EXISTS idx_accounting_charge_staging_customer ON tgd_accounting_charge_staging(customer_id);

-- Future placeholder: Triggers to keep tgd_stock_balances in sync with tgd_stock_movements will be added in later sprints.
