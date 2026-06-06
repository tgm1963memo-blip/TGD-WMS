# 18J Real UAT Execution Run Sheet and Business User Instruction

## Phase Status
- 18J is documentation/test-only.
- 18J creates Real UAT execution instructions and run sheet only.
- 18J does not execute UAT.
- 18J does not create or fabricate UAT results.
- 18J does not approve Production Gate.
- 18J does not make Go/No-Go decision.
- 18J does not authorize FINAL GO.
- 18J does not release Production.
- 18J does not execute controlled write smoke test.
- 18J does not execute any write transaction.
- 18J does not modify runtime, database, migrations, RPC, stock, ledger, or Production data.
- 18J does not execute rollback.
- Production remains HOLD.

## Relationship to 18A through 18I
- 18A defines Real UAT preparation.
- 18B provides the fill-in UAT execution packet.
- 18C provides UAT result review and defect triage.
- 18D provides controlled write smoke test readiness review.
- 18E provides controlled write smoke test authorization review.
- 18F provides controlled write smoke test execution packet/runbook.
- 18G provides controlled write smoke test execution result review.
- 18H provides Production Gate Review readiness assessment.
- 18I provides Formal Production Gate Review packet.
- 18J converts the prepared framework into business-user UAT execution instructions.
- 18J does not override safety boundaries from 18A through 18I.
- 18J does not replace Controller approval.
- 18J is not FINAL GO.

## UAT Execution Control Information
- UAT execution date: PENDING CONFIRMATION
- UAT execution window: PENDING CONFIRMATION
- Test environment: PENDING CONFIRMATION
- URL / deployment reference: PENDING CONFIRMATION
- Test data source: PENDING CONFIRMATION
- Business coordinator: PENDING OWNER ASSIGNMENT
- UAT executor group: PENDING OWNER ASSIGNMENT
- Technical support contact: PENDING OWNER ASSIGNMENT
- Controller reviewer: PENDING OWNER ASSIGNMENT
- Evidence owner: PENDING OWNER ASSIGNMENT
- Defect coordinator: PENDING OWNER ASSIGNMENT
- Communication channel: PENDING CONFIRMATION
- Cutoff time for result submission: PENDING CONFIRMATION

## Business User Instruction Summary
- Use only the assigned test environment.
- Use only assigned login role.
- Execute only assigned scenarios.
- Do not create extra test cases unless approved.
- Capture evidence for every scenario.
- Record PASS / FAIL / BLOCKED / OBSERVATION accurately.
- Do not mark PASS if evidence is missing.
- Log every defect or blocker.
- Stop immediately if unexpected stock, lot, pallet, location, customer, or access issue occurs.
- Do not perform any Production action.
- Contact the coordinator if unsure.

## UAT Role and Responsibility Matrix
| Role | Responsibility | Required Action | Output | Status |
|---|---|---|---|---|
| Business UAT executor | PENDING ASSIGNMENT | PENDING CONFIRMATION | PENDING CONFIRMATION | PENDING REVIEW |
| Business reviewer | PENDING ASSIGNMENT | PENDING CONFIRMATION | PENDING CONFIRMATION | PENDING REVIEW |
| Technical support | PENDING ASSIGNMENT | PENDING CONFIRMATION | PENDING CONFIRMATION | PENDING REVIEW |
| Evidence owner | PENDING ASSIGNMENT | PENDING CONFIRMATION | PENDING CONFIRMATION | PENDING REVIEW |
| Defect coordinator | PENDING ASSIGNMENT | PENDING CONFIRMATION | PENDING CONFIRMATION | PENDING REVIEW |
| Controller reviewer | PENDING ASSIGNMENT | PENDING CONFIRMATION | PENDING CONFIRMATION | PENDING REVIEW |
| Project owner | PENDING ASSIGNMENT | PENDING CONFIRMATION | PENDING CONFIRMATION | PENDING REVIEW |

