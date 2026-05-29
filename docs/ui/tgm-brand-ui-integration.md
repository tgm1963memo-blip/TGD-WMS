# TGM Brand UI Integration

## Purpose

Apply the approved premium TGM visual direction to the TGD WMS frontend while keeping warehouse behavior unchanged.

## Scope

The sprint updates frontend brand tokens, layout chrome, common notices, safe operational pages, reports, admin review pages, translations, and UI validation tests.

## Logo Placement

The official TGM logo is loaded from `public/brand/tgm-logo.png` and displayed in the black sidebar brand block and the topbar title area.

## Brand Colors

- Black: primary sidebar and topbar base.
- Gold/yellow: active navigation, primary actions, and premium accent lines.
- Red: warning, denied, and critical UI states only.
- White and gray: content surfaces and page background.

## Components Updated

`AppShell`, `Sidebar`, `Topbar`, `PageHeader`, `SectionCard`, `LanguageToggle`, `UserRoleDemoSelector`, `PermissionDeniedNotice`, and `AppErrorBoundary` now use TGM tokens.

## Thai-First Behavior

Thai remains the default language through the existing language provider and translation catalog. The English toggle remains available in the topbar and existing page placements.

## Responsive Behavior

The sidebar collapses into the single-column mobile layout already used by the app. The topbar stacks title and controls on narrow screens to avoid overlap.

## Accessibility And Readability Notes

Gold accents are paired with black text for action buttons. Red is reserved for warnings and errors. Logo images include alt text. Navigation remains semantic through `nav`, `aside`, and `NavLink`.

## Known Remaining UI Gaps

Some legacy Thai strings display from existing encoded content and were not rewritten in this branding sprint. Deeper dashboard metric redesign remains outside scope.

## Future Dashboard Enhancement Backlog

- Add KPI tiles for deposit, storage, withdrawal, picking, dispatch, and accounting review.
- Add cold-storage workload trend charts.
- Add role-aware operational alerts.
- Add document preview polish using the same TGM token system.
