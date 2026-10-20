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
| Shell (sidebar, handheld header) | `--color-sidebar` | #09111c |
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

The sidebar group labels are English on purpose (17B); item labels follow the
language toggle through `nav.*` keys in `src/i18n/translationCatalog.js`. Every new
menu item needs a `nav.<camelKey>` entry and a `routePermissionCatalog` entry
(`tests/unit/route-permission-audit.test.js` fails otherwise).