## User Assignment and Scenario Mapping
| Business Area | Assigned User | Login Role | Assigned Scenario ID | Scenario Name | Evidence Required | Result Owner | Reviewer | Status |
|---|---|---|---|---|---|---|---|---|
| PENDING CONFIRMATION | PENDING ASSIGNMENT | PENDING CONFIRMATION | UAT-01 | Login and access control | PENDING CONFIRMATION | PENDING OWNER ASSIGNMENT | PENDING OWNER ASSIGNMENT | PENDING REVIEW |
| PENDING CONFIRMATION | PENDING ASSIGNMENT | PENDING CONFIRMATION | UAT-02 | Dashboard visibility | PENDING CONFIRMATION | PENDING OWNER ASSIGNMENT | PENDING OWNER ASSIGNMENT | PENDING REVIEW |
| PENDING CONFIRMATION | PENDING ASSIGNMENT | PENDING CONFIRMATION | UAT-03 | Master data visibility | PENDING CONFIRMATION | PENDING OWNER ASSIGNMENT | PENDING OWNER ASSIGNMENT | PENDING REVIEW |
| PENDING CONFIRMATION | PENDING ASSIGNMENT | PENDING CONFIRMATION | UAT-04 | Receiving document review | PENDING CONFIRMATION | PENDING OWNER ASSIGNMENT | PENDING OWNER ASSIGNMENT | PENDING REVIEW |
| PENDING CONFIRMATION | PENDING ASSIGNMENT | PENDING CONFIRMATION | UAT-05 | Receiving handheld scan review | PENDING CONFIRMATION | PENDING OWNER ASSIGNMENT | PENDING OWNER ASSIGNMENT | PENDING REVIEW |
| PENDING CONFIRMATION | PENDING ASSIGNMENT | PENDING CONFIRMATION | UAT-06 | Putaway document review | PENDING CONFIRMATION | PENDING OWNER ASSIGNMENT | PENDING OWNER ASSIGNMENT | PENDING REVIEW |
| PENDING CONFIRMATION | PENDING ASSIGNMENT | PENDING CONFIRMATION | UAT-07 | Putaway handheld scan review | PENDING CONFIRMATION | PENDING OWNER ASSIGNMENT | PENDING OWNER ASSIGNMENT | PENDING REVIEW |
| PENDING CONFIRMATION | PENDING ASSIGNMENT | PENDING CONFIRMATION | UAT-08 | Location stock visibility | PENDING CONFIRMATION | PENDING OWNER ASSIGNMENT | PENDING OWNER ASSIGNMENT | PENDING REVIEW |
| PENDING CONFIRMATION | PENDING ASSIGNMENT | PENDING CONFIRMATION | UAT-09 | Lot and pallet traceability | PENDING CONFIRMATION | PENDING OWNER ASSIGNMENT | PENDING OWNER ASSIGNMENT | PENDING REVIEW |
| PENDING CONFIRMATION | PENDING ASSIGNMENT | PENDING CONFIRMATION | UAT-10 | Transfer document review | PENDING CONFIRMATION | PENDING OWNER ASSIGNMENT | PENDING OWNER ASSIGNMENT | PENDING REVIEW |
| PENDING CONFIRMATION | PENDING ASSIGNMENT | PENDING CONFIRMATION | UAT-11 | Adjustment document review | PENDING CONFIRMATION | PENDING OWNER ASSIGNMENT | PENDING OWNER ASSIGNMENT | PENDING REVIEW |
| PENDING CONFIRMATION | PENDING ASSIGNMENT | PENDING CONFIRMATION | UAT-12 | Withdrawal request review | PENDING CONFIRMATION | PENDING OWNER ASSIGNMENT | PENDING OWNER ASSIGNMENT | PENDING REVIEW |
| PENDING CONFIRMATION | PENDING ASSIGNMENT | PENDING CONFIRMATION | UAT-13 | Allocation review | PENDING CONFIRMATION | PENDING OWNER ASSIGNMENT | PENDING OWNER ASSIGNMENT | PENDING REVIEW |
| PENDING CONFIRMATION | PENDING ASSIGNMENT | PENDING CONFIRMATION | UAT-14 | Picking confirmation review | PENDING CONFIRMATION | PENDING OWNER ASSIGNMENT | PENDING OWNER ASSIGNMENT | PENDING REVIEW |
| PENDING CONFIRMATION | PENDING ASSIGNMENT | PENDING CONFIRMATION | UAT-15 | Dispatch / goods issue review | PENDING CONFIRMATION | PENDING OWNER ASSIGNMENT | PENDING OWNER ASSIGNMENT | PENDING REVIEW |
| PENDING CONFIRMATION | PENDING ASSIGNMENT | PENDING CONFIRMATION | UAT-16 | Audit trail / evidence review | PENDING CONFIRMATION | PENDING OWNER ASSIGNMENT | PENDING OWNER ASSIGNMENT | PENDING REVIEW |

