# Staging Environment Requirements

## Required Environment

- Dedicated staging frontend environment.
- Dedicated staging Supabase/project environment if applicable.
- Staging data separated from production data.
- No live ERP connector.
- No inventory sync with ERP.
- No Express sync.
- No invoice generation or accounting post behavior.

## Browser Support

Recommended UAT browsers:

- Current Google Chrome.
- Current Microsoft Edge.

Optional review:

- Current Firefox.
- Tablet or handheld browser if warehouse users plan to review mobile behavior.

## Network Assumptions

- Warehouse and office users can access the staging URL.
- Staging environment is reachable from UAT network.
- External production integrations are disabled unless explicitly approved for test mode.

## Supabase / Project Assumptions

- Staging project is not production.
- Staging data can be reset or restored.
- Public frontend config uses staging project values.
- Backend RLS production enforcement remains a separate production security review item.

## Public Frontend Env Variables

Required public frontend values:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Optional public frontend values:

- `VITE_APP_ENV`
- `VITE_APP_NAME`

## Prohibited Secrets In Frontend

Do not place these in frontend config:

- Service role key
- Secret key
- Private key
- Password
- Private token
- Database URL
- Accounting system credential
- ERP credential

## Test User Roles

Required UAT roles:

- `admin`
- `warehouse_manager`
- `warehouse_staff`
- `accounting`
- `viewer`

Each role should have a known test user or approved UAT role-switching method.

## Data Separation Between Staging And Production

- Staging must not write to production data.
- UAT test data must be clearly marked.
- Customer-owned inventory in staging must be test data or approved copied data.
- Staging reports must not be used for real customer billing.

## Backup / Restore Assumptions

- Staging data backup/restore approach should be known before UAT.
- Restore point should be available before major UAT cycles where possible.
- Rollback of frontend artifact does not automatically roll back data.

## Known Limitations

- Staging deployment checklist does not create automation.
- Frontend checks do not replace backend RLS.
- Accounting Charge Review is review-only.
- Monthly Storage Billing Summary is preparation only.
- No live ERP connector, inventory sync, Express sync, invoice generation, or accounting post is included.
