# 23M: Controlled Receiving Lot Resolution

## 1. Context and Blocker
In Phase 23L, the Receiving UAT line entry was blocked because the frontend was restricted to selecting existing lot IDs, but inbound receiving operations require inputting new lot numbers (`UAT-LOT-001`). The backend RPC (`tgd_rpc_add_receiving_line`) strictly mandated a `p_lot_id` UUID, fundamentally preventing a frontend-only text input bypass without breaking isolation.

## 2. Lot ID vs. Lot No Model
The `tgd_lots` schema defines `id` as the UUID primary key and `lot_no` as a unique text identifier (along with `product_id`). 
- **Receiving Line Entry Model:** To satisfy strict traceability and foreign-key constraints on receiving lines, stock movements, and locations, the system passes the UUID `lot_id` around.
- **Inbound Reality:** The user holds a textual `lot_no`.

## 3. Selected Resolution Design
We selected **Option A + Service Orchestration**:
- **New RPC**: Created `tgd_rpc_resolve_or_create_lot` (Migration 032) which accepts `product_id` and `lot_no`. It attempts to find the existing lot or inserts a new one, safely returning the `lot_id` UUID.
- **Strict Boundaries Maintained**: 
  - The RPC *does not* insert movement ledger records.
  - The RPC *does not* update stock balances.
  - The RPC *does not* post receiving.
  - It exposes its functionality only to authenticated roles (`admin`, `warehouse_manager`, `warehouse_staff`).
- **Service Layer (`receivingService.js`)**: Wraps this new RPC in `resolveLotForReceiving()`.
- **UI (`ReceivingCreatePage.jsx`)**: The "Add Line" handler first calls the resolver to fetch/create the `lot_id`, then passes that valid UUID securely to the existing `tgd_rpc_add_receiving_line` RPC.

## 4. Migration Status
- Migration file `database/migrations/032_tgd_wms_controlled_receiving_lot_resolution.sql` has been created.
- **MIGRATION HAS NOT BEEN APPLIED.** It awaits explicit Controller approval.

## 5. Security & Rollout Boundaries
> [!WARNING]
> **Production Context**
> - **No direct stock balance updates were made.**
> - **No movement ledger bypass was executed.**
> - **No delete/truncate commands were executed.**
> - **Production remains HOLD.**
> - **FINAL GO is NOT AUTHORIZED.**
