-- 003_tgd_wms_seed_data_foundation.sql
-- Seed data foundation for TGD WMS (demo only). DO NOT execute against production.
-- This SQL file contains INSERT statements for demo users, customers, products, warehouses, zones, locations, lots, pallets, stock balances, movement ledger, operational documents, and accounting charge data.

-- ------------------------------------------------------------
-- 1. User profiles (demo)
-- ------------------------------------------------------------
INSERT INTO tgd_user_profiles (id, auth_user_id, email, role, customer_id, is_active) VALUES
  ('11111111-1111-1111-1111-111111111111', 'auth-admin-uuid', 'admin.demo@tgd-wms.local', 'admin', NULL, true),
  ('22222222-2222-2222-2222-222222222222', 'auth-manager-uuid', 'manager.demo@tgd-wms.local', 'warehouse_manager', NULL, true),
  ('33333333-3333-3333-3333-333333333333', 'auth-staff-uuid', 'staff.demo@tgd-wms.local', 'warehouse_staff', NULL, true),
  ('44444444-4444-4444-4444-444444444444', 'auth-accounting-uuid', 'accounting.demo@tgd-wms.local', 'accounting', NULL, true),
  ('55555555-5555-5555-5555-555555555555', 'auth-viewer-uuid', 'viewer.demo@tgd-wms.local', 'viewer', NULL, true);

-- ------------------------------------------------------------
-- 2. Customers (demo)
-- ------------------------------------------------------------
INSERT INTO tgd_customers (id, name, contact_email) VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Demo Customer Alpha', 'alpha@example.com'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Demo Customer Beta',  'beta@example.com'),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'Demo Customer Gamma', 'gamma@example.com');

-- ------------------------------------------------------------
-- 3. Products (demo)
-- ------------------------------------------------------------
INSERT INTO tgd_products (id, name, sku, unit) VALUES
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'Frozen Shrimp', 'FS-001', 'kg'),
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'Frozen Fish',   'FF-001', 'kg'),
  ('ffffffffff-ffff-ffff-ffff-ffffffffffff', 'Frozen Chicken','FC-001','kg'),
  ('11111111-2222-3333-4444-555555555555', 'Chilled Sausage','CS-001','kg'),
  ('66666666-7777-8888-9999-aaaaaaaaaaaa', 'Frozen Processed Food','FPF-001','kg');

-- ------------------------------------------------------------
-- 4. Warehouses / Zones / Locations (demo)
-- ------------------------------------------------------------
INSERT INTO tgd_warehouses (id, code, name) VALUES
  ('77777777-7777-7777-7777-777777777777', 'WH-COLD-01', 'Cold Storage Warehouse 01');

INSERT INTO tgd_zones (id, warehouse_id, code, temperature) VALUES
  ('88888888-8888-8888-8888-888888888888', '77777777-7777-7777-7777-777777777777', 'FROZEN-ZONE', -18),
  ('99999999-9999-9999-9999-999999999999', '77777777-7777-7777-7777-777777777777', 'CHILLED-ZONE', 4);

INSERT INTO tgd_locations (id, zone_id, code, description) VALUES
  ('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee', '88888888-8888-8888-8888-888888888888', 'FZ-A-01-01', 'Frozen Zone A Shelf 1'),
  ('bbbbbbbb-bbbb-cccc-dddd-eeeeeeeeeeee', '88888888-8888-8888-8888-888888888888', 'FZ-A-01-02', 'Frozen Zone A Shelf 2'),
  ('cccccccc-bbbb-cccc-dddd-eeeeeeeeeeee', '88888888-8888-8888-8888-888888888888', 'FZ-B-01-01', 'Frozen Zone B Shelf 1'),
  ('dddddddd-bbbb-cccc-dddd-eeeeeeeeeeee', '99999999-9999-9999-9999-999999999999', 'CH-A-01-01', 'Chilled Zone A Shelf 1'),
  ('eeeeeeee-bbbb-cccc-dddd-eeeeeeeeeeee', '99999999-9999-9999-9999-999999999999', 'CH-A-01-02', 'Chilled Zone A Shelf 2'),
  ('ffffffff-bbbb-cccc-dddd-eeeeeeeeeeee', '99999999-9999-9999-9999-999999999999', 'QC-HOLD-01', 'Quality Control Hold Area');

