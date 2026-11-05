# TGC WMS — Design system

The rules for the app's UI. Use these when you build or change a screen. Tokens live
in `:root` at the top of [src/styles.css](src/styles.css); shared components live in
[src/components/ui/](src/components/ui/). This replaces the palette in
`docs/17A_UI_UX_DESIGN_REVIEW_AND_MOCKUP.md`, which no longer matches the app.

## Character

An internal tool for warehouse, accounting and customer staff who read dense tables
all day, mostly in Thai. Dark navy shell, white work surface, one gold accent. Calm
and dense, not decorative.

## Color

Use the semantic `--color-*` tokens. The older `--tgm-*` / `--tgd-*` names still work
(the shell and existing CSS use them) but new code should not add more of them.

| Role | Token | Value |
|---|---|---|
| Brand accent | `--color-gold` / `--color-gold-hover` | #d4af37 / #b5952f |
| Shell (sidebar, handheld header) | `--color-sidebar` | #111417 |
| Cold / temperature, stock fills | `--color-frost` / `--color-frost-soft` | #1f6fa8 / #e2eef7 |
| Gold as text on light | `--color-gold-text` | #7a5f0c |
| Page background | `--color-bg` | #f8fafb |
| Surfaces | `--color-surface`, `--color-surface-muted`, `--color-surface-sunken` | #fff, #f8fafc, #f1f5f9 |
| Borders | `--color-border-subtle`, `--color-border`, `--color-border-strong` | #e5e7eb, #e2e8f0, #cbd5e1 |
| Text | `--color-text`, `-strong`, `-body`, `-secondary`, `-muted`, `-subtle` | #0f172a → #94a3b8 |
| Action (links, primary-blue buttons) | `--color-accent`, `-hover`, `-soft` | #2563eb, #1d4ed8, #eff6ff |
| Status | `--color-{danger,warning,success}` with `-strong`, `-soft`, `-border` | see styles.css |

Rules:

- Status color never carries meaning alone. Pair it with a word (อนุมัติแล้ว, ยกเลิก) or an icon.
- Text on a `-soft` background uses the `-strong` tone. The plain tone is for icons,
  borders and large numbers only (it is under 4.5:1 on the soft background).
- Code that appends an alpha suffix to a color (`` `${color}33` ``) needs a hex value,
  not `var(--…)`. The handheld palette `C` in `handheldUi.jsx` stays hex for this reason.
- Print templates (`*Print*.jsx`, `stickerPrint.jsx`) and PDF/Excel exports use literal
  colors and their own Thai font stack. Don't convert them to tokens.

## Type

- Screen font: `--font-sans` = IBM Plex Sans Thai (Google Fonts, loaded in `index.html`),
  falling back to Leelawadee UI / Sarabun. It covers Thai and Latin.
- Scale: `--text-xs` 11 · `--text-sm` 12 · `--text-md` 13 · `--text-base` 14 (body) ·
  `--text-lg` 16 · `--text-xl` 20 · `--text-2xl` 24.
- 11px is the floor, for table meta and labels only. Body text is 14px.
- Numbers in tables (weight, money, quantity) are right-aligned with
  `font-variant-numeric: tabular-nums`.
- Headings are upright (no italics). Weight carries hierarchy: 600–700 headings, 400 body.

## Space, radius, elevation

- 4px grid: `--space-1` 4 · `-2` 8 · `-3` 12 · `-4` 16 · `-5` 20 · `-6` 24 · `-8` 32 · `-12` 48.
- Radius: `--radius-sm` 4 (chips) · `-md` 6 (buttons, inputs) · `-lg` 8 (cards) · `-xl` 12 (modals).
- Shadows: `--tgd-shadow-sm`, `--tgd-shadow-md`, `--tgd-shadow-card`. No other shadow values.

## Layout

- New breakpoints: 640px (phone) and 1024px (tablet). `styles.css` still has older
  breakpoints (480–1320); move them only with a visual check of the affected pages.
- No horizontal page scroll at 375px. Wide tables scroll inside `.table-responsive`.
- Handheld screens: touch targets at least 44px tall.

## Components

Use these instead of new markup:

| Need | Use |
|---|---|
| Page title + actions | `components/ui/PageHeader` (the only page header) |
| Data table | `components/ui/DataTable`; `CompactExpandableTable` for grouped rows |
| Dialog | `components/ui/Modal`. Don't build `position: fixed` overlays by hand |
| Status | `components/ui/StatusBadge`, or `.status-badge--*` classes |
| Loading / empty / error | `LoadingState`, `EmptyState`, `ErrorState` |
| Date input (dd/mm/yyyy) | `components/common/DateInputDMY` |
| Buttons | `.btn` + `.btn-primary` (navy), `.btn-accent` (blue), `.btn-outline`, `.btn-danger` |

