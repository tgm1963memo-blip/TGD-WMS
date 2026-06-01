-- 003_tgd_wms_seed_data_foundation_FIXED_FINAL.sql
-- Explicit FK-safe demo seed for TGD WMS staging.
-- Requires 001_tgd_wms_schema_foundation.sql and 007_tgd_wms_schema_seed_alignment.sql.
-- Do NOT execute against production.
-- No privileged server key usage, secret values, frontend write enablement, or helper functions.
-- Frontend must never update tgd_stock_balances directly.

BEGIN;

-- ---------------------------------------------------------------------------
-- Stable demo UUID map
-- ---------------------------------------------------------------------------
-- Customers
--   aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1 Alpha
--   aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2 Beta
--   aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3 Gamma
-- Products
--   bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1 Frozen Shrimp
--   bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2 Frozen Fish
--   bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb3 Frozen Chicken
--   bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb4 Chilled Sausage
--   bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb5 Frozen Processed Food
-- Warehouse / zones / locations
--   cccccccc-cccc-4ccc-8ccc-ccccccccccc1 Warehouse
--   dddddddd-dddd-4ddd-8ddd-ddddddddddd1 Frozen zone
--   dddddddd-dddd-4ddd-8ddd-ddddddddddd2 Chilled zone
-- Lots / pallets
--   ffffffff-ffff-4fff-8fff-fffffffffff1 Shrimp lot
--   ffffffff-ffff-4fff-8fff-fffffffffff2 Fish lot

-- ---------------------------------------------------------------------------
-- 1. Demo customers
-- ---------------------------------------------------------------------------

INSERT INTO public.tgd_customers (id, name, contact_email)
VALUES
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', 'Demo Customer Alpha', 'alpha.demo@tgd-wms.local'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2', 'Demo Customer Beta', 'beta.demo@tgd-wms.local'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3', 'Demo Customer Gamma', 'gamma.demo@tgd-wms.local')
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- 2. Demo user profiles
-- ---------------------------------------------------------------------------

