# UAT Test Scenarios

## A. Master Data

| Scenario ID | Scenario name | Role | Preconditions | Test steps summary | Expected result | Priority |
|---|---|---|---|---|---|---|
| UAT-MD-001 | View customer master data | viewer | Customer data exists | Open customer master list and inspect details | Customer list is readable and no edit/post action is shown | High |
| UAT-MD-002 | View product/SKU master data | warehouse_staff | Product data exists | Open product list and verify SKU/UOM fields | Product data is visible for operation reference | High |
| UAT-MD-003 | View warehouse and location setup | warehouse_manager | Warehouse, room, zone, and location data exists | Open warehouse and location pages | Storage structure is readable | Medium |

## B. Receiving

| Scenario ID | Scenario name | Role | Preconditions | Test steps summary | Expected result | Priority |
|---|---|---|---|---|---|---|
| UAT-REC-001 | Create receiving draft | warehouse_staff | Customer, product, warehouse exist | Create draft receiving document | Draft receiving data is saved or staged according to current UI behavior | High |
| UAT-REC-002 | Review receiving detail | warehouse_manager | Receiving document exists | Open receiving detail and lines | Header and line data are readable | High |
| UAT-REC-003 | Verify received movement in ledger | warehouse_manager | Receiving posted by approved workflow | Open movement ledger filtered by receiving reference | Movement ledger shows receiving movement | High |

## C. Putaway

| Scenario ID | Scenario name | Role | Preconditions | Test steps summary | Expected result | Priority |
|---|---|---|---|---|---|---|
| UAT-PUT-001 | Create putaway draft | warehouse_staff | Receiving document exists | Create putaway draft and select target location | Putaway draft is created or staged safely | High |
| UAT-PUT-002 | Review putaway lines | warehouse_manager | Putaway document exists | Open putaway detail | Source/target storage data is readable | High |
| UAT-PUT-003 | Verify putaway ledger | warehouse_manager | Putaway posted by approved workflow | Filter ledger by putaway reference | Movement ledger shows putaway movement | High |

## D. Transfer

| Scenario ID | Scenario name | Role | Preconditions | Test steps summary | Expected result | Priority |
|---|---|---|---|---|---|---|
| UAT-TRF-001 | Create transfer draft | warehouse_staff | Stock exists in source location | Create transfer draft from one location to another | Draft transfer is created or staged safely | High |
| UAT-TRF-002 | Verify stock by location after transfer | warehouse_manager | Transfer posted by approved workflow | Check balance/report by location | Quantity moves from source to target location | High |

## E. Adjustment

| Scenario ID | Scenario name | Role | Preconditions | Test steps summary | Expected result | Priority |
|---|---|---|---|---|---|---|
| UAT-ADJ-001 | Create positive adjustment draft | warehouse_manager | Product/location exists | Create adjustment draft for gain | Draft adjustment is created safely | High |
| UAT-ADJ-002 | Create negative adjustment draft | warehouse_manager | Stock exists | Create adjustment draft for loss | Draft adjustment is created safely | High |
| UAT-ADJ-003 | Verify adjustment ledger | warehouse_manager | Adjustment posted by approved workflow | Filter movement ledger by adjustment | Ledger shows adjustment movement | High |

## F. Stock Count

| Scenario ID | Scenario name | Role | Preconditions | Test steps summary | Expected result | Priority |
|---|---|---|---|---|---|---|
| UAT-STC-001 | Create cycle count draft | warehouse_manager | Stock exists | Create stock count document | Draft count document is created | High |
| UAT-STC-002 | Record counted quantity | warehouse_staff | Count document exists | Enter counted quantity in test script/process | Variance can be reviewed | High |
| UAT-STC-003 | Review variance and adjustment draft | warehouse_manager | Variance exists | Review variance and adjustment draft behavior if enabled | No direct stock update occurs before approved adjustment posting | High |

## G. Customer Withdrawal Request

| Scenario ID | Scenario name | Role | Preconditions | Test steps summary | Expected result | Priority |
|---|---|---|---|---|---|---|
| UAT-WDR-001 | Create customer withdrawal request draft | warehouse_staff | Customer stock exists | Create withdrawal request draft | Draft request is created without sales order terminology | High |
| UAT-WDR-002 | Review withdrawal quantities | warehouse_manager | Withdrawal request exists | Open detail page | Requested, allocated, picked, and dispatched quantities are visible | High |

## H. Allocation

