# Cold Storage Business Scope

## Business Model

TGD WMS supports a cold storage warehouse service business.

Customers deposit goods into TGD cold storage. TGD receives, stores, moves, counts, and dispatches customer-owned inventory. TGD does not sell the stored goods.

The system is focused on operational control, stock traceability, auditability, and monthly storage billing support.

## Inbound Deposit Process

Inbound work begins when customer goods arrive for storage.

The operational flow is:

- Goods Deposit / Receiving
- barcode or document registration
- customer, product, lot, pallet, and location capture
- quantity and weight capture where available
- putaway into cold storage locations
- movement-ledger inventory recording through approved posting functions

## Storage Process

Storage is the period where customer-owned inventory remains in TGD custody.

The system must support:

- customer stock balance visibility
- lot, pallet, and location traceability
- movement audit history
- stock count and cycle count
- storage period evidence for billing preparation
- chargeable weight and balance reporting

## Customer Withdrawal Process

Outbound work starts from a Customer Withdrawal Request.

The operational flow is:

- Customer Withdrawal Request
- allocation
- picking
- dispatch / goods issue
- customer stock movement audit

The outbound process is not a commercial order process.

## Customer-Owned Stock Rule

All stock tracked by TGD WMS is customer-owned inventory unless explicitly documented otherwise in a future approved scope.

TGD WMS must preserve customer isolation for every balance, movement, lot, pallet, location, count, and report.

## Weight-Based Billing Support

Billing support should prepare monthly summaries for accounting handoff.

Billing preparation may use:

- inbound / deposit weight
- outbound / withdrawal weight
- remaining stock balance
- chargeable weight
- storage period
- chargeable days
- customer rate card rules in a future phase

TGD WMS should provide Monthly Storage Billing Summary data and exports, not full accounting inside WMS.

## Operation Charge Examples

Operation charges may include:

- lifting
- repack
- sorting
- labeling
- palletizing
- relabeling
- special handling
- inspection support
- other warehouse services

These charges should be logged as operational evidence in a future approved billing support module.

## In Scope

- master data for customers, products, warehouses, locations, lots, and pallets
- receiving / goods deposit
- putaway
- transfer
- adjustment
- customer withdrawal request
- allocation
- picking
- dispatch / goods issue
- stock count
- barcode and handheld workflow foundations
- customer stock movement reporting
- storage balance and aging reporting
- monthly storage billing summary preparation
- operation charge support as a future module

## Out Of Scope

- selling customer-owned goods
- commercial order processing
- accounting invoice generation
- accounting ledger ownership
- billing engine implementation in current phases
- Express sync writeback
- direct stock balance mutation from UI
- inventory movement posting from report pages
- legacy system refactor