INSERT INTO public.tgd_user_profiles (id, auth_user_id, email, role, customer_id, is_active)
VALUES
  ('11111111-1111-4111-8111-111111111111', '00000000-0000-4000-8000-000000000001', 'admin.demo@tgd-wms.local', 'admin', NULL, true),
  ('22222222-2222-4222-8222-222222222222', '00000000-0000-4000-8000-000000000002', 'warehouse.manager.demo@tgd-wms.local', 'warehouse_manager', NULL, true),
  ('33333333-3333-4333-8333-333333333333', '00000000-0000-4000-8000-000000000003', 'warehouse.staff.demo@tgd-wms.local', 'warehouse_staff', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', true),
  ('44444444-4444-4444-8444-444444444444', '00000000-0000-4000-8000-000000000004', 'accounting.demo@tgd-wms.local', 'accounting', NULL, true),
  ('55555555-5555-4555-8555-555555555555', '00000000-0000-4000-8000-000000000005', 'viewer.demo@tgd-wms.local', 'viewer', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2', true)
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- 3. Demo products
-- ---------------------------------------------------------------------------

INSERT INTO public.tgd_products (id, sku, name, description, unit)
VALUES
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1', 'FSHR-001', 'Frozen Shrimp', 'Frozen shrimp demo product', 'kg'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2', 'FFSH-001', 'Frozen Fish', 'Frozen fish demo product', 'kg'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb3', 'FCHK-001', 'Frozen Chicken', 'Frozen chicken demo product', 'kg'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb4', 'CSAU-001', 'Chilled Sausage', 'Chilled sausage demo product', 'kg'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb5', 'FPFD-001', 'Frozen Processed Food', 'Frozen processed food demo product', 'kg')
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- 4. Demo warehouse, zones, and locations
-- ---------------------------------------------------------------------------

INSERT INTO public.tgd_warehouses (id, code, name)
VALUES
  ('cccccccc-cccc-4ccc-8ccc-ccccccccccc1', 'WH-COLD-01', 'TGM Cold Storage Warehouse 01')
ON CONFLICT DO NOTHING;

INSERT INTO public.tgd_zones (id, warehouse_id, code, name, temperature)
VALUES
  ('dddddddd-dddd-4ddd-8ddd-ddddddddddd1', 'cccccccc-cccc-4ccc-8ccc-ccccccccccc1', 'FROZEN-ZONE', 'Frozen Zone -18C', '-18C'),
  ('dddddddd-dddd-4ddd-8ddd-ddddddddddd2', 'cccccccc-cccc-4ccc-8ccc-ccccccccccc1', 'CHILLED-ZONE', 'Chilled Zone 4C', '4C')
ON CONFLICT DO NOTHING;

INSERT INTO public.tgd_locations (id, zone_id, code, name, description)
VALUES
  ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1', 'dddddddd-dddd-4ddd-8ddd-ddddddddddd1', 'FZ-A-01-01', 'FZ-A-01-01', 'Frozen rack A level 1'),
  ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee2', 'dddddddd-dddd-4ddd-8ddd-ddddddddddd1', 'FZ-A-01-02', 'FZ-A-01-02', 'Frozen rack A level 2'),
  ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee3', 'dddddddd-dddd-4ddd-8ddd-ddddddddddd2', 'CH-A-01-01', 'CH-A-01-01', 'Chilled rack A level 1'),
  ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee4', 'dddddddd-dddd-4ddd-8ddd-ddddddddddd1', 'QC-HOLD-01', 'QC-HOLD-01', 'Quality hold location')
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- 5. Demo lots and pallets
-- ---------------------------------------------------------------------------

INSERT INTO public.tgd_lots (id, product_id, customer_id, lot_number, expiry_date)
VALUES
  ('ffffffff-ffff-4fff-8fff-fffffffffff1', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', 'LOT-SHRIMP-2026-001', '2026-12-31'),
  ('ffffffff-ffff-4fff-8fff-fffffffffff2', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2', 'LOT-FISH-2026-001', '2026-11-30'),
  ('ffffffff-ffff-4fff-8fff-fffffffffff3', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb3', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', 'LOT-CHICKEN-2026-001', '2026-10-31')
ON CONFLICT DO NOTHING;

INSERT INTO public.tgd_pallets (id, location_id, identifier, customer_id, product_id, lot_id, quantity, weight)
VALUES
  ('12121212-1212-4121-8121-121212121211', 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1', 'PLT-TGM-0001', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1', 'ffffffff-ffff-4fff-8fff-fffffffffff1', 1000, 1000),
  ('12121212-1212-4121-8121-121212121212', 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee2', 'PLT-TGM-0002', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2', 'ffffffff-ffff-4fff-8fff-fffffffffff2', 800, 800),
  ('12121212-1212-4121-8121-121212121213', 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee3', 'PLT-TGM-0003', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb3', 'ffffffff-ffff-4fff-8fff-fffffffffff3', 500, 500)
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- 6. Stock balances and movement ledger
-- ---------------------------------------------------------------------------

INSERT INTO public.tgd_stock_balances (id, customer_id, product_id, lot_id, location_id, quantity, weight)
VALUES
  ('13131313-1313-4131-8131-131313131311', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1', 'ffffffff-ffff-4fff-8fff-fffffffffff1', 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1', 1000, 1000),
  ('13131313-1313-4131-8131-131313131312', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2', 'ffffffff-ffff-4fff-8fff-fffffffffff2', 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee2', 800, 800),
  ('13131313-1313-4131-8131-131313131313', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb3', 'ffffffff-ffff-4fff-8fff-fffffffffff3', 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee3', 500, 500)
ON CONFLICT DO NOTHING;

INSERT INTO public.tgd_stock_movements (
  id,
  movement_id,
  customer_id,
  product_id,
  lot_id,
  pallet_id,
  from_location_id,
  to_location_id,
  source_location_id,
  target_location_id,
  quantity,
  weight,
  movement_type,
  movement_date,
  occurred_at,
  reference,
  created_by
)
VALUES
  (
    '14141414-1414-4141-8141-141414141411',
    '14141414-1414-4141-8141-141414141411',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1',
    'ffffffff-ffff-4fff-8fff-fffffffffff1',
    '12121212-1212-4121-8121-121212121211',
    NULL,
    'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1',
    NULL,
    'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1',
    1000,
    1000,
    'RECEIVE_CONFIRM',
    now(),
    now(),
    'RCV-DEMO-001',
    '33333333-3333-4333-8333-333333333333'
  ),
  (
    '14141414-1414-4141-8141-141414141417',
    '14141414-1414-4141-8141-141414141417',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1',
    'ffffffff-ffff-4fff-8fff-fffffffffff1',
    '12121212-1212-4121-8121-121212121211',
    NULL,
    'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1',
    NULL,
    'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1',
    1000,
    1000,
    'PUTAWAY_CONFIRM',
    now(),
    now(),
    'PTW-DEMO-001',
    '33333333-3333-4333-8333-333333333333'
  ),
  (
    '14141414-1414-4141-8141-141414141412',
    '14141414-1414-4141-8141-141414141412',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1',
    'ffffffff-ffff-4fff-8fff-fffffffffff1',
    '12121212-1212-4121-8121-121212121211',
    'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1',
    'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee2',
    'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1',
    'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee2',
    200,
    200,
    'TRANSFER_CONFIRM',
    now(),
    now(),
    'TRF-DEMO-001',
    '33333333-3333-4333-8333-333333333333'
  ),
  (
    '14141414-1414-4141-8141-141414141413',
    '14141414-1414-4141-8141-141414141413',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1',
    'ffffffff-ffff-4fff-8fff-fffffffffff1',
    '12121212-1212-4121-8121-121212121211',
    'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1',
    NULL,
    'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1',
    NULL,
    -25,
    -25,
    'ADJUSTMENT_CONFIRM',
    now(),
    now(),
    'ADJ-DEMO-001',
    '33333333-3333-4333-8333-333333333333'
  ),
  (
    '14141414-1414-4141-8141-141414141414',
    '14141414-1414-4141-8141-141414141414',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1',
    'ffffffff-ffff-4fff-8fff-fffffffffff1',
    '12121212-1212-4121-8121-121212121211',
    'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1',
    NULL,
    'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1',
    NULL,
    100,
    100,
    'PICK_ALLOCATE',
    now(),
    now(),
    'WDR-DEMO-001',
    '33333333-3333-4333-8333-333333333333'
  ),
  (
    '14141414-1414-4141-8141-141414141415',
    '14141414-1414-4141-8141-141414141415',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1',
    'ffffffff-ffff-4fff-8fff-fffffffffff1',
    '12121212-1212-4121-8121-121212121211',
    'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1',
    NULL,
    'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1',
    NULL,
    100,
    100,
    'PICK_CONFIRM',
    now(),
    now(),
    'PICK-DEMO-001',
    '33333333-3333-4333-8333-333333333333'
  ),
  (
    '14141414-1414-4141-8141-141414141416',
    '14141414-1414-4141-8141-141414141416',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1',
    'ffffffff-ffff-4fff-8fff-fffffffffff1',
    '12121212-1212-4121-8121-121212121211',
    'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1',
    NULL,
    'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1',
    NULL,
    100,
    100,
    'DISPATCH_CONFIRM',
    now(),
    now(),
    'DSP-DEMO-001',
    '33333333-3333-4333-8333-333333333333'
  )
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- 7. Inbound and putaway demo documents
-- ---------------------------------------------------------------------------

INSERT INTO public.tgd_receiving_documents (id, customer_id, document_no, status)
VALUES
  ('15151515-1515-4151-8151-151515151511', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', 'RCV-DEMO-001', 'OPEN')
ON CONFLICT DO NOTHING;

INSERT INTO public.tgd_receiving_lines (id, document_id, product_id, lot_id, quantity, weight)
VALUES
  ('15151515-1515-4151-8151-151515151512', '15151515-1515-4151-8151-151515151511', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1', 'ffffffff-ffff-4fff-8fff-fffffffffff1', 1000, 1000)
ON CONFLICT DO NOTHING;

INSERT INTO public.tgd_putaway_tasks (id, customer_id, receiving_line_id, target_location_id, status)
VALUES
  ('15151515-1515-4151-8151-151515151513', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', '15151515-1515-4151-8151-151515151512', 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1', 'PENDING')
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- 8. Transfer and adjustment demo documents
-- ---------------------------------------------------------------------------

INSERT INTO public.tgd_transfer_documents (id, customer_id, document_no, status)
VALUES
  ('16161616-1616-4161-8161-161616161611', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', 'TRF-DEMO-001', 'OPEN')
ON CONFLICT DO NOTHING;

INSERT INTO public.tgd_transfer_lines (id, document_id, product_id, lot_id, from_location_id, to_location_id, quantity, weight)
VALUES
  ('16161616-1616-4161-8161-161616161612', '16161616-1616-4161-8161-161616161611', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1', 'ffffffff-ffff-4fff-8fff-fffffffffff1', 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1', 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee2', 200, 200)
ON CONFLICT DO NOTHING;

INSERT INTO public.tgd_adjustment_documents (id, customer_id, document_no, reason, status)
VALUES
  ('17171717-1717-4171-8171-171717171711', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', 'ADJ-DEMO-001', 'Demo damage adjustment', 'OPEN')
ON CONFLICT DO NOTHING;

INSERT INTO public.tgd_adjustment_lines (id, document_id, product_id, lot_id, location_id, quantity, weight, adjustment_type)
VALUES
  ('17171717-1717-4171-8171-171717171712', '17171717-1717-4171-8171-171717171711', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1', 'ffffffff-ffff-4fff-8fff-fffffffffff1', 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1', -25, -25, 'OUT')
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- 9. Stock count demo documents
-- ---------------------------------------------------------------------------

INSERT INTO public.tgd_stock_count_sessions (id, customer_id, session_date, status)
VALUES
  ('18181818-1818-4181-8181-181818181811', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', '2026-01-31', 'PLANNED')
ON CONFLICT DO NOTHING;

INSERT INTO public.tgd_stock_count_lines (id, session_id, product_id, lot_id, location_id, counted_quantity, counted_weight)
VALUES
  ('18181818-1818-4181-8181-181818181812', '18181818-1818-4181-8181-181818181811', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1', 'ffffffff-ffff-4fff-8fff-fffffffffff1', 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1', 975, 975)
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- 10. Withdrawal, allocation, picking, and dispatch demo documents
-- ---------------------------------------------------------------------------

INSERT INTO public.tgd_withdrawal_requests (id, customer_id, request_no, status, requested_at)
VALUES
  ('19191919-1919-4191-8191-191919191911', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', 'WDR-DEMO-001', 'APPROVED', now())
ON CONFLICT DO NOTHING;

INSERT INTO public.tgd_withdrawal_request_lines (id, request_id, product_id, lot_id, quantity, weight)
VALUES
  ('19191919-1919-4191-8191-191919191912', '19191919-1919-4191-8191-191919191911', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1', 'ffffffff-ffff-4fff-8fff-fffffffffff1', 100, 100)
ON CONFLICT DO NOTHING;

INSERT INTO public.tgd_allocation_records (id, customer_id, withdrawal_line_id, product_id, lot_id, location_id, allocated_quantity, allocated_at)
VALUES
  ('20202020-2020-4202-8202-202020202011', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', '19191919-1919-4191-8191-191919191912', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1', 'ffffffff-ffff-4fff-8fff-fffffffffff1', 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1', 100, now())
ON CONFLICT DO NOTHING;

INSERT INTO public.tgd_picking_tasks (id, customer_id, allocation_id, picker_user_id, location_id, status)
VALUES
  ('21212121-2121-4212-8212-212121212111', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', '20202020-2020-4202-8202-202020202011', '33333333-3333-4333-8333-333333333333', 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1', 'PENDING')
ON CONFLICT DO NOTHING;

INSERT INTO public.tgd_dispatch_documents (id, customer_id, document_no, status, dispatched_at)
VALUES
  ('22222222-2222-4222-8222-222222222211', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', 'DSP-DEMO-001', 'OPEN', now())
ON CONFLICT DO NOTHING;

INSERT INTO public.tgd_dispatch_lines (id, document_id, product_id, lot_id, quantity, weight)
VALUES
  ('22222222-2222-4222-8222-222222222212', '22222222-2222-4222-8222-222222222211', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1', 'ffffffff-ffff-4fff-8fff-fffffffffff1', 100, 100)
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- 11. Operation charges, monthly storage snapshot, accounting staging
-- ---------------------------------------------------------------------------

INSERT INTO public.tgd_operation_charges (id, customer_id, charge_type, description, amount, charge_date)
VALUES
  ('23232323-2323-4232-8232-232323232311', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', 'STORAGE', 'January cold storage fee', 1500, '2026-01-31'),
  ('23232323-2323-4232-8232-232323232312', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', 'HANDLING', 'January handling fee', 350, '2026-01-31')
ON CONFLICT DO NOTHING;

INSERT INTO public.tgd_monthly_storage_snapshots (id, customer_id, snapshot_month, billing_month, total_quantity, total_weight, total_charge)
VALUES
  ('24242424-2424-4242-8242-242424242411', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', '2026-01-01', '2026-01-01', 1475, 1475, 1500)
ON CONFLICT DO NOTHING;

INSERT INTO public.tgd_accounting_charge_staging (id, customer_id, charge_id, billing_month, amount, posted)
VALUES
  ('25252525-2525-4252-8252-252525252511', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', '23232323-2323-4232-8232-232323232311', '2026-01-01', 1500, false),
  ('25252525-2525-4252-8252-252525252512', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', '23232323-2323-4232-8232-232323232312', '2026-01-01', 350, false)
ON CONFLICT DO NOTHING;

COMMIT;

-- End of 003_tgd_wms_seed_data_foundation_FIXED_FINAL.sql
