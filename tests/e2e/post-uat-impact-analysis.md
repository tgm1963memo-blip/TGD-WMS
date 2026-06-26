# Post-UAT Change Impact Analysis
**Baseline commit:** d8b5000 (Fix UAT script hardcoded email and restore data-testid in MainLayout)
**Head commit:** 8acb322
**Analysis date:** 2026-06-25
**Commits in scope:** 13 commits

---

## 1. CHANGE IMPACT ANALYSIS

### Changes by Commit

| Commit | Description | Risk |
|--------|-------------|------|
| 161a3f4 | Resolve unique constraint on request retry + proxy access migration | HIGH |
| 4d3054d | Fix withdrawal draft save, admin lines display, email triggers, invoice source doc | HIGH |
| b3d8166 | Fix email loop: add sent_at, error_log to email queue | MEDIUM |
| 804dd75 | Add requested weight/boxes/qty columns to admin withdrawal review table | LOW |
| b016505 | Fix stale-state transition in withdrawal + deposit handlers | HIGH |
| 597e080 | Fix withdrawal bridge function column names | HIGH |
| d34ff70 | Fix format() type specifier in notification function | MEDIUM |
| 7ddb55c | **Complete handheld withdrawal picking workflow with DB persistence** | CRITICAL |
| 341274e | **Allow warehouse staff to close picking jobs + missing status labels** | CRITICAL |
| 6d61fc8 | **Add COMPLETED to status constraint + deduct stock on confirm dispatch** | CRITICAL |
| ac7ed42 | **Rewrite stock balance as deposits minus completed withdrawals** | CRITICAL |
| 415f9f3 | **Fix lot-based stock deduction + admin inventory balance view** | CRITICAL |
| 8acb322 | **Add customer withdrawal outbound rows to movement ledger report** | HIGH |

---

## 2. FUNCTION IMPACT MATRIX

### Changed Functions

| Function | Location | Type | Upstream | Downstream |
|----------|----------|------|----------|------------|
| `tgd_record_withdrawal_line_pick` | DB RPC (migration 006) | NEW | Handheld PIN login | picked_boxes/weight on CWR line |
| `tgd_review_customer_withdrawal_request` | DB RPC (migration 007/009) | MODIFIED | Admin review page, Handheld | Status change, bridge call, notifications |
| `tgd_get_customer_stock_balance` | DB RPC (migration 009/010) | NEW | Customer portal | CustomerStockBalancePage |
| `tgd_get_all_customer_stock_balances` | DB RPC (migration 010) | NEW | Admin auth | InventoryBalancePage |
| `recordWithdrawalLinePick` | customerWithdrawalRequestService.js | NEW | HandheldPage.jsx | DB: picked_boxes, picked_weight, picked_at |
| `reviewCustomerWithdrawalRequest` | customerWithdrawalRequestService.js | USED | HandheldPage.jsx + AdminPage | DB: withdrawal status |
| `getCustomerStockBalance` | customerDepositRequestService.js | NEW | CustomerStockBalancePage | Replaces getDepositInventoryLines |
| `getAllCustomerStockBalances` | customerDepositRequestService.js | NEW | InventoryBalancePage | Admin view |
| `getConfirmedWithdrawalRows` | movementLedgerReportService.js | NEW | MovementLedgerReportPage | Movement ledger DISPATCH rows |
| `PickingWorkflow.handleConfirm` | HandheldPage.jsx | MODIFIED | Scan/tap line | DB write + duplicate guard |
| `PickingWorkflow.handleCompleteJob` | HandheldPage.jsx | NEW | "ปิดใบงาน" button | CONFIRM_DISPATCH → COMPLETED |
| `PickingWorkflow.isDone` | HandheldPage.jsx | NEW | All line renders | Line state (confirmed OR picked_at) |

### Upstream Dependencies

| Function | Depends On |
|----------|------------|
| `tgd_record_withdrawal_line_pick` | `auth.uid()`, `tgd_current_user_is_active()`, `tgd_customer_withdrawal_request_lines` table |
| `tgd_review_customer_withdrawal_request` (CONFIRM_DISPATCH) | `tgd_customer_withdrawal_requests.status = WAREHOUSE_PICKING\|ADMIN_ACCEPTED`, warehouse/admin role |
| `tgd_get_customer_stock_balance` | `tgd_customer_deposit_requests` (RECEIVED_CONFIRMED\|CUSTOMER_NOTIFIED), `tgd_customer_withdrawal_requests` (COMPLETED) |
| `tgd_get_all_customer_stock_balances` | Admin/warehouse role, same logic as above |
| `getConfirmedWithdrawalRows` | `tgd_customer_withdrawal_requests.status = COMPLETED`, `picked_boxes IS NOT NULL` |