-- ------------------------------------------------------------
-- 5. Lots and Pallets (demo)
-- ------------------------------------------------------------
INSERT INTO tgd_lots (id, product_id, customer_id, lot_number, expiry_date) VALUES
  ('11111111-1111-2222-3333-444444444444', 'dddddddd-dddd-dddd-dddd-dddddddddddd', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'LOT-SHRIMP-001', '2025-12-31'),
  ('22222222-1111-2222-3333-444444444444', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'LOT-FISH-001',   '2025-11-30');

INSERT INTO tgd_pallets (id, lot_id, location_id, quantity) VALUES
  ('33333333-1111-2222-3333-444444444444', '11111111-1111-2222-3333-444444444444', 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee', 1000),
  ('44444444-1111-2222-3333-444444444444', '22222222-1111-2222-3333-444444444444', 'bbbbbbbb-bbbb-cccc-dddd-eeeeeeeeeeee', 800);

-- ------------------------------------------------------------
-- 6. Stock balances (demo) – source of truth for quantity per customer/product
-- ------------------------------------------------------------
INSERT INTO tgd_stock_balances (id, product_id, customer_id, quantity) VALUES
  ('55555555-1111-2222-3333-444444444444', 'dddddddd-dddd-dddd-dddd-dddddddddddd', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 1500), -- Alpha shrimp
  ('66666666-1111-2222-3333-444444444444', 'dddddddd-dddd-dddd-dddd-dddddddddddd', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 500),  -- Beta shrimp
  ('77777777-1111-2222-3333-444444444444', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 1200), -- Alpha fish
  ('88888888-1111-2222-3333-444444444444', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'cccccccc-cccc-cccc-cccc-cccccccccccc', 800);  -- Gamma fish

-- ------------------------------------------------------------
-- 7. Movement ledger (demo) – must NOT be edited directly by frontend
-- ------------------------------------------------------------
-- NOTE: Frontend must never update tgd_stock_balances directly; movements are source of truth.
INSERT INTO tgd_stock_movements (id, movement_type, product_id, customer_id, lot_id, pallet_id, quantity, occurred_at) VALUES
  ('99999999-1111-2222-3333-444444444444', 'RECEIVE_CONFIRM',  'dddddddd-dddd-dddd-dddd-dddddddddddd', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-2222-3333-444444444444', NULL, 1000, now()),
  ('aaaaaaaa-1111-2222-3333-444444444444', 'PUTAWAY_CONFIRM',  'dddddddd-dddd-dddd-dddd-dddddddddddd', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-2222-3333-444444444444', '33333333-1111-2222-3333-444444444444', 1000, now()),
  ('bbbbbbbb-1111-2222-3333-444444444444', 'TRANSFER_CONFIRM',  'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '22222222-1111-2222-3333-444444444444', NULL, 800, now()),
  ('cccccccc-1111-2222-3333-444444444444', 'ADJUSTMENT_CONFIRM','eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', NULL, NULL, -100, now()),
  ('dddddddd-1111-2222-3333-444444444444', 'PICK_ALLOCATE',    'dddddddd-dddd-dddd-dddd-dddddddddddd', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', NULL, NULL, 200, now()),
  ('eeeeeeee-1111-2222-3333-444444444444', 'PICK_CONFIRM',    'dddddddd-dddd-dddd-dddd-dddddddddddd', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', NULL, NULL, 200, now()),
  ('ffffffff-1111-2222-3333-444444444444', 'DISPATCH_CONFIRM','dddddddd-dddd-dddd-dddd-dddddddddddd', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', NULL, NULL, 200, now());

-- ------------------------------------------------------------
-- 8. Operational documents (minimal rows) – receiving, putaway, transfer, adjustment, stock count, withdrawal, allocation, picking, dispatch
-- ------------------------------------------------------------
INSERT INTO tgd_receiving_documents (id, warehouse_id, received_at) VALUES
  ('11111111-aaaa-bbbb-cccc-dddddddddddd', '77777777-7777-7777-7777-777777777777', now());
INSERT INTO tgd_receiving_lines (id, document_id, product_id, quantity) VALUES
  ('22222222-aaaa-bbbb-cccc-dddddddddddd', '11111111-aaaa-bbbb-cccc-dddddddddddd', 'dddddddd-dddd-dddd-dddd-dddddddddddd', 1000);

INSERT INTO tgd_putaway_tasks (id, location_id, scheduled_at) VALUES
  ('33333333-aaaa-bbbb-cccc-dddddddddddd', 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee', now());
INSERT INTO tgd_putaway_lines (id, task_id, pallet_id, quantity) VALUES
  ('44444444-aaaa-bbbb-cccc-dddddddddddd', '33333333-aaaa-bbbb-cccc-dddddddddddd', '33333333-1111-2222-3333-444444444444', 1000);

INSERT INTO tgd_transfer_documents (id, source_warehouse_id, target_warehouse_id, transferred_at) VALUES
  ('55555555-aaaa-bbbb-cccc-dddddddddddd', '77777777-7777-7777-7777-777777777777', '77777777-7777-7777-7777-777777777777', now());
INSERT INTO tgd_transfer_lines (id, document_id, product_id, quantity) VALUES
  ('66666666-aaaa-bbbb-cccc-dddddddddddd', '55555555-aaaa-bbbb-cccc-dddddddddddd', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 800);

INSERT INTO tgd_adjustment_documents (id, reason, created_at) VALUES
  ('77777777-aaaa-bbbb-cccc-dddddddddddd', 'Damage adjustment', now());
INSERT INTO tgd_adjustment_lines (id, document_id, product_id, quantity) VALUES
  ('88888888-aaaa-bbbb-cccc-dddddddddddd', '77777777-aaaa-bbbb-cccc-dddddddddddd', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', -100);

INSERT INTO tgd_stock_count_sessions (id, counted_at) VALUES
  ('99999999-aaaa-bbbb-cccc-dddddddddddd', now());
INSERT INTO tgd_stock_count_lines (id, session_id, product_id, counted_quantity) VALUES
  ('aaaaaaaa-aaaa-bbbb-cccc-dddddddddddd', '99999999-aaaa-bbbb-cccc-dddddddddddd', 'dddddddd-dddd-dddd-dddd-dddddddddddd', 1300);

INSERT INTO tgd_withdrawal_requests (id, customer_id, requested_at) VALUES
  ('bbbbbbbb-aaaa-bbbb-cccc-dddddddddddd', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', now());
INSERT INTO tgd_withdrawal_request_lines (id, request_id, product_id, quantity) VALUES
  ('cccccccc-aaaa-bbbb-cccc-dddddddddddd', 'bbbbbbbb-aaaa-bbbb-cccc-dddddddddddd', 'dddddddd-dddd-dddd-dddd-dddddddddddd', 200);

INSERT INTO tgd_allocation_records (id, order_id, product_id, allocated_quantity) VALUES
  ('dddddddd-aaaa-bbbb-cccc-dddddddddddd', 'order-001', 'dddddddd-dddd-dddd-dddd-dddddddddddd', 200);

INSERT INTO tgd_picking_tasks (id, location_id, scheduled_at) VALUES
  ('eeeeeeee-aaaa-bbbb-cccc-dddddddddddd', 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee', now());
INSERT INTO tgd_picking_lines (id, task_id, product_id, quantity) VALUES
  ('ffffffff-aaaa-bbbb-cccc-dddddddddddd', 'eeeeeeee-aaaa-bbbb-cccc-dddddddddddd', 'dddddddd-dddd-dddd-dddd-dddddddddddd', 200);

INSERT INTO tgd_dispatch_documents (id, dispatched_at) VALUES
  ('11111111-bbbb-cccc-dddd-eeeeeeeeeeee', now());
INSERT INTO tgd_dispatch_lines (id, document_id, product_id, quantity) VALUES
  ('22222222-bbbb-cccc-dddd-eeeeeeeeeeee', '11111111-bbbb-cccc-dddd-eeeeeeeeeeee', 'dddddddd-dddd-dddd-dddd-dddddddddddd', 200);

-- ------------------------------------------------------------
-- 9. Accounting charge test data (preview only)
-- ------------------------------------------------------------
INSERT INTO tgd_operation_charges (id, description, amount, customer_id, created_at) VALUES
  ('33333333-bbbb-cccc-dddd-eeeeeeeeeeee', 'Cold storage fee Jan', 1500, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', now());

INSERT INTO tgd_monthly_storage_snapshots (id, month, total_charge, customer_id) VALUES
  ('44444444-bbbb-cccc-dddd-eeeeeeeeeeee', '2025-01', 1500, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');

INSERT INTO tgd_accounting_charge_staging (id, month, projected_charge, customer_id) VALUES
  ('55555555-bbbb-cccc-dddd-eeeeeeeeeeee', '2025-02', 1600, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');

-- End of 003_tgd_wms_seed_data_foundation.sql
