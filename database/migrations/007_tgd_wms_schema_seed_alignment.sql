-- 007_tgd_wms_schema_seed_alignment.sql
-- Consolidated staging alignment for TGD WMS schema and seed compatibility.
-- Do NOT execute against production without Controller approval.
-- No privileged server key usage, secret values, destructive data drops, or frontend write enablement.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Columns required by policies, readiness checks, RPC design, and seed data
-- ---------------------------------------------------------------------------

ALTER TABLE IF EXISTS public.tgd_user_profiles
  ADD COLUMN IF NOT EXISTS auth_user_id uuid,
  ADD COLUMN IF NOT EXISTS customer_id uuid,
  ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;

ALTER TABLE IF EXISTS public.tgd_user_profiles
  ALTER COLUMN is_active SET DEFAULT true;

UPDATE public.tgd_user_profiles
SET is_active = true
WHERE is_active IS NULL;

ALTER TABLE IF EXISTS public.tgd_customers
  ADD COLUMN IF NOT EXISTS contact_email text;

ALTER TABLE IF EXISTS public.tgd_products
  ADD COLUMN IF NOT EXISTS name text,
  ADD COLUMN IF NOT EXISTS unit text;

ALTER TABLE IF EXISTS public.tgd_warehouses
  ADD COLUMN IF NOT EXISTS code text;

ALTER TABLE IF EXISTS public.tgd_zones
  ADD COLUMN IF NOT EXISTS code text,
  ADD COLUMN IF NOT EXISTS temperature text;

ALTER TABLE IF EXISTS public.tgd_locations
  ADD COLUMN IF NOT EXISTS code text,
  ADD COLUMN IF NOT EXISTS description text;

ALTER TABLE IF EXISTS public.tgd_lots
  ADD COLUMN IF NOT EXISTS customer_id uuid,
  ADD COLUMN IF NOT EXISTS expiry_date date;

ALTER TABLE IF EXISTS public.tgd_pallets
  ADD COLUMN IF NOT EXISTS customer_id uuid,
  ADD COLUMN IF NOT EXISTS product_id uuid,
  ADD COLUMN IF NOT EXISTS lot_id uuid,
  ADD COLUMN IF NOT EXISTS quantity numeric,
  ADD COLUMN IF NOT EXISTS weight numeric;

ALTER TABLE IF EXISTS public.tgd_putaway_tasks
  ADD COLUMN IF NOT EXISTS customer_id uuid;

ALTER TABLE IF EXISTS public.tgd_allocation_records
  ADD COLUMN IF NOT EXISTS customer_id uuid,
  ADD COLUMN IF NOT EXISTS product_id uuid,
  ADD COLUMN IF NOT EXISTS lot_id uuid,
  ADD COLUMN IF NOT EXISTS location_id uuid;

ALTER TABLE IF EXISTS public.tgd_picking_tasks
  ADD COLUMN IF NOT EXISTS customer_id uuid,
  ADD COLUMN IF NOT EXISTS location_id uuid;

-- Optional compatibility columns referenced by prepared RPC/design files.
-- They are nullable and do not change ledger source-of-truth requirements.
ALTER TABLE IF EXISTS public.tgd_stock_movements
  ADD COLUMN IF NOT EXISTS movement_id uuid,
  ADD COLUMN IF NOT EXISTS pallet_id uuid,
  ADD COLUMN IF NOT EXISTS source_location_id uuid,
  ADD COLUMN IF NOT EXISTS target_location_id uuid,
  ADD COLUMN IF NOT EXISTS reference text,
  ADD COLUMN IF NOT EXISTS created_by uuid,
  ADD COLUMN IF NOT EXISTS occurred_at timestamptz;

UPDATE public.tgd_stock_movements
SET movement_id = id
WHERE movement_id IS NULL;

ALTER TABLE IF EXISTS public.tgd_operation_charges
  ADD COLUMN IF NOT EXISTS description text;

ALTER TABLE IF EXISTS public.tgd_monthly_storage_snapshots
  ADD COLUMN IF NOT EXISTS billing_month date,
  ADD COLUMN IF NOT EXISTS total_charge numeric;

