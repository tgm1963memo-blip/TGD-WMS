# 17B App Shell and Navigation UI Implementation

## Scope

- UI shell and navigation implementation only.
- No Production touched.
- No migration applied.
- No services changed.
- No business logic changed.
- No feature gate behavior changed.
- No RPC calls changed.
- No database schema changed.
- No route behavior changed.

## Design Direction

Implements the **Black & Gold Professional Warehouse UI** direction locked in 17A.

### Color Palette Applied

| Token | CSS Variable | Value |
| --- | --- | --- |
| Sidebar background | `--tgd-sidebar-bg` | `#111111` |
| Sidebar soft | `--tgd-sidebar-soft` | `#1b1b1b` |
| Sidebar hover | `--tgd-sidebar-hover` | `#1f1f1f` |
| Primary gold | `--tgd-primary-gold` | `#d4af37` |
| Primary hover | `--tgd-primary-gold-hover` | `#bf9b2f` |
| Main background | `--tgd-main-bg` | `#f4f5f7` |
| Card/surface | `--tgd-surface` | `#ffffff` |
| Main text | `--tgd-main-text` | `#121826` |
| Muted text | `--tgd-muted-text` | `#667085` |
| Border | `--tgd-border` | `#dbe1ea` |
| Success | `--tgd-success` | `#12b76a` |
| Warning | `--tgd-warning` | `#f59e0b` |
| Danger | `--tgd-danger` | `#ef4444` |
| Info | `--tgd-info` | `#3b82f6` |

## Sidebar Navigation Structure

### Menu Groups and Items

| Group | Menu Item | Route | Status |
| --- | --- | --- | --- |
| Main Operation | Dashboard | `/dashboard` | Active |
| Inbound Management | Receiving | `/operations/receiving` | Active |
| Inbound Management | Putaway | `/operations/putaway` | Active |
| Inbound Management | Handheld Receiving | `/handheld` | Active |
| Inventory Control | Stock Balance | `/stock-count` | Active |
| Inventory Control | Transfer | `/operations/transfer` | Active |
| Inventory Control | Adjustment | `/operations/adjustment` | Active |
| Inventory Control | Lot / Pallet | — | Disabled (Coming soon) |
| Outbound Management | Withdrawal Request | `/operations/withdrawal-requests` | Active |
| Outbound Management | Reservation | `/operations/allocations` | Active |
| Outbound Management | Picking Confirmation | `/operations/picking` | Active |
| Outbound Management | Post Outbound | `/operations/outbound` | Active |
| Outbound Management | Dispatch History | `/operations/dispatch` | Active |
| Barcode / Handheld | Scan Center | `/handheld` | Active |
| Barcode / Handheld | Barcode Alias | — | Disabled (Coming soon) |
| Barcode / Handheld | Scan Logs | — | Disabled (Coming soon) |
| Reports | Movement Ledger | `/reports/movement-ledger` | Active |
| Reports | Stock Aging | `/reports/storage-aging` | Active |
| Reports | Operation Summary | `/reports` | Active |
| System Administration | Master Data | `/master/customers` | Active |
| System Administration | Users and Roles | `/admin/auth-readiness` | Active |
| System Administration | Audit Log | — | Disabled (Coming soon) |

### Sidebar Rules

- Full professional text labels used.
- No emoji icons.
- No short code-only labels (e.g., RCV, PTW, PCK, PST).
- Gold active/hover accent.
- Professional group labels.
- Disabled items shown greyed out with "Coming soon" tooltip.

## Production HOLD Indicator

A `Production HOLD` safety banner is displayed at the bottom of the sidebar. This is a visual-only indicator and does not change any workflow or gate behavior.

## Files Changed

| File | Change |
| --- | --- |
| `src/styles.css` | Added `--tgd-*` CSS variables and updated shell/sidebar/page styling |
| `src/app/navigation.js` | Restructured navigation groups to match 17A design spec |
| `src/components/layout/Sidebar.jsx` | Rebuilt with Black & Gold theme, professional labels, group headers |
| `src/components/layout/AppShell.jsx` | Updated to use CSS classes, removed inline brandConfig |
| `src/components/layout/Topbar.jsx` | Updated header to use `--tgd-sidebar-bg` background |
| `src/components/layout/PageHeader.jsx` | Updated colors to use `--tgd-*` variables |
| `src/components/layout/SectionCard.jsx` | Updated colors to use `--tgd-*` variables |
| `tests/unit/app-shell-navigation-ui.test.jsx` | New: 32 UI rendering tests |
| `tests/unit/outbound-navigation-ux.test.jsx` | Updated sidebar assertions for new navigation structure |
| `tests/unit/picking-workflow-draft-ui.test.jsx` | Updated picking sidebar assertion for new navigation |
| `tests/unit/tgm-brand-ui-integration.test.jsx` | Updated logo test (logo moved from Sidebar to Topbar) |
| `tests/unit/ui-ux-visual-polish.test.jsx` | Updated sidebar group label assertions |
| `docs/17B_APP_SHELL_NAVIGATION_UI_IMPLEMENTATION.md` | New: this document |

## UI Summary

- **Sidebar**: Dark `#111111` background with gold accent for active items. Seven professional group sections. Full text labels.
- **Topbar/Header**: Dark background matching sidebar, gold eyebrow text for current section, brand logo, language toggle.
- **Main content area**: Light `#f4f5f7` background with white card surfaces.
- **Page headers**: Gold left border accent, `#121826` title text, `#667085` description text.
- **Section cards**: White surface, subtle shadow, gold top accent bar.
- **Production HOLD**: Red safety banner in sidebar.

## Safety Notes

- Production was NOT touched.
- No migration was applied.
- No services were changed.
- No business logic was changed.
- No feature gate behavior was changed.
- No RPC calls were changed.
- No database schema was changed.
- No route behavior was changed (all existing routes preserved).
- Post Outbound menu item is visible but does not imply the feature gate is enabled.
- Production HOLD indicator is visual only.

## Test Results

### Specific Test

```
npm test -- --run tests/unit/app-shell-navigation-ui.test.jsx
```

Result: **32 tests passed** (169ms)

### Full Test Suite

```
npm test -- --run
```

Result: **132 test files passed, 1092 tests passed** (14.69s)

### Build

```
npm run build
```

Result: **Build succeeded** (1.27s, 236 modules transformed)

- `dist/index.html` — 0.39 kB
- `dist/assets/index-*.css` — 4.50 kB (gzip: 1.55 kB)
- `dist/assets/index-*.js` — 622.14 kB (gzip: 162.63 kB)

## Recommendation for 17C

Recommended next sprint: **17C Dashboard UI Polish**.

17C should focus on:

- Dashboard KPI cards implementation using `--tgd-*` tokens.
- Workflow status visualization.
- Production HOLD safety panel on dashboard.
- Feature gate status panel.
- Module-by-module page polish using the established design system.
- Stock Balance page layout with new theme.
- Outbound pages visual polish.