## Scenario Execution Run Sheet
| Scenario ID | Scenario Name | User Goal | Test Data Needed | Steps to Perform | Expected Result | Actual Result | Result Status | Evidence Reference | Defect ID | Executor Note | Reviewer Note | Sign-off |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| UAT-01 | Login and access control | Verify login | PENDING CONFIRMATION | 1. Open app 2. Login | PENDING CONFIRMATION | PENDING CONFIRMATION | PENDING EXECUTION | PENDING EVIDENCE | PENDING DEFECT LOG | NOT EXECUTED IN 18J | PENDING REVIEW | PENDING SIGN-OFF |
| UAT-02 | Dashboard visibility | Verify dashboard | PENDING CONFIRMATION | 1. Go to dashboard | PENDING CONFIRMATION | PENDING CONFIRMATION | PENDING EXECUTION | PENDING EVIDENCE | PENDING DEFECT LOG | NOT EXECUTED IN 18J | PENDING REVIEW | PENDING SIGN-OFF |
| UAT-03 | Master data visibility | Verify master data | PENDING CONFIRMATION | 1. Go to master data | PENDING CONFIRMATION | PENDING CONFIRMATION | PENDING EXECUTION | PENDING EVIDENCE | PENDING DEFECT LOG | NOT EXECUTED IN 18J | PENDING REVIEW | PENDING SIGN-OFF |
| UAT-04 | Receiving document review | Verify receiving docs | PENDING CONFIRMATION | 1. Go to receiving | PENDING CONFIRMATION | PENDING CONFIRMATION | PENDING EXECUTION | PENDING EVIDENCE | PENDING DEFECT LOG | NOT EXECUTED IN 18J | PENDING REVIEW | PENDING SIGN-OFF |
| UAT-05 | Receiving handheld scan review | Verify handheld receive | PENDING CONFIRMATION | 1. Scan item | PENDING CONFIRMATION | PENDING CONFIRMATION | PENDING EXECUTION | PENDING EVIDENCE | PENDING DEFECT LOG | NOT EXECUTED IN 18J | PENDING REVIEW | PENDING SIGN-OFF |
| UAT-06 | Putaway document review | Verify putaway docs | PENDING CONFIRMATION | 1. Go to putaway | PENDING CONFIRMATION | PENDING CONFIRMATION | PENDING EXECUTION | PENDING EVIDENCE | PENDING DEFECT LOG | NOT EXECUTED IN 18J | PENDING REVIEW | PENDING SIGN-OFF |
| UAT-07 | Putaway handheld scan review | Verify handheld putaway | PENDING CONFIRMATION | 1. Scan location | PENDING CONFIRMATION | PENDING CONFIRMATION | PENDING EXECUTION | PENDING EVIDENCE | PENDING DEFECT LOG | NOT EXECUTED IN 18J | PENDING REVIEW | PENDING SIGN-OFF |
| UAT-08 | Location stock visibility | Verify location stock | PENDING CONFIRMATION | 1. Go to inventory | PENDING CONFIRMATION | PENDING CONFIRMATION | PENDING EXECUTION | PENDING EVIDENCE | PENDING DEFECT LOG | NOT EXECUTED IN 18J | PENDING REVIEW | PENDING SIGN-OFF |
| UAT-09 | Lot and pallet traceability | Verify traceability | PENDING CONFIRMATION | 1. View lot details | PENDING CONFIRMATION | PENDING CONFIRMATION | PENDING EXECUTION | PENDING EVIDENCE | PENDING DEFECT LOG | NOT EXECUTED IN 18J | PENDING REVIEW | PENDING SIGN-OFF |
| UAT-10 | Transfer document review | Verify transfers | PENDING CONFIRMATION | 1. Go to transfers | PENDING CONFIRMATION | PENDING CONFIRMATION | PENDING EXECUTION | PENDING EVIDENCE | PENDING DEFECT LOG | NOT EXECUTED IN 18J | PENDING REVIEW | PENDING SIGN-OFF |
| UAT-11 | Adjustment document review | Verify adjustments | PENDING CONFIRMATION | 1. Go to adjustments | PENDING CONFIRMATION | PENDING CONFIRMATION | PENDING EXECUTION | PENDING EVIDENCE | PENDING DEFECT LOG | NOT EXECUTED IN 18J | PENDING REVIEW | PENDING SIGN-OFF |
| UAT-12 | Withdrawal request review | Verify withdrawals | PENDING CONFIRMATION | 1. View request | PENDING CONFIRMATION | PENDING CONFIRMATION | PENDING EXECUTION | PENDING EVIDENCE | PENDING DEFECT LOG | NOT EXECUTED IN 18J | PENDING REVIEW | PENDING SIGN-OFF |
| UAT-13 | Allocation review | Verify allocation | PENDING CONFIRMATION | 1. Run allocation | PENDING CONFIRMATION | PENDING CONFIRMATION | PENDING EXECUTION | PENDING EVIDENCE | PENDING DEFECT LOG | NOT EXECUTED IN 18J | PENDING REVIEW | PENDING SIGN-OFF |
| UAT-14 | Picking confirmation review | Verify picking | PENDING CONFIRMATION | 1. Confirm pick | PENDING CONFIRMATION | PENDING CONFIRMATION | PENDING EXECUTION | PENDING EVIDENCE | PENDING DEFECT LOG | NOT EXECUTED IN 18J | PENDING REVIEW | PENDING SIGN-OFF |
| UAT-15 | Dispatch / goods issue review | Verify dispatch | PENDING CONFIRMATION | 1. View dispatch | PENDING CONFIRMATION | PENDING CONFIRMATION | PENDING EXECUTION | PENDING EVIDENCE | PENDING DEFECT LOG | NOT EXECUTED IN 18J | PENDING REVIEW | PENDING SIGN-OFF |
| UAT-16 | Audit trail / evidence review | Verify logs | PENDING CONFIRMATION | 1. Check audit trail | PENDING CONFIRMATION | PENDING CONFIRMATION | PENDING EXECUTION | PENDING EVIDENCE | PENDING DEFECT LOG | NOT EXECUTED IN 18J | PENDING REVIEW | PENDING SIGN-OFF |

