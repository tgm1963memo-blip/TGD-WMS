# 15X UAT Dry Run Execution Guide

## Scope

- UAT dry run execution guide only.
- No Production touched.
- No migration applied.
- No runtime code changed.
- This guide does not authorize Production apply.

Production remains HOLD. This guide is only for preparing, executing, and reviewing a controlled UAT dry run in Staging or another approved non-Production environment.

## UAT Preparation Checklist

Complete these items before starting the dry run:

| Item | Required Detail | Status / Owner |
| --- | --- | --- |
| Staging URL | Confirm the exact Staging application URL. |  |
| Test user accounts | Confirm tester accounts and login method. |  |
| Role/permission assignment | Confirm each tester has the intended role. |  |
| Test product | Confirm product IDs/codes used for UAT. |  |
| Test lot | Confirm lot data where applicable. |  |
| Test location | Confirm source and destination locations. |  |
| Test customer | Confirm outbound customer data. |  |
| Test warehouse | Confirm warehouse used for receiving, movement, and outbound. |  |
| Barcode / handheld test data if available | Confirm scan values, device/browser, and expected records. |  |
| Evidence storage location | Confirm folder, ticket, or shared location for evidence. |  |
| Tester list | Confirm tester names and assigned modules. |  |
| UAT time window | Confirm start/end date and support availability. |  |
| Issue owner | Confirm owner for triage, fix coordination, and retest tracking. |  |

## Recommended UAT Execution Order

1. Login and role access check
2. Master data visibility check
3. Receiving
4. Putaway
5. Transfer
6. Adjustment
7. Outbound Draft
8. Reservation
9. Pick Confirmation
10. Post Outbound
11. Barcode / handheld foundation
12. Reporting/read-only review
13. Evidence review
14. Defect review
15. Final sign-off review

## Step-by-Step UAT Scenarios

### Receiving

- Objective: Verify receiving can be performed by the correct role with correct evidence.
- Preconditions: Test product, warehouse, receiving user, and source document are ready.
- Steps: Log in, open receiving, create or process the receiving scenario, confirm displayed quantity/status, and record document number.
- Expected result: Receiving completes or reaches the expected controlled status without permission or validation errors.
- Evidence required: Screenshot or SQL result where applicable, document number, tester name, timestamp, and final status.
- PASS/HOLD/FAIL rule: PASS if expected status and evidence are complete; HOLD if blocked by environment/test data; FAIL if function or data result is incorrect and issue ID is created.

### Putaway

- Objective: Verify received stock can move through the putaway flow without unauthorized stock changes.
- Preconditions: Receiving evidence exists and test destination location is ready.
- Steps: Open putaway, select the receiving/stock candidate, complete the putaway scenario, and record final location/status.
- Expected result: Putaway updates only the intended controlled workflow state and expected stock location result.
- Evidence required: Screenshot or SQL result where applicable, document number, tester name, timestamp, and final status.
- PASS/HOLD/FAIL rule: PASS if expected location/status and evidence are complete; HOLD if blocked by missing receiving data; FAIL if location/status is wrong and issue ID is created.

### Transfer

- Objective: Verify transfer workflow between approved locations.
- Preconditions: Test product, source location, destination location, and transfer role are ready.
- Steps: Create or process transfer, confirm quantity and locations, then review resulting document/status.
- Expected result: Transfer completes with correct source/destination and no unexpected permission errors.
- Evidence required: Screenshot or SQL result where applicable, document number, tester name, timestamp, and final status.
- PASS/HOLD/FAIL rule: PASS if transfer details match expected result; HOLD if test stock is unavailable; FAIL if quantity/location/status is wrong and issue ID is created.

### Adjustment

- Objective: Verify controlled adjustment workflow and role boundary.
- Preconditions: Test product/location and authorized adjustment user are ready.
- Steps: Open adjustment, enter approved test adjustment, confirm validation and resulting status, and record evidence.
- Expected result: Adjustment follows the expected authorization and validation path.
- Evidence required: Screenshot or SQL result where applicable, document number, tester name, timestamp, and final status.
- PASS/HOLD/FAIL rule: PASS if adjustment behaves as expected; HOLD if approval/test data is missing; FAIL if validation or role behavior is incorrect and issue ID is created.

### Outbound Draft

- Objective: Verify outbound draft creation and line entry without stock posting.
- Preconditions: Test customer, product, warehouse, location, and outbound user are ready.
- Steps: Open outbound draft UI, create draft, add line, reserve if in scope, and record document details.
- Expected result: Draft and line are created in the controlled outbound workflow without posting outbound stock.
- Evidence required: Screenshot or SQL result where applicable, document number, tester name, timestamp, and final status.
- PASS/HOLD/FAIL rule: PASS if draft/line match input and evidence is complete; HOLD if customer/product test data is missing; FAIL if draft/line data is wrong and issue ID is created.

### Reservation