ALTER TABLE IF EXISTS public.tgd_accounting_charge_staging
  ADD COLUMN IF NOT EXISTS billing_month date,
  ADD COLUMN IF NOT EXISTS amount numeric;

-- ---------------------------------------------------------------------------
-- 2. Check constraints aligned to production roles and workflow statuses
-- ---------------------------------------------------------------------------

ALTER TABLE IF EXISTS public.tgd_user_profiles
  DROP CONSTRAINT IF EXISTS tgd_user_profiles_role_check;

ALTER TABLE IF EXISTS public.tgd_user_profiles
  ADD CONSTRAINT tgd_user_profiles_role_check
  CHECK (role IN ('admin','warehouse_manager','warehouse_staff','accounting','viewer'))
  NOT VALID;

ALTER TABLE IF EXISTS public.tgd_stock_movements
  DROP CONSTRAINT IF EXISTS tgd_stock_movements_movement_type_check;

ALTER TABLE IF EXISTS public.tgd_stock_movements
  ADD CONSTRAINT tgd_stock_movements_movement_type_check
  CHECK (
    movement_type IN (
      'RECEIPT',
      'PUTAWAY',
      'TRANSFER',
      'ADJUSTMENT',
      'WITHDRAWAL',
      'DISPATCH',
      'RECEIVE_CONFIRM',
      'PUTAWAY_CONFIRM',
      'TRANSFER_CONFIRM',
      'ADJUSTMENT_CONFIRM',
      'PICK_ALLOCATE',
      'PICK_CONFIRM',
      'DISPATCH_CONFIRM',
      'RECEIVE',
      'PICKING',
      'IN',
      'OUT',
      'MOVE',
      'COUNT',
      'STOCK_COUNT',
      'RETURN',
      'HOLD',
      'RELEASE'
    )
  )
  NOT VALID;

ALTER TABLE IF EXISTS public.tgd_adjustment_lines
  DROP CONSTRAINT IF EXISTS tgd_adjustment_lines_adjustment_type_check;

ALTER TABLE IF EXISTS public.tgd_adjustment_lines
  ADD CONSTRAINT tgd_adjustment_lines_adjustment_type_check
  CHECK (
    adjustment_type IN (
      'INCREASE',
      'DECREASE',
      'IN',
      'OUT',
      'ADD',
      'REMOVE',
      'PLUS',
      'MINUS',
      'ADJUST_IN',
      'ADJUST_OUT',
      'DAMAGE',
      'LOSS',
      'FOUND',
      'DEMO'
    )
  )
  NOT VALID;

DO $$
DECLARE
  r record;
  allowed_statuses text := '''DRAFT'', ''PLANNED'', ''PENDING'', ''OPEN'', ''IN_PROGRESS'', ''ALLOCATED'', ''PICKING'', ''READY'', ''RECEIVED'', ''CONFIRMED'', ''APPROVED'', ''COMPLETED'', ''DONE'', ''DISPATCHED'', ''FULFILLED'', ''SHIPPED'', ''CLOSED'', ''CANCELLED'', ''REJECTED'', ''HOLD'', ''RELEASED''';
BEGIN
  FOR r IN
    SELECT table_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND column_name = 'status'
      AND table_name IN (
        'tgd_receiving_documents',
        'tgd_putaway_tasks',
        'tgd_transfer_documents',
        'tgd_adjustment_documents',
        'tgd_stock_count_sessions',
        'tgd_withdrawal_requests',
        'tgd_picking_tasks',
        'tgd_dispatch_documents'
      )
  LOOP
    EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT IF EXISTS %I', r.table_name, r.table_name || '_status_check');
    EXECUTE format(
      'ALTER TABLE public.%I ADD CONSTRAINT %I CHECK (status IN (%s)) NOT VALID',
      r.table_name,
      r.table_name || '_status_check',
      allowed_statuses
    );
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- 3. Non-destructive FK constraints for new alignment columns
--    NOT VALID avoids failing on pre-existing dirty staging data while checking
--    all future inserted rows, including this sprint seed.
-- ---------------------------------------------------------------------------