| Scenario ID | Scenario name | Role | Preconditions | Test steps summary | Expected result | Priority |
|---|---|---|---|---|---|---|
| UAT-ALL-001 | Create allocation draft | warehouse_manager | Withdrawal request exists | Create allocation draft | Allocation data is staged safely | High |
| UAT-ALL-002 | Review allocated stock | warehouse_manager | Allocation exists | Open allocation detail | Allocated product/lot/location/pallet data is visible | High |

## I. Picking

| Scenario ID | Scenario name | Role | Preconditions | Test steps summary | Expected result | Priority |
|---|---|---|---|---|---|---|
| UAT-PIC-001 | Create picking draft | warehouse_staff | Allocation exists | Create picking draft | Picking draft is created safely | High |
| UAT-PIC-002 | Review picking lines | warehouse_staff | Picking document exists | Open picking detail | Picking lines are readable; no dispatch post action is shown | High |

## J. Dispatch / Goods Issue

| Scenario ID | Scenario name | Role | Preconditions | Test steps summary | Expected result | Priority |
|---|---|---|---|---|---|---|
| UAT-DSP-001 | Create dispatch draft | warehouse_staff | Picking document exists | Create dispatch draft | Dispatch draft is created safely | High |
| UAT-DSP-002 | Verify goods issue after approved dispatch | warehouse_manager | Dispatch posted by approved workflow | Check balance and ledger | Stock reduction and ledger movement are visible | High |

## K. Reports

| Scenario ID | Scenario name | Role | Preconditions | Test steps summary | Expected result | Priority |
|---|---|---|---|---|---|---|
| UAT-REP-001 | Inventory dashboard review | viewer | Stock exists | Open dashboard | Summary cards and stock table render | High |
| UAT-REP-002 | Movement ledger review | viewer | Movements exist | Filter movement ledger | Customer stock movements are visible | High |
| UAT-REP-003 | Customer storage balance review | viewer | Stock exists by customer | Open report | Customer-owned inventory is grouped correctly | High |
| UAT-REP-004 | Storage aging review | viewer | Lots with dates exist | Open aging report | Aging and expiry status are visible | Medium |
| UAT-REP-005 | Warehouse operation performance review | warehouse_manager | Operation documents exist | Open operation report | Operation volume and status summaries are visible | Medium |

## L. Monthly Billing / Accounting Review

| Scenario ID | Scenario name | Role | Preconditions | Test steps summary | Expected result | Priority |
|---|---|---|---|---|---|---|
| UAT-BIL-001 | Monthly storage billing summary preview | accounting | Movement and balance data exists | Open monthly billing summary | Deposit, withdrawal, remaining, chargeable preview fields are visible | High |
| UAT-BIL-002 | Accounting charge staging preview | accounting | Summary rows exist | Open staging preview | Review-only rows and validation status are visible | High |
| UAT-BIL-003 | Handoff review draft | accounting | Canonical summary exists | Open handoff review draft | No invoice generation or accounting post action exists | High |

## M. Role Permission / Navigation

| Scenario ID | Scenario name | Role | Preconditions | Test steps summary | Expected result | Priority |
|---|---|---|---|---|---|---|
| UAT-RPN-001 | Admin report visibility | admin | Admin role active | Open reports page | All report cards are visible | High |
| UAT-RPN-002 | Viewer report visibility | viewer | Viewer role active | Open reports page | Only general read-only reports are visible | High |
| UAT-RPN-003 | Accounting report visibility | accounting | Accounting role active | Open reports page | General reports and accounting review cards are visible | High |
| UAT-RPN-004 | Warehouse staff report visibility | warehouse_staff | Warehouse staff role active | Open reports page | Accounting review cards are hidden | High |

## N. Thai-English Language Support

| Scenario ID | Scenario name | Role | Preconditions | Test steps summary | Expected result | Priority |
|---|---|---|---|---|---|---|
| UAT-LNG-001 | Default Thai language | viewer | App loaded fresh | Open reports page | Thai labels show by default | High |
| UAT-LNG-002 | Switch to English | viewer | Language toggle visible | Click language toggle | Report labels switch to English | High |
| UAT-LNG-003 | Switch back to Thai | viewer | English is active | Click language toggle | Thai labels return | Medium |

## O. Production Readiness Smoke Test

| Scenario ID | Scenario name | Role | Preconditions | Test steps summary | Expected result | Priority |
|---|---|---|---|---|---|---|
| UAT-PRD-001 | App load smoke test | admin | UAT build deployed | Open application | App shell loads without crash | High |
| UAT-PRD-002 | Error boundary smoke check | admin | Documented test method available | Trigger safe render error in test method | Generic fallback appears without stack trace | Medium |
| UAT-PRD-003 | Config readiness check | admin | Public config available | Review config validation summary | Missing/unsafe config is flagged; no secrets visible | High |
