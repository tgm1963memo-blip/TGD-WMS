-- 008_tgd_wms_seed_validation.sql
-- Staging validation for 007 schema alignment + FIXED_FINAL seed.
-- Read-only checks only. Do NOT execute against production without Controller approval.

-- ---------------------------------------------------------------------------
-- 1. Row counts for seeded tables
-- ---------------------------------------------------------------------------

SELECT 'row_count:tgd_customers' AS check_name, count(*)::text AS result FROM public.tgd_customers
UNION ALL SELECT 'row_count:tgd_user_profiles', count(*)::text FROM public.tgd_user_profiles
UNION ALL SELECT 'row_count:tgd_products', count(*)::text FROM public.tgd_products
UNION ALL SELECT 'row_count:tgd_warehouses', count(*)::text FROM public.tgd_warehouses
UNION ALL SELECT 'row_count:tgd_zones', count(*)::text FROM public.tgd_zones
UNION ALL SELECT 'row_count:tgd_locations', count(*)::text FROM public.tgd_locations
UNION ALL SELECT 'row_count:tgd_lots', count(*)::text FROM public.tgd_lots
UNION ALL SELECT 'row_count:tgd_pallets', count(*)::text FROM public.tgd_pallets
UNION ALL SELECT 'row_count:tgd_stock_balances', count(*)::text FROM public.tgd_stock_balances
UNION ALL SELECT 'row_count:tgd_stock_movements', count(*)::text FROM public.tgd_stock_movements
UNION ALL SELECT 'row_count:tgd_receiving_documents', count(*)::text FROM public.tgd_receiving_documents
UNION ALL SELECT 'row_count:tgd_receiving_lines', count(*)::text FROM public.tgd_receiving_lines
UNION ALL SELECT 'row_count:tgd_putaway_tasks', count(*)::text FROM public.tgd_putaway_tasks
UNION ALL SELECT 'row_count:tgd_transfer_documents', count(*)::text FROM public.tgd_transfer_documents
UNION ALL SELECT 'row_count:tgd_transfer_lines', count(*)::text FROM public.tgd_transfer_lines
UNION ALL SELECT 'row_count:tgd_adjustment_documents', count(*)::text FROM public.tgd_adjustment_documents
UNION ALL SELECT 'row_count:tgd_adjustment_lines', count(*)::text FROM public.tgd_adjustment_lines
UNION ALL SELECT 'row_count:tgd_stock_count_sessions', count(*)::text FROM public.tgd_stock_count_sessions
UNION ALL SELECT 'row_count:tgd_stock_count_lines', count(*)::text FROM public.tgd_stock_count_lines
UNION ALL SELECT 'row_count:tgd_withdrawal_requests', count(*)::text FROM public.tgd_withdrawal_requests
UNION ALL SELECT 'row_count:tgd_withdrawal_request_lines', count(*)::text FROM public.tgd_withdrawal_request_lines
UNION ALL SELECT 'row_count:tgd_allocation_records', count(*)::text FROM public.tgd_allocation_records
UNION ALL SELECT 'row_count:tgd_picking_tasks', count(*)::text FROM public.tgd_picking_tasks
UNION ALL SELECT 'row_count:tgd_dispatch_documents', count(*)::text FROM public.tgd_dispatch_documents
UNION ALL SELECT 'row_count:tgd_dispatch_lines', count(*)::text FROM public.tgd_dispatch_lines
UNION ALL SELECT 'row_count:tgd_operation_charges', count(*)::text FROM public.tgd_operation_charges
UNION ALL SELECT 'row_count:tgd_monthly_storage_snapshots', count(*)::text FROM public.tgd_monthly_storage_snapshots
UNION ALL SELECT 'row_count:tgd_accounting_charge_staging', count(*)::text FROM public.tgd_accounting_charge_staging
ORDER BY check_name;

-- ---------------------------------------------------------------------------
-- 2. Orphan FK checks for seeded relationship paths
-- ---------------------------------------------------------------------------

WITH orphan_checks AS (
  SELECT 'orphan:tgd_lots.product_id' AS check_name, count(*) AS failures
  FROM public.tgd_lots l
  LEFT JOIN public.tgd_products p ON p.id = l.product_id
  WHERE p.id IS NULL

  UNION ALL
  SELECT 'orphan:tgd_lots.customer_id', count(*)
  FROM public.tgd_lots l
  LEFT JOIN public.tgd_customers c ON c.id = l.customer_id
  WHERE l.customer_id IS NOT NULL AND c.id IS NULL

  UNION ALL
  SELECT 'orphan:tgd_pallets.location_id', count(*)
  FROM public.tgd_pallets p
  LEFT JOIN public.tgd_locations l ON l.id = p.location_id
  WHERE l.id IS NULL

  UNION ALL
  SELECT 'orphan:tgd_pallets.lot_id', count(*)
  FROM public.tgd_pallets p
  LEFT JOIN public.tgd_lots l ON l.id = p.lot_id
  WHERE p.lot_id IS NOT NULL AND l.id IS NULL

  UNION ALL
  SELECT 'orphan:tgd_stock_movements.customer_product_lot', count(*)
  FROM public.tgd_stock_movements m
  LEFT JOIN public.tgd_customers c ON c.id = m.customer_id
  LEFT JOIN public.tgd_products p ON p.id = m.product_id
  LEFT JOIN public.tgd_lots l ON l.id = m.lot_id
  WHERE c.id IS NULL OR p.id IS NULL OR l.id IS NULL

  UNION ALL
  SELECT 'orphan:tgd_transfer_lines.document_product_lot_locations', count(*)
  FROM public.tgd_transfer_lines tl
  LEFT JOIN public.tgd_transfer_documents td ON td.id = tl.document_id
  LEFT JOIN public.tgd_products p ON p.id = tl.product_id
  LEFT JOIN public.tgd_lots lot ON lot.id = tl.lot_id
  LEFT JOIN public.tgd_locations from_loc ON from_loc.id = tl.from_location_id
  LEFT JOIN public.tgd_locations to_loc ON to_loc.id = tl.to_location_id
  WHERE td.id IS NULL OR p.id IS NULL OR lot.id IS NULL OR from_loc.id IS NULL OR to_loc.id IS NULL

  UNION ALL
  SELECT 'orphan:tgd_accounting_charge_staging.charge_id', count(*)
  FROM public.tgd_accounting_charge_staging acs
  LEFT JOIN public.tgd_operation_charges oc ON oc.id = acs.charge_id
  WHERE oc.id IS NULL
)
SELECT
  check_name,
  CASE WHEN failures = 0 THEN 'PASS' ELSE 'FAIL' END AS status,
  failures