DO $$
BEGIN
  IF to_regclass('public.tgd_user_profiles') IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tgd_user_profiles_customer_id_fkey')
  THEN
    ALTER TABLE public.tgd_user_profiles
      ADD CONSTRAINT tgd_user_profiles_customer_id_fkey
      FOREIGN KEY (customer_id) REFERENCES public.tgd_customers(id) NOT VALID;
  END IF;

  IF to_regclass('public.tgd_lots') IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tgd_lots_customer_id_fkey')
  THEN
    ALTER TABLE public.tgd_lots
      ADD CONSTRAINT tgd_lots_customer_id_fkey
      FOREIGN KEY (customer_id) REFERENCES public.tgd_customers(id) NOT VALID;
  END IF;

  IF to_regclass('public.tgd_pallets') IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tgd_pallets_customer_id_fkey')
  THEN
    ALTER TABLE public.tgd_pallets
      ADD CONSTRAINT tgd_pallets_customer_id_fkey
      FOREIGN KEY (customer_id) REFERENCES public.tgd_customers(id) NOT VALID;
  END IF;

  IF to_regclass('public.tgd_pallets') IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tgd_pallets_product_id_fkey')
  THEN
    ALTER TABLE public.tgd_pallets
      ADD CONSTRAINT tgd_pallets_product_id_fkey
      FOREIGN KEY (product_id) REFERENCES public.tgd_products(id) NOT VALID;
  END IF;

  IF to_regclass('public.tgd_pallets') IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tgd_pallets_lot_id_fkey')
  THEN
    ALTER TABLE public.tgd_pallets
      ADD CONSTRAINT tgd_pallets_lot_id_fkey
      FOREIGN KEY (lot_id) REFERENCES public.tgd_lots(id) NOT VALID;
  END IF;

  IF to_regclass('public.tgd_putaway_tasks') IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tgd_putaway_tasks_customer_id_fkey')
  THEN
    ALTER TABLE public.tgd_putaway_tasks
      ADD CONSTRAINT tgd_putaway_tasks_customer_id_fkey
      FOREIGN KEY (customer_id) REFERENCES public.tgd_customers(id) NOT VALID;
  END IF;

  IF to_regclass('public.tgd_allocation_records') IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tgd_allocation_records_customer_id_fkey')
  THEN
    ALTER TABLE public.tgd_allocation_records
      ADD CONSTRAINT tgd_allocation_records_customer_id_fkey
      FOREIGN KEY (customer_id) REFERENCES public.tgd_customers(id) NOT VALID;
  END IF;

  IF to_regclass('public.tgd_picking_tasks') IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tgd_picking_tasks_customer_id_fkey')
  THEN
    ALTER TABLE public.tgd_picking_tasks
      ADD CONSTRAINT tgd_picking_tasks_customer_id_fkey
      FOREIGN KEY (customer_id) REFERENCES public.tgd_customers(id) NOT VALID;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 4. Helpful lookup indexes for newly aligned columns
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_tgd_user_profiles_auth_user_id ON public.tgd_user_profiles(auth_user_id);
CREATE INDEX IF NOT EXISTS idx_tgd_user_profiles_customer_id ON public.tgd_user_profiles(customer_id);
CREATE INDEX IF NOT EXISTS idx_tgd_lots_customer_id ON public.tgd_lots(customer_id);
CREATE INDEX IF NOT EXISTS idx_tgd_pallets_lot_id ON public.tgd_pallets(lot_id);
CREATE INDEX IF NOT EXISTS idx_tgd_putaway_tasks_customer_id ON public.tgd_putaway_tasks(customer_id);
CREATE INDEX IF NOT EXISTS idx_tgd_allocation_records_customer_id ON public.tgd_allocation_records(customer_id);
CREATE INDEX IF NOT EXISTS idx_tgd_picking_tasks_customer_id ON public.tgd_picking_tasks(customer_id);

COMMIT;

-- End of 007_tgd_wms_schema_seed_alignment.sql
