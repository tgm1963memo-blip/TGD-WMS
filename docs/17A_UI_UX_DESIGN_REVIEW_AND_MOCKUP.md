# 17A UI/UX Design Review and Mockup

## Scope

- UI/UX design review and mockup only.
- No runtime UI implementation.
- No Production touched.
- No migration applied.
- No feature gate changed.
- This sprint locks design direction before 17B implementation.

## Design Decision

The selected style is **Black & Gold Professional Warehouse UI**.

The visual direction should feel controlled, operational, and professional. Black establishes the navigation shell, gold identifies primary and active actions, and neutral surfaces keep high-density warehouse information readable.

### Color Palette

| Token | Value | Intended Use |
| --- | --- | --- |
| Sidebar background | `#111111` | Main navigation shell |
| Sidebar soft/hover | `#1b1b1b` / `#1f1f1f` | Hover, expanded group, secondary dark surface |
| Primary gold | `#d4af37` | Active navigation, primary action, key focus |
| Primary hover | `#bf9b2f` | Hover/pressed state for primary gold |
| Main background | `#f4f5f7` | Application workspace |
| Card/surface | `#ffffff` | Cards, tables, panels, dialogs |
| Main text | `#121826` | Primary headings and body text |
| Muted text | `#667085` | Metadata, helper text, secondary labels |
| Border | `#dbe1ea` | Dividers, table borders, input outlines |
| Success | `#12b76a` | Completed, available, safe states |
| Warning | `#f59e0b` | Pending operational work |
| Danger | `#ef4444` | Blockers, failed states, actual danger |
| Info | `#3b82f6` | Informational and synchronization states |

## Sidebar Design Rules

- Use full professional text menu labels.
- Do not use cute emoji icons.
- Do not use short code-only menu labels as the primary display.
- Active menu should use a gold accent border or highlight.
- Hover should use `#1b1b1b` or `#1f1f1f`.
- HOLD or pending counts may be shown as small badges.
- Icons, when used, should be restrained, familiar, and paired with the full label.
- Sidebar groups should include:
  - Main Operation
  - Inbound Management
  - Inventory Control
  - Outbound Management
  - Barcode / Handheld
  - Reports
  - System Administration

## Recommended Sidebar Menu

### Main Operation

- Dashboard

### Inbound Management

- Receiving
- Putaway
- Handheld Receiving

### Inventory Control

- Stock Balance
- Transfer
- Adjustment
- Lot / Pallet

### Outbound Management

- Withdrawal Request
- Reservation
- Picking Confirmation
- Post Outbound
- Dispatch History

### Barcode / Handheld

- Scan Center
- Barcode Alias
- Scan Logs

### Reports

- Movement Ledger
- Stock Aging
- Operation Summary

### System Administration

- Master Data
- Users and Roles
- Audit Log

## Dashboard Mockup Specification

The dashboard is an operational workspace, not a marketing landing page. It should prioritize scanability, current workload, blockers, and direct navigation.

### First View

- Compact page title and current warehouse/context selector.
- KPI cards for:
  - Receiving Today
  - Pending Putaway
  - Pending Picking
  - Pending Post Outbound
- Workflow status:
  - Receiving -> Putaway -> Storage -> Picking -> Post Outbound
- Production HOLD safety panel.
- Feature gate status panel.
- Today task list.
- System alert list.

### Dashboard Behavior

- KPI cards should link to the relevant filtered operational list when implementation is approved.
- Pending counts use Warning; completed/safe states use Success.
- The Production HOLD safety panel remains visible and must not be represented as a dismissible success message.
- The feature gate panel shows the current Post Outbound gate status without enabling or changing it.
- Alerts should identify severity, affected module, reference, owner, and timestamp.

## Outbound UI Mockup Specification

### Outbound List Page

- Filter bar for document number, customer, status, requested ship date, and warehouse where supported.
- Status cards for:
  - Draft
  - Reserved
  - Picked
  - Posted
- Table/list should prioritize document number, customer, status, requested date, line count, and updated time.
- Use full text action buttons.
- Do not use abbreviated action-only labels as the primary display.

### Outbound Detail Page

- Header summary with document number, customer, status, dates, and assigned warehouse.
- Stepper:
  - Draft -> Reserve -> Pick -> Post Outbound
- Separate sections for lines, reservations, picking progress, and audit history.
- Actions must be shown only when permitted by role, workflow state, and feature gate.
- Safety panel must show:
  - Production remains HOLD
  - Post Outbound feature gate default OFF
  - Movement created only after approved action

## Stock Balance UI Mockup Specification

### Filters and Summary

- Search filters by Product, Lot, Location, Customer.
- Summary cards for:
  - Total Qty
  - Total Weight
  - Reserved Qty

### Stock Table

Required columns:

- Product
- Lot
- Location
- Qty
- Weight
- Status

### Status Color Rules

- Available = Success
- Reserved = Warning
- Hold / Issue = Danger
- Info / Sync = Info

Status must use text plus color; color alone must not carry meaning.

## Handheld / Mobile UI Mockup Specification

- Use a mobile-first layout.
- Provide a large scan input.
- Provide a large primary action button.
- Show a Last Scan card.
- Show a Session Summary card.
- Provide an Undo Last Scan button.
- Provide a Complete Session button.
- Avoid wide tables on handheld screens.
- Use stacked records, concise field labels, and large touch targets.
- Keep the current product, lot, location, quantity, and validation state visible near the scan action.
- Dangerous or irreversible actions require clear confirmation and must not be visually confused with the primary scan action.

## Component Style Rules

- Use a card-based layout for discrete operational summaries, repeated items, and framed tools.
- Use rounded cards with restrained corner radius.
- Use clear section titles.
- Use professional text labels.
- Keep visual noise minimal.
- No cute icons.
- Use badges for status/counts.
- Use gold only for primary/active actions, not every element.
- Use red only for actual danger/blocker.
- Use warning only for pending operational work.
- Use success only for completed/safe states.
- Use Info for neutral synchronization, reference, or informational states.
- Tables should use stable column widths, clear row hover, and readable empty/loading/error states.
- Buttons should use familiar icons where appropriate while retaining full text for operational commands.

## Safety and Gate Rules in UI

- Production HOLD must be visible on relevant pages.
- Post Outbound feature gate must remain OFF by default.
- FINAL GO must not be inferred from UI actions.
- Controlled write smoke remains separate.
- Exact FINAL GO phrase:

FINAL GO: Apply Outbound migrations 025-030 to Production

- Exact controlled write smoke phrase:

APPROVE CONTROLLED WRITE SMOKE: Outbound qty 1

No visual treatment, button click, status badge, or completed form replaces either explicit approval boundary.

## Implementation Recommendation

Recommended next sprint: **17B App Shell and Navigation UI Implementation**.

- 17B may edit runtime UI layout only.
- 17B must not change business logic.
- 17B must not change migrations.
- 17B must not touch Production.
- 17B should focus on shell, sidebar, header, page shell, and shared styling.
- Module-by-module polishing should be separated into 17C onward.