### Downstream Dependencies

| Function | Affects |
|----------|---------|
| `tgd_record_withdrawal_line_pick` | `picked_boxes`, `picked_weight`, `picked_at`, `picked_by_email` on CWR lines → CustomerAdminWithdrawalReviewPage |
| `tgd_review_customer_withdrawal_request` CONFIRM_DISPATCH | `status = COMPLETED` → balance RPC excludes zero rows → CustomerStockBalancePage, InventoryBalancePage |
| `tgd_get_customer_stock_balance` | CustomerStockBalancePage balance display |
| `tgd_get_all_customer_stock_balances` | InventoryBalancePage (admin "ยอดคงเหลือ") |
| `getConfirmedWithdrawalRows` | MovementLedgerReportPage DISPATCH rows |
| `handleCompleteJob` | `selectedDoc` status → `docCompleted = true` banner → "ปิดใบงานเรียบร้อย" |

---

## 3. WORKFLOW IMPACT MATRIX

### End-to-End Workflows Affected

| Workflow | Steps Changed | Impact Level |
|----------|--------------|--------------|
| **Customer Withdrawal (Full)** | Steps 4–7: Picking → Confirm Dispatch → Completed | CRITICAL |
| **Handheld Picking** | All steps: scan → confirm → duplicate guard → complete job | CRITICAL |
| **Customer Stock Balance (Portal)** | Balance calculation rewritten | CRITICAL |
| **Admin Inventory Balance** | Now uses balance RPC (was raw actual_boxes) | CRITICAL |
| **Movement Ledger Report** | New DISPATCH rows from CWR | HIGH |
| **Admin Withdrawal Review** | "จัดแล้ว" badge, picked qty display, confirm dispatch | HIGH |
| **Deposit Workflow** | No functional change (deposit lines remain immutable) | LOW |

### Workflow: Customer Withdrawal Request (Full)

```
Customer creates CWR (DRAFT)
  → Customer submits (SUBMITTED_BY_CUSTOMER)
  → Admin reviews (ADMIN_REVIEWING)
  → Admin accepts (ADMIN_ACCEPTED)
  [NEW] → Warehouse opens picking (WAREHOUSE_PICKING via SEND_TO_PICKING)
  [NEW] → Handheld scans + picks lines (tgd_record_withdrawal_line_pick)
  [NEW] → Handheld or Admin confirms dispatch (CONFIRM_DISPATCH → COMPLETED)
  [NEW] → Stock balance deducted in RPC (dynamic computation)
  [NEW] → Movement ledger gains DISPATCH row
```

### Workflow: Handheld Picking (NEW)

```
Enter PIN on handheld
  → Select "การหยิบ" (PickingWorkflow)
  → Select withdrawal document (WAREHOUSE_PICKING status)
  → Scan barcode or tap line
  [NEW] → Info box shows requested qty (boxes + weight)
  [NEW] → Tap confirm → recordWithdrawalLinePick (DB write)
  [NEW] → Duplicate tap → editWarned banner → second confirm overwrites
  [NEW] → All lines done → "ปิดใบงาน" button appears
  [NEW] → Tap "ปิดใบงาน" → CONFIRM_DISPATCH → COMPLETED
  [NEW] → "ปิดใบงานเรียบร้อย" success banner
```

---

## 4. INVENTORY IMPACT MATRIX

### Stock Balance Calculation

**Before (broken):**
```
balance = actual_boxes (raw from deposit line)
```
Withdrawals did NOT reduce the balance. The `tgd_deduct_stock_for_withdrawal` function
mutated `actual_boxes` directly but this was reverted (migration 009).

**After (correct):**
```
balance = GREATEST(0, actual_boxes - SUM(picked_boxes WHERE wr.status = COMPLETED))
```

### Matching Logic (migration 010)

| Condition | Rule |
|-----------|------|
| A (direct link) | `source_customer_deposit_request_id = deposit_request_id AND lot matches` |
| B (fallback) | `source_customer_deposit_request_id IS NULL AND lot matches AND (product_code IS NULL OR matches)` |

### Inventory Calculation Validation Points

| Check | Before Withdrawal | After Withdrawal |
|-------|------------------|-----------------|
| Deposit line `actual_boxes` | N (unchanged, immutable) | N (unchanged, immutable) |
| `withdrawn_boxes` in RPC | 0 | SUM(picked_boxes) |
| `balance_boxes` in RPC | N | GREATEST(0, N - withdrawn) |
| Row appears in balance view | Yes | Only if balance > 0 |

### Stock Reconciliation Formula