Every interactive element needs a visible `:focus-visible` ring (global rule in
styles.css) and a disabled state that is visibly different and not clickable.

## Icons

Icons come from `lucide-react` (pinned 0.468.0), not emoji. For an icon next to text
use `components/ui/IconLabel` (`<IconLabel icon={Check}>บันทึกแล้ว</IconLabel>`), which
aligns it and hides it from screen readers. An icon that carries meaning on its own
gets `role="img"` and a Thai `aria-label`; an icon-only button gets an `aria-label`.
Icons inherit the text color. Arrows inside running text (A → B) are punctuation and
stay as text, and print documents keep their glyphs.

## Navigation

`src/app/navigation.js` holds the permission groups. Their keys drive role
permissions, the role-permissions admin page and the legacy visibility rules, so
don't rename them. The sidebar doesn't show those groups directly:
`src/app/navigationSections.js` folds them into five job-based sections (งานของฉัน,
งานคลัง, พอร์ทัลลูกค้า, การเงินและรายงาน, ตั้งค่าระบบ) and gives every item a
lucide icon. Section headings follow the language toggle. "ตั้งค่าระบบ" collapses,
and it opens by itself when the current page is inside it.

A new menu item needs:
- a `nav.<camelKey>` entry in `src/i18n/translationCatalog.js`;
- a `routePermissionCatalog` entry (`tests/unit/route-permission-audit.test.js` fails otherwise);
- an icon in `ITEM_ICONS` in `navigationSections.js` (it falls back to a generic one).

A new permission group must also be added to a section in `SIDEBAR_SECTIONS`.
Until then it shows as its own section under its English label.

The top bar shows "section / page" from `findNavigationContext`. The longest
matching menu path wins, so detail routes show their parent menu item.

## Shell and dashboard (redesign 2026-11)

- Shell: ink rail (`--tgd-sidebar-bg` #111417) with a gold inset bar on the active
  item. No gradients, no hover slide.
- Color roles: gold marks brand and the current selection (`--color-gold-text` when
  gold is used as text on white). Frost (`--color-frost`, `-soft`) marks cold and
  temperature, and "has stock" fills. Green, amber and red mean status only.
- Numbers that line up (KPIs, weights, money, document numbers) use the `.num`
  class (IBM Plex Mono, tabular figures).
- Dashboard order: summary strip → warehouse flow → revenue (admin and accounting
  only) → today's queue and alerts → layout map. Use `.dash-*` classes from the
  "REDESIGN 2026-11" block at the end of styles.css: `.dash-panel`, `.dash-kpis`,
  `.dash-flow`, `.dash-q`, `.dash-alert`, `.dash-pill--*` and `.dash-table`.
- A summary strip is one bordered band split by 1px hairlines, not a row of
  separate cards.
- Shared components were restyled for every page (phase 2, "REDESIGN 2026-11 —
  phase 2" block, screen only, so print is untouched):
  - PageHeader has no blue rail.
  - Cards and `.document-section` use a hairline border, with no shadow and no hover lift.
  - Tables have a muted header row.
  - Status badges show a dot plus a word. `--open` (waiting on us) is gold.
  - KPI cards are flat, with mono numbers.
  - Buttons are 32px tall with 13px text, and 44px on phone and tablet.
- A small primary button in a table row (`td .btn.btn-primary.btn-sm`) is drawn
  outlined, so a list doesn't turn into a column of black buttons.
- Table cell helpers: `.cell-nowrap` keeps document numbers and dates on one line.
  `.cell-num` right-aligns numbers in mono (put it on the `th` too). `.cell-wide`
  sets a 200px minimum for a name column. `.cell-keep` wraps only at spaces.
- Status tone for customer requests comes from
  `getCustomerRequestStatusClass` (deposit and withdrawal statuses).
- The stock balance page is done: `.dash-kpis` summary strip, then `.stock-*`
  rows (customer band, product row, expanded lines). Quantities are plain text,
  because green means status only. Temperature shows the Thai short label in
  `.stock-temp-badge`.
- A bare `.btn` with no variant gets a border and a surface fill. Add new variants
  to that `:not()` list in styles.css.
- `.admin-withdrawal-lines-table` is `table-layout: fixed`, so a `min-width` on a
  cell does nothing. Set the width on the header cell.
- Handheld uses the same ink, gold and frost through the hex palette `C` in
  `handheldUi.jsx`. `C.green` and `C.amber` are darker than the desktop tones,
  because small status text must stay readable in dim cold rooms. The menu uses
  `.hh-mode*` classes. Cards have no colored left rail; the status pill carries
  the status. An icon-only button needs `padding: 0`, or the phone rule
  `button { padding: 0 16px }` squeezes its icon.
- Other pages may still have their own inline styles. Move them page by page and
  check each one on real screens at desktop and phone width.
