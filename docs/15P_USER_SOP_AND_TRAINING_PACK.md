# User SOP and Training Pack

## Daily Operation Flow
- Start of shift checklist
- System login and role verification
- Review pending receipts, transfers, and outbound drafts
- End of shift handover

## Receiving SOP
- Scan inbound shipment barcode
- Create receipt entry
- Verify quantity and condition
- Update stock balance
- Record evidence (photos, logs)

## Putaway SOP
- Assign storage location based on SKU
- Perform barcode scan at location
- Confirm inventory update
- Record location assignment evidence

## Transfer SOP
- Initiate transfer request
- Verify source and destination balances
- Perform move and confirm via handheld scanner
- Log transfer audit trail

## Adjustment SOP
- Create adjustment record (positive/negative)
- Attach justification and manager approval
- Update stock balance and audit log

## Outbound SOP
- Create outbound draft
- Generate reservation and pick list
- Verify pick list accuracy

## Picking SOP
- Scan each pick barcode
- Confirm quantity matches reservation
- Mark pick as completed

## Post Outbound SOP
- Run post‑outbound processing batch
- Verify stock movement journal entries
- Reconcile inventory

## What Users Must NOT Do
- Do not modify stock balances manually
- Do not approve outbound without reservation
- Do not bypass barcode scanning
- Do not enable feature gates without controller approval

## Error Handling
- Out‑of‑stock scenarios: create backorder
- Scanner failure: manual entry with supervisor sign‑off
- Network latency: retry mechanism with timeout

## Training Checklist
- [ ] Barcode scanner operation
- [ ] Role‑based access verification
- [ ] SOP walkthrough for each process
- [ ] Error case simulations
- [ ] Final assessment

## Role Responsibility Matrix
| Role | Receiving | Putaway | Transfer | Adjustment | Outbound | Picking | Post Outbound |
|------|-----------|---------|----------|------------|----------|----------|---------------|
| Receiver | X |   |   |   |   |   |   |
| Putaway Operator |   | X |   |   |   |   |   |
| Transfer Clerk |   |   | X |   |   |   |   |
| Adjuster |   |   |   | X |   |   |   |
| Outbound Manager |   |   |   |   | X |   |   |
| Picker |   |   |   |   |   | X |   |
| Post‑Outbound Supervisor |   |   |   |   |   |   | X |