- Objective: Verify reservation affects available stock only and remains retry-safe.
- Preconditions: Outbound draft/line exists and available stock is sufficient.
- Steps: Reserve stock, verify reservation status, verify available quantity changes, then release if required by the scenario.
- Expected result: Reservation status and available quantity behave as expected without physical stock deduction.
- Evidence required: Screenshot or SQL result where applicable, document number, reservation ID, tester name, timestamp, and status.
- PASS/HOLD/FAIL rule: PASS if reservation state and available stock are correct; HOLD if stock/test line is unavailable; FAIL if duplicate or availability behavior is wrong and issue ID is created.

### Pick Confirmation

- Objective: Verify pick confirmation readiness and role flow according to the current approved feature state.
- Preconditions: Reserved outbound line exists and picking user has the intended permission.
- Steps: Open picking workflow, review picking candidates, perform only approved pick confirmation steps for UAT, and record result.
- Expected result: Pick confirmation behavior matches approved UAT scope and does not imply unauthorized stock posting.
- Evidence required: Screenshot or SQL result where applicable, document number, tester name, timestamp, and final status.
- PASS/HOLD/FAIL rule: PASS if approved picking behavior is correct; HOLD if no eligible reservation exists; FAIL if unauthorized action appears or result is incorrect and issue ID is created.

### Post Outbound

- Objective: Verify Post Outbound only under approved UAT controls and never as Production authorization.
- Preconditions: Feature gate, test data, role, and controlled write authorization are confirmed for non-Production only.
- Steps: Execute only the approved UAT scenario, verify stock movement and balance result where applicable, and collect evidence.
- Expected result: Post Outbound follows the approved controlled path and evidence confirms expected result.
- Evidence required: Screenshot or SQL result where applicable, document number, tester name, timestamp, movement/balance evidence, and final status.
- PASS/HOLD/FAIL rule: PASS if controlled expected result and evidence are complete; HOLD if authorization or data is incomplete; FAIL if posting behavior is incorrect and issue ID is created.

### Barcode / Handheld Foundation

- Objective: Verify barcode / handheld foundation is usable for supported UAT checks.
- Preconditions: Test device/browser, barcode values, product/location data, and user role are ready.
- Steps: Open handheld/barcode flow, scan or enter test barcode, verify displayed record and validation result.
- Expected result: Barcode/handheld foundation resolves or validates expected test data without exposing unauthorized actions.
- Evidence required: Screenshot or scan result where applicable, tester name, timestamp, barcode value reference, and status.
- PASS/HOLD/FAIL rule: PASS if expected record/result appears; HOLD if scanner/device/test barcode is unavailable; FAIL if scan maps to wrong data and issue ID is created.

### Role and permission checks

- Objective: Verify users can access only approved UAT routes/actions.
- Preconditions: Test accounts, role assignments, and expected permission matrix are ready.
- Steps: Log in with each test role, open assigned modules, attempt restricted routes/actions, and record results.
- Expected result: Allowed actions work and restricted actions are hidden or denied with clear behavior.
- Evidence required: Screenshot or SQL result where applicable, tester name, timestamp, role/account reference, and result.
- PASS/HOLD/FAIL rule: PASS if access matches expected role matrix; HOLD if account setup is incomplete; FAIL if unauthorized access is allowed and issue ID is created.

## Evidence Collection Rules

- Use Evidence ID format `EVID-15U-001`.
- Link every evidence item to a UAT ID.
- Do not include passwords, tokens, API keys, Supabase anon/service keys, or database passwords.
- Capture screenshot or SQL result where applicable.
- Record tester name and timestamp.
- Record document number and status.
- Store evidence in the agreed evidence storage location from the preparation checklist.

## Defect Handling Rules

- Use Issue ID format `UAT-ISSUE-001`.
- Critical and High defects block go-live.
- HOLD requires blocker note.
- FAIL requires issue ID.
- Retest required after fix.
- Closure sign-off required.

## Controller Submission Format

```text
UAT Dry Run Result:
- Total scenarios:
- PASS:
- HOLD:
- FAIL:
- NOT TESTED:
- Critical/High open defects:
- Evidence missing:
- Sign-off missing:
- Recommendation:
- Production touched:
- Migration applied:
- Runtime code changed:
```

## Exit Criteria

- All critical flows tested.
- No open Critical/High defects.
- Required evidence reviewed.
- Required sign-offs completed.
- Approval packet completion is still required separately.
- Production remains HOLD.

## Production Boundary

- Production remains HOLD.
- This guide does not authorize Production apply.
- FINAL GO phrase is only a gate and must not be inferred.
- Exact phrase:

FINAL GO: Apply Outbound migrations 025-030 to Production

- Controlled write smoke remains separate.
- Exact phrase:

APPROVE CONTROLLED WRITE SMOKE: Outbound qty 1

## Recommendation

Recommended next sprint: 15Y UAT Dry Run Result Review.

Production remains HOLD. 15Y should review actual UAT dry run results if provided. Actual Production apply only after completed approval packet, passed UAT review, and explicit FINAL GO.
