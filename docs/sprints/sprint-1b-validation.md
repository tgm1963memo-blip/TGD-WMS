# Sprint 1B Validation Report: Inventory Movement Ledger & Stock Balance Engine

- **Project Name:** TGD WMS
- **Working Folder:** `C:\Users\TSS\OneDrive\เดสก์ท็อป\TGD Coldstorage\TGD WMS`
- **QA Validator:** Google Antigravity
- **Validation Date:** 2026-05-26

---

## Summary

This validation report evaluates the implementation of **Sprint 1B (Movement Ledger + Stock Balance Engine)** for the **TGD WMS** project. The core focus of Sprint 1B is the development of an immutable inventory movement ledger (`tgd_inventory_movements`), a derived real-time stock snapshot system (`tgd_stock_balances`), transaction-secure Posting PL/pgSQL database logic (`tgd_post_inventory_movement`), and React-Vite environment stubs, keeping UI layers and third-party document systems out of scope.

Following comprehensive audits of the SQL migration scripts, database logic, JavaScript services, unit test files, and production bundle generation, the Sprint 1B implementation is verified to have **successfully passed** all checks. The ledger engine features perfect transaction boundaries, rigorous safety checks (such as write-guard triggers and double-allocation blocks), and robust customer-isolated tracking, laying a world-class backend foundation for cold storage tracking.

---

## File Existence Status

We inspected the workspace to confirm the presence of all required files for Sprint 1B:

- **`database/migrations/002_inventory_movement_engine.sql`** -> **PASS** (19.5 kB, contains full DDL SQL schema setup, triggers, and posting function)
- **`database/docs/inventory-movement-engine.md`** -> **PASS** (3.3 kB, houses posting logic details and engine constraints)
- **`docs/sprints/sprint-1b-implementation-notes.md`** -> **PASS** (1.8 kB, describes tables, boundaries, and relocation safety)
- **`src/constants/movementTypes.js`** -> **PASS** (765 B, houses Javascript central movement type dictionaries)
- **`src/services/inventoryMovementService.js`** -> **PASS** (1.8 kB, provides Supabase client query stubs and RPC wrappers)
- **`tests/unit/inventory-movement-schema.test.js`** -> **PASS** (3.4 kB, contains unit tests for Sprint 1B schema constraints)

- **Status:** **PASS**
  - *Observation:* All required migration, documentation, services, constants, and unit testing files are successfully created and populated.

---

## Migration Design Status

The database DDL migration `002_inventory_movement_engine.sql` was audited for architectural compliance:

### 1. Table Definitions
The migration successfully defines the two core engine tables:
- `tgd_inventory_movements` (Immutable historic audit ledger)
- `tgd_stock_balances` (Derived snapshot table for high-speed queries)

### 2. Indexes
Performance indexing is applied correctly to enable fast warehouse searches:
- `tgd_inventory_movements` -> indexed on `movement_no`, `movement_type`, composite `(customer_id, product_id)`, `created_at`, and reference composites.
- `tgd_stock_balances` -> indexed on composite `(customer_id, product_id)`, composite `(customer_id, product_id, lot_id)`, `location_id`, `pallet_id`, and `qty_available`.

### 3. Nullable Lot/Pallet Unique Strategy
To solve PostgreSQL unique constraint behavior (which treats multiple `NULL` values as distinct), a composite coalesced unique expression index is registered on `tgd_stock_balances`:
```sql
create unique index if not exists tgd_stock_balances_identity_unique_idx
  on tgd_stock_balances (
    customer_id,
    product_id,
    coalesce(lot_id, '00000000-0000-0000-0000-000000000000'::uuid),
    warehouse_id,
    location_id,
    coalesce(pallet_id, '00000000-0000-0000-0000-000000000000'::uuid)
  );
```
This elegantly guarantees that a unique inventory slot is represented by a single row, even when `lot_id` or `pallet_id` is null.

- **Status:** **PASS**

---

## Movement Type Status

The check constraint `tgd_inventory_movements_type_check` successfully enforces the exact 10 standard movement types:
- **`OPENING_BALANCE`** (Initial stock balance input)
- **`RECEIVE`** (Inbound warehouse receipt)
- **`PUTAWAY`** (Location placement from receiving bay)
- **`TRANSFER`** (Internal movement between zones/locations)
- **`ADJUST_IN`** (Stock adjustment increase)
- **`ADJUST_OUT`** (Stock adjustment decrease)
- **`PICK_ALLOCATE`** (Stock allocation holding)
- **`PICK_CONFIRM`** (Stock depletion dispatch)
- **`RETURN_IN`** (Customer return placement)
- **`REVERSE`** (Full ledger transaction reversal)

- **Status:** **PASS**

---

## Stock Balance Safety Status

We validated the rigorous math constraints on the snapshot table `tgd_stock_balances`:

- **Keys:** `customer_id`, `product_id`, `lot_id`, `warehouse_id`, `location_id`, `pallet_id`, and `last_movement_id` exist and reference their appropriate master tables.
- **On Hand Constraint:** `tgd_stock_balances_qty_on_hand_nonnegative` checks `qty_on_hand >= 0`.
- **Allocated Constraint:** `tgd_stock_balances_qty_allocated_nonnegative` checks `qty_allocated >= 0`.
- **Allocation Ceiling:** `tgd_stock_balances_allocated_lte_on_hand` checks `qty_allocated <= qty_on_hand`.
- **Calculated Available Qty:** Implemented cleanly as a PostgreSQL generated virtual column:
  ```sql
  qty_available numeric generated always as (qty_on_hand - qty_allocated) stored
  ```