FROM orphan_checks
ORDER BY check_name;

-- ---------------------------------------------------------------------------
-- 3. Required constraints are present
-- ---------------------------------------------------------------------------

WITH required_constraints(conname) AS (
  VALUES
    ('tgd_user_profiles_role_check'),
    ('tgd_stock_movements_movement_type_check'),
    ('tgd_adjustment_lines_adjustment_type_check'),
    ('tgd_receiving_documents_status_check'),
    ('tgd_putaway_tasks_status_check'),
    ('tgd_transfer_documents_status_check'),
    ('tgd_adjustment_documents_status_check'),
    ('tgd_stock_count_sessions_status_check'),
    ('tgd_withdrawal_requests_status_check'),
    ('tgd_picking_tasks_status_check'),
    ('tgd_dispatch_documents_status_check')
)
SELECT
  'constraint:' || rc.conname AS check_name,
  CASE WHEN c.oid IS NOT NULL THEN 'PASS' ELSE 'FAIL' END AS status
FROM required_constraints rc
LEFT JOIN pg_constraint c ON c.conname = rc.conname
ORDER BY check_name;

-- ---------------------------------------------------------------------------
-- 4. Demo users and roles exist
-- ---------------------------------------------------------------------------

WITH expected_users(email, role) AS (
  VALUES
    ('admin.demo@tgd-wms.local', 'admin'),
    ('warehouse.manager.demo@tgd-wms.local', 'warehouse_manager'),
    ('warehouse.staff.demo@tgd-wms.local', 'warehouse_staff'),
    ('accounting.demo@tgd-wms.local', 'accounting'),
    ('viewer.demo@tgd-wms.local', 'viewer')
)
SELECT
  'demo_user:' || eu.email AS check_name,
  CASE WHEN up.id IS NOT NULL AND up.role = eu.role THEN 'PASS' ELSE 'FAIL' END AS status,
  eu.role AS expected_role,
  up.role AS actual_role
FROM expected_users eu
LEFT JOIN public.tgd_user_profiles up ON up.email = eu.email
ORDER BY eu.email;

WITH expected_roles(role) AS (
  VALUES ('admin'), ('warehouse_manager'), ('warehouse_staff'), ('accounting'), ('viewer')
)
SELECT
  'demo_role:' || er.role AS check_name,
  CASE WHEN count(up.id) > 0 THEN 'PASS' ELSE 'FAIL' END AS status,
  count(up.id) AS matching_users
FROM expected_roles er
LEFT JOIN public.tgd_user_profiles up ON up.role = er.role
GROUP BY er.role
ORDER BY er.role;

-- ---------------------------------------------------------------------------
-- 5. Required demo fields are not null or empty
-- ---------------------------------------------------------------------------

WITH required_field_checks AS (
  SELECT 'required:tgd_pallets.identifier' AS check_name, count(*) AS failures
  FROM public.tgd_pallets
  WHERE identifier IS NULL OR btrim(identifier) = ''

  UNION ALL
  SELECT 'required:tgd_zones.name', count(*)
  FROM public.tgd_zones
  WHERE name IS NULL OR btrim(name) = ''

  UNION ALL
  SELECT 'required:tgd_locations.name', count(*)
  FROM public.tgd_locations
  WHERE name IS NULL OR btrim(name) = ''

  UNION ALL
  SELECT 'required:tgd_products.name', count(*)
  FROM public.tgd_products
  WHERE name IS NULL OR btrim(name) = ''

  UNION ALL
  SELECT 'required:tgd_products.unit', count(*)
  FROM public.tgd_products
  WHERE unit IS NULL OR btrim(unit) = ''
)
SELECT
  check_name,
  CASE WHEN failures = 0 THEN 'PASS' ELSE 'FAIL' END AS status,
  failures
FROM required_field_checks
ORDER BY check_name;

-- Expected validation result after 007 + FIXED_FINAL seed:
--   - All orphan checks PASS with 0 failures.
--   - All required constraints PASS.
--   - All demo users and demo roles PASS.
--   - Required demo fields PASS with 0 failures.