```
Received (actual_boxes from confirmed deposits)
  - Withdrawn (SUM picked_boxes from COMPLETED withdrawals matching by lot/product)
  = Balance (shown in ยอดคงเหลือ pages)
```

---

## 5. REPORT IMPACT MATRIX

### Reports Affected

| Report | Path | Change |
|--------|------|--------|
| ยอดคงเหลือสินค้า (admin) | /inventory | Was: raw actual_boxes. Now: balance after withdrawals |
| ยอดคงเหลือลูกค้า (portal) | /customer/stock-balance | Was: broken (no deduction). Now: correct dynamic balance |
| รายงานการเคลื่อนไหว | /reports/movement-ledger | NEW: DISPATCH rows from COMPLETED withdrawals |
| ใบเบิกสินค้า (admin review) | /customer/admin/withdrawal-review | Now shows: จัดแล้ว badge, picked qty, picked_by |

### Report Reconciliation Rule

```
ยอดคงเหลือ (Admin Inventory Balance)
  = ยอดคงเหลือลูกค้า (Customer Portal Balance)
  = DB: tgd_get_customer_stock_balance (per customer)
  = SUM(deposit actual_boxes) - SUM(completed withdrawal picked_boxes)
```

```
รายงานการเคลื่อนไหว (Movement Ledger):
  IN rows  = confirmed deposit receipt lines (actual_boxes > 0)
  OUT rows = completed withdrawal lines (picked_boxes > 0, status = COMPLETED)
  NET      = SUM(IN) - SUM(OUT) = Balance
```

---

## 6. REGRESSION TEST LOOPS

### Loop 1: Withdrawal Picking + Stock Balance
Each iteration verifies: UI → API → DB → Ledger → Stock Balance → Reports

**Test Data Requirements:**
- Customer with at least 1 confirmed deposit (CDR status = RECEIVED_CONFIRMED)
- Deposit line with known lot_no, actual_boxes > 0
- Admin account (for review/accept/confirm)
- Warehouse account (for picking/confirm dispatch)

**Steps:**
1. Record before-qty from admin inventory page
2. Create + submit withdrawal request for known lot
3. Admin: REVIEWING → ACCEPT → SEND_TO_PICKING
4. Handheld: scan line, enter qty, confirm pick (recordWithdrawalLinePick)
5. Verify DB: picked_boxes set on line
6. Admin or handheld: CONFIRM_DISPATCH → COMPLETED
7. Verify DB: status = COMPLETED
8. Verify balance: customer portal balance = before_qty - picked_qty
9. Verify admin inventory: same deduction (or row gone if fully withdrawn)
10. Verify movement ledger: DISPATCH row appears with CWR number
11. Verify reconciliation: inventory report = ledger = DB balance

### Loop 2: Duplicate Pick Guard
1. Pick a line (confirm → saved)
2. Scan same line again
3. Verify: editWarned banner appears
4. Tap confirm second time (overwrite)
5. Verify: new qty saved to DB

### Loop 3: Complete Job Button
1. Pick all lines in a withdrawal
2. Verify "ปิดใบงาน" button appears
3. Tap "ปิดใบงาน"
4. Verify: status = COMPLETED in DB
5. Verify: "ปิดใบงานเรียบร้อยแล้ว" banner

### Loop 4: Admin Inventory Balance (deduction)
1. Note CDR balance before
2. Confirm a withdrawal (COMPLETED)
3. Reload admin inventory page
4. Verify: balance reduced by picked_boxes
5. If fully withdrawn: row disappears from list

### Loop 5: Movement Ledger Report
1. Complete a withdrawal
2. Open /reports/movement-ledger
3. Filter by customer + date range
4. Verify: DISPATCH row with CWR number appears
5. Verify: qty matches picked_boxes
6. Verify: NET = deposits - dispatches = balance

### Loop 6: Role Permission
1. Login as warehouse_staff
2. Attempt CONFIRM_DISPATCH → should succeed
3. Attempt ACCEPT/REJECT/REVIEWING → should fail with role error
4. Login as customer → attempt any admin action → should fail

---

## 7. PLAYWRIGHT AUTOMATION FILES

| File | Scope |
|------|-------|
| `post-uat-01-withdrawal-picking-flow.spec.js` | Full withdrawal picking → confirm → balance check |
| `post-uat-02-stock-balance-reconciliation.spec.js` | Before/after stock balance validation |
| `post-uat-03-movement-ledger-regression.spec.js` | Movement ledger DISPATCH rows |
| `post-uat-04-admin-inventory-balance.spec.js` | Admin balance page deduction |
| `post-uat-05-handheld-picking.spec.js` | Handheld PIN flow + duplicate guard |
| `post-uat-00-regression-master.spec.js` | Full regression orchestrator |