- **Direct Write Prevention:** The trigger `guard_tgd_stock_balances_write` executes the function `tgd_guard_stock_balance_write()` which blocks direct edits, updates, or deletions to the stock balances table unless a transaction-local setting is unlocked:
  ```sql
  if coalesce(current_setting('tgd.allow_stock_balance_write', true), '') <> 'on' then
    raise exception 'stock balances may only be changed by tgd_post_inventory_movement';
  end if;
  ```
  This is a brilliant design that guarantees ledger compliance at the database engine level.

- **Status:** **PASS**

---

## Ledger Posting Function Status

The centralized posting routine `tgd_post_inventory_movement(input jsonb)` was evaluated for transaction security:

- **Structure:** The PL/pgSQL function executes in a single database transaction. If any constraint or business check fails, all database changes are rolled back together.
- **Chronology:** The function inserts the record into `tgd_inventory_movements` to secure the audit path *before* modifying the stock balance snapshot, ensuring full audit integrity.
- **Safety Checks:**
  - If a decrease reduces `qty_available` below zero, it is rejected with `'insufficient available stock'`.
  - If an allocation exceeds `qty_available`, it is rejected with `'insufficient available stock for allocation'`.
  - If a pick confirmation exceeds `qty_allocated`, it is rejected with `'insufficient allocated stock for pick confirmation'`.
  - Negative values or zero quantities are strictly blocked (`qty > 0`).

- **Status:** **PASS**

---

## Reverse Movement Status

Reversals are handled with exceptional audit compliance:

- **Immutable Ledger Principle:** Reversals **never** delete the original movement record. The original movement is marked as reversed (`is_reversed = true` and `reversed_by_movement_id` references the reversal).
- **Inverse Operation:** The function inserts a new movement with type `REVERSE` and triggers the exact inverse balance updates (e.g., reversing an inbound `RECEIVE` decreases stock; reversing a `PICK_CONFIRM` increases stock and returns it to an allocated status).
- **Scope Limit:** Full quantity reversals only. Partial reversals are rejected (`v_qty <> v_original.qty`), preventing math fragmentation. Reverse movements themselves cannot be reversed.
- **Status:** **PASS**

---

## Service/Constants Status

We inspected the frontend integration files under `src/`:

- **Constants:** `src/constants/movementTypes.js` cleanly defines and exports `MOVEMENT_TYPES`, `STOCK_INBOUND_TYPES`, `STOCK_OUTBOUND_TYPES`, `STOCK_TRANSFER_TYPES`, and `ALLOCATION_TYPES`.
- **Services:** `src/services/inventoryMovementService.js` safely exports `postInventoryMovement` (calls RPC `tgd_post_inventory_movement`), `getInventoryMovements`, and `getStockBalances` using null-guards to prevent runtime crashes if Supabase variables are unconfigured.
- **Frontend Isolation:** Zero React files import `inventoryMovementService` or run inline queries. Placeholder pages remain static. `App.jsx` is unchanged (12 lines).

- **Status:** **PASS**

---

## Build/Test Status

Both production builds and automated test validations were executed:

1. **Production Build (`npm run build`):** **PASS**
   - Compiles cleanly in **620ms** with zero errors.
2. **Automated Schema Tests (`npm run test`):** **PASS**
   - The new test suite `tests/unit/inventory-movement-schema.test.js` successfully ran alongside routing and master schema tests.
   - **All 24 unit tests passed successfully** (12 routing tests + 4 master schema tests + 8 inventory movement tests).
   - Confirmed tests check for migration existence, movement table definitions, movement type check constraints, quantity non-negative checks, coalesced unique index mapping, posting function, guard trigger, and scope containment.

- **Status:** **PASS**

---

## Scope Violation Check

We conducted a strict audit against out-of-scope tasks and legacy code intrusion:

- **No legacy-reference files modified:** **PASS** (The `legacy-reference/` directory remains completely isolated and empty.)
- **No files created under integrations/express/sync/*:** **PASS** (`integrations/express/sync/` remains completely empty.)
- **No Express sync code created:** **PASS** (Zero Express sync lines exist in the workspace.)
- **No full receiving/picking/transfer React CRUD UI created:** **PASS** (Feature screens continue to render static placeholders.)
- **App.jsx remains small:** **PASS** (`App.jsx` remains 12 lines.)

- **Status:** **PASS**

---

## Missing Items

- **None.** All required files, SQL trigger configurations, unit tests, and documentations are fully present and verified.

---

## Risks

1. **Database Lock Times during Heavy Operations:** The use of `for update` in `tgd_find_stock_balance_id` and decrease routines locks the specific stock balance rows during active transactions. Under massive simultaneous barcode handheld scans, this guarantees accuracy but may introduce short row-level locks. 
2. **UOM Conversions Deferral:** Units of Measure (`uom`) are recorded in the movements ledger but not validated or converted on the stock balance table. The design assumes that inbound and internal movements of a product use a single, stable base UOM. Multi-UOM calculations must be managed carefully in subsequent sprints.

---

## Required Fixes

- **None.** The Sprint 1B inventory movement ledger and balance engine meet 100% of the rigorous architectural validation standards.

---

## Final Approval Status

### **FINAL STATUS: PASS**

### **Comments & Recommendations for Sprint 1C:**
1. **Exceptional Ledger Architecture:** The database-enforced write guard trigger combined with single-transaction PL/pgSQL posting logic represents a highly secure, reliable ledger architecture.
2. **Move to Sprint 1C:** The project has successfully cleared all Sprint 1B QA hurdles and is fully authorized to transition to **Sprint 1C (Audit Log + Role Foundation)**.