## Evidence Capture Instruction
- Capture screenshot or export/log reference for every scenario.
- Evidence must show date/time where possible.
- Evidence must show relevant document, item, lot, pallet, location, or role where applicable.
- Evidence must not expose unnecessary sensitive information.
- Evidence must be named consistently.
- Evidence must be mapped to scenario ID.
- Missing evidence must be marked PENDING EVIDENCE.
- Evidence gaps must not be treated as PASS.

Naming convention:
- UAT-[ScenarioID]_[BusinessArea]_[YYYYMMDD]_[ShortDescription]

## Defect Logging Instruction
- Log defects immediately.
- Assign each defect to one scenario.
- Include expected result and actual result.
- Include screenshot/log reference where possible.
- Classify severity.
- Do not hide blockers.
- Do not mark defect as closed without retest evidence.

Severity levels:
- Critical
- High
- Medium
- Low
- Observation

| Defect ID | Scenario ID | Severity | Description | Expected Result | Actual Result | Evidence Reference | Owner | Status | Retest Required | Retest Result | Controller Note |
|---|---|---|---|---|---|---|---|---|---|---|---|
| PENDING CONFIRMATION | PENDING CONFIRMATION | PENDING CONFIRMATION | PENDING CONFIRMATION | PENDING CONFIRMATION | PENDING CONFIRMATION | PENDING EVIDENCE | PENDING OWNER ASSIGNMENT | PENDING CONFIRMATION | PENDING CONFIRMATION | PENDING CONFIRMATION | PENDING REVIEW |

