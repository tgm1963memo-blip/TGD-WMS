# SOP: Role Permission And Language

## Role-Based Navigation

Role-based navigation controls what users can see in the frontend.

Expected behavior:

- `admin`: sees all report cards and review areas.
- `viewer`: sees general read-only reports only.
- `accounting`: sees general reports plus accounting review cards.
- `warehouse_staff`: does not see accounting review cards.
- `warehouse_manager`: sees warehouse operation areas according to configured route permissions.

## Demo Role Selector Limitation

The demo role selector is a UAT/frontend convenience only. It is not production authentication and must not be treated as backend security.

## Permission Denied Behavior

1. User opens a route without permission.
2. System should hide navigation entry or show a permission/access message.
3. User should report incorrect visibility as a UAT defect.

## Thai / English Language Toggle

1. Open page with language toggle.
2. Confirm default language is Thai.
3. Select English.
4. Confirm available labels switch to English.
5. Switch back to Thai.
6. Confirm Thai labels return.

## Default Thai Behavior

Thai is the default language for TGD WMS. Users should confirm primary warehouse and accounting labels are understandable for Thai users.

## English Review Behavior

English labels support bilingual review and controller/admin validation. English coverage gaps should be recorded as UAT defects or translation backlog items.

## Known Security Limitation

Frontend guards do not replace backend security or backend RLS. Production security review must validate backend access control separately.

## Control Points

- Validate role visibility using the approved UAT role list.
- Confirm accounting review cards are hidden from roles that should not access them.
- Confirm Thai is the default language before English review.
- Record permission or translation gaps as UAT defects.

## Evidence / Record-keeping

- Keep role, route, and test user reference for each permission/navigation check.
- Capture screenshot or evidence before and after role or language change.
- Record operator name, timestamp, and reviewer/approver for role visibility sign-off.
- Record permission denied evidence where access is blocked.
- Link language or permission findings to UAT scenario and defect references.