## Stop and Escalation Rules
Stop conditions:
- Wrong environment
- Wrong login role
- Unexpected access permission
- Unexpected stock balance change
- Unexpected movement ledger entry
- Wrong item/SKU
- Wrong lot/pallet/location
- Wrong customer impact
- Missing audit trail
- Evidence cannot be captured
- System error blocks scenario
- Business user is unsure
- Any Production safety concern

| Trigger | Immediate Action | Who to Contact | Evidence Required | Status | Controller Note |
|---|---|---|---|---|---|
| PENDING CONFIRMATION | PENDING CONFIRMATION | PENDING ASSIGNMENT | PENDING EVIDENCE | PENDING CONFIRMATION | PENDING REVIEW |

## Result Status Definitions
- PASS
- FAIL
- BLOCKED
- OBSERVATION
- NOT EXECUTED
- PENDING REVIEW

- PASS means the assigned scenario matched the expected result and has evidence.
- PASS does not mean FINAL GO.
- FAIL requires defect logging.
- BLOCKED requires owner and reason.
- OBSERVATION is not automatically a blocker.
- NOT EXECUTED cannot be treated as PASS.
- PENDING REVIEW means reviewer has not completed verification.

## Daily UAT Summary Template
| Date | Total Scenarios Assigned | Executed | PASS | FAIL | BLOCKED | OBSERVATION | Defects Logged | Evidence Complete | Open Issues | Coordinator Note | Controller Note |
|---|---|---|---|---|---|---|---|---|---|---|---|
| PENDING CONFIRMATION | PENDING CONFIRMATION | PENDING CONFIRMATION | PENDING CONFIRMATION | PENDING CONFIRMATION | PENDING CONFIRMATION | PENDING CONFIRMATION | PENDING CONFIRMATION | PENDING CONFIRMATION | PENDING CONFIRMATION | PENDING CONFIRMATION | PENDING REVIEW |

## Business Sign-off Return Sheet
| Business Area | Executor | Reviewer | Scenarios Completed | Evidence Submitted | Open Defects | Sign-off Status | Sign-off Date | Comment |
|---|---|---|---|---|---|---|---|---|
| PENDING CONFIRMATION | PENDING CONFIRMATION | PENDING CONFIRMATION | PENDING CONFIRMATION | PENDING EVIDENCE | PENDING CONFIRMATION | PENDING SIGN-OFF | PENDING CONFIRMATION | PENDING REVIEW |

## Controller Review Block
- Controller review status: PENDING REVIEW
- UAT execution instruction readiness: PENDING REVIEW
- Scenario assignment readiness: PENDING REVIEW
- Evidence capture readiness: PENDING REVIEW
- Defect logging readiness: PENDING REVIEW
- Business sign-off readiness: PENDING REVIEW
- Actual UAT execution status: NOT EXECUTED IN 18J
- Go / No-Go recommendation: NOT AUTHORIZED IN 18J
- FINAL GO: NOT AUTHORIZED IN 18J
- Production status: HOLD

## Decision Boundaries
- 18J creates user instructions and a run sheet only.
- 18J does not execute UAT.
- 18J does not create fake UAT results.
- 18J does not approve Production Gate.
- 18J does not make Go/No-Go decision.
- 18J does not authorize FINAL GO.
- 18J does not release Production.
- 18J does not execute write transactions.
- 18J does not modify Production data.
- Actual UAT execution must be performed by assigned business users or explicitly approved testers.
- UAT results must be reviewed in a later phase.
- Production remains HOLD unless explicitly released by a later approved phase.

## Recommendation
Recommend next phase: 18K Actual Real UAT Result Collection and Evidence Review

Purpose of 18K:
- Collect real UAT results from business users.
- Review evidence completeness.
- Review PASS / FAIL / BLOCKED / OBSERVATION results.
- Log and classify defects.
- Prepare result summary for gate readiness.
- Still not FINAL GO.
- Still not Production release.
